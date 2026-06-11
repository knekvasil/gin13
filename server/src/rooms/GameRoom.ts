import http from "http";
import { Room } from "colyseus";
import { verifyToken } from "../auth";
import { prisma } from "../db";
import { Player, createGameState, CardSchema } from "./GameState";
import type { GameState } from "./GameState";
import {
  startGame,
  drawFromDeck,
  drawFromDiscard,
  meldCards,
  passMeld,
  discardCard,
  addToMeld,
  swapWild,
  endRound,
  startNextRound,
  endMatch,
  autoPlayTurn,
  calculateRoundScores,
} from "./game-engine";
import { ArraySchema } from "@colyseus/schema";

const RECONNECT_TIMEOUT_MS = 60_000;
const TURN_TIMEOUT_MS = 60_000;

export class GameRoom extends Room<GameState> {
  private disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;

  static async onAuth(token: string, _req: http.IncomingMessage) {
    const payload = verifyToken(token);
    if (!payload) return false;
    return { userId: payload.sub, name: payload.name };
  }

  async onCreate(options: any) {
    this.maxClients = 4;
    this.autoDispose = false;
    const totalRounds = options.totalRounds || 13;

    this.setState(createGameState(totalRounds));

    await prisma.match.create({
      data: {
        id: this.roomId,
        totalRounds,
        status: "WAITING",
      },
    });

    this.setMetadata({ totalRounds, players: 0 });

    this.onMessage("start_game", (_client) => {
      if (this.state.players.length < 2) return;
      startGame(this.state);
      this.afterTurnAction();
    });

    this.onMessage("draw", (client, msg: { source: "deck" | "discard" }) => {
      try {
        if (msg.source === "discard") {
          drawFromDiscard(this.state, client.sessionId);
        } else {
          drawFromDeck(this.state, client.sessionId);
        }
        this.restartTurnTimer();
      } catch {}
    });

    this.onMessage("meld", (client, msg: { cardIndices: number[] }) => {
      try {
        meldCards(this.state, client.sessionId, msg.cardIndices);
      } catch (e) {
        client.send("meld_error", { message: (e as Error).message });
      }
    });

    this.onMessage("pass_meld", (client) => {
      try {
        passMeld(this.state, client.sessionId);
        this.restartTurnTimer();
      } catch {}
    });

    this.onMessage("discard", (client, msg: { cardIndex: number }) => {
      try {
        discardCard(this.state, client.sessionId, msg.cardIndex);
        this.afterTurnAction();
      } catch {}
    });

    this.onMessage("add_to_meld", (client, msg: { cardIndex: number; meldGroupId: string; preferSwap?: boolean }) => {
      try {
        addToMeld(this.state, client.sessionId, msg.cardIndex, msg.meldGroupId, msg.preferSwap);
      } catch (e) {
        client.send("meld_error", { message: (e as Error).message });
      }
    });

    this.onMessage("swap_wild", (client, msg: { meldGroupId: string; meldCardIndex: number; handCardIndex: number }) => {
      try {
        swapWild(this.state, client.sessionId, msg.meldGroupId, msg.meldCardIndex, msg.handCardIndex);
      } catch (e) {
        client.send("meld_error", { message: (e as Error).message });
      }
    });
  }

  private async afterTurnAction(): Promise<void> {
    this.clearTurnTimer();

    let iterations = 0;
    while (iterations < 100) {
      iterations++;

      if (this.state.phase === "round_ended") {
        await this.persistRoundResults();
        startNextRound(this.state);
      }

      if (this.state.status === "finished") {
        await this.persistMatchEnd();
        return;
      }

      if (
        this.state.status === "playing" &&
        this.state.phase === "draw" &&
        this.state.players[this.state.currentPlayerIndex]?.disconnected
      ) {
        autoPlayTurn(this.state);
        continue;
      }

      break;
    }

    if (this.state.status === "playing") {
      this.startTurnTimer();
    }
  }

  private restartTurnTimer(): void {
    this.clearTurnTimer();
    this.startTurnTimer();
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private startTurnTimer(): void {
    if (this.state.status !== "playing") return;
    if (this.state.phase === "waiting") return;

    this.turnTimer = setTimeout(() => {
      if (this.state.status !== "playing") return;
      autoPlayTurn(this.state);
      this.afterTurnAction().catch(() => {});
    }, TURN_TIMEOUT_MS);
  }

  private async persistRoundResults(): Promise<void> {
    const scores = calculateRoundScores(this.state);
    for (const player of this.state.players) {
      const handScore = scores.get(player.sessionId) ?? 0;
      await prisma.roundResult.create({
        data: {
          matchId: this.roomId,
          roundNumber: this.state.currentRound + 1,
          wildRank: this.state.wildRank,
          playerId: player.userId,
          handScore,
        },
      }).catch(() => {});
    }
  }

  private async persistMatchEnd(): Promise<void> {
    for (const player of this.state.players) {
      const matchPlayer = await prisma.matchPlayer.findUnique({
        where: { matchId_userId: { matchId: this.roomId, userId: player.userId } },
      });
      if (matchPlayer) {
        await prisma.matchPlayer.update({
          where: { id: matchPlayer.id },
          data: {
            score: player.score,
            finalRank: player.sessionId === this.state.winnerSessionId ? 1 : null,
          },
        });
      }
    }
    await prisma.match.update({
      where: { id: this.roomId },
      data: { status: "FINISHED", endedAt: new Date() },
    });
  }

  async onJoin(client: any, _options: any) {
    const existingPlayer = this.state.players.find(
      (p) => p.userId === client.auth.userId,
    );
    if (existingPlayer) {
      existingPlayer.sessionId = client.sessionId;
      existingPlayer.disconnected = false;

      const timeout = this.disconnectTimeouts.get(client.auth.userId);
      if (timeout) {
        clearTimeout(timeout);
        this.disconnectTimeouts.delete(client.auth.userId);
      }

      this.setMetadata({
        totalRounds: this.state.totalRounds,
        players: this.clients.length,
      });
      return;
    }

    const player = new Player();
    player.sessionId = client.sessionId;
    player.userId = client.auth.userId;
    player.name = client.auth.name;
    player.hand = new ArraySchema<CardSchema>();
    player.board = new ArraySchema<CardSchema>();
    player.score = 0;
    player.disconnected = false;
    this.state.players.push(player);

    const existing = await prisma.matchPlayer.findUnique({
      where: { matchId_userId: { matchId: this.roomId, userId: client.auth.userId } },
    });
    if (!existing) {
      await prisma.matchPlayer.create({
        data: { matchId: this.roomId, userId: client.auth.userId },
      });
    }

    this.setMetadata({
      totalRounds: this.state.totalRounds,
      players: this.clients.length,
    });
  }

  onLeave(client: any) {
    const player = this.state.players.find(
      (p) => p.sessionId === client.sessionId,
    );
    if (!player) return;

    const userId = player.userId;
    player.disconnected = true;

    this.setMetadata({
      totalRounds: this.state.totalRounds,
      players: Math.max(0, this.clients.length),
    });

    // Explicitly unlock the room so new players can join
    // (handles edge cases where stale WebSocket connections inflate the client count)
    if (this.clients.length < this.maxClients && this.locked) {
      this.unlock();
    }

    const timeoutMs = this.clients.length <= 1 ? 10_000 : RECONNECT_TIMEOUT_MS;

    const timeout = setTimeout(() => {
      this.disconnectTimeouts.delete(userId);

      const idx = this.state.players.findIndex((p) => p.userId === userId);
      if (idx !== -1) {
        this.state.players.splice(idx, 1);
      }

      if (this.state.players.length === 0) {
        this.disconnect().catch(() => {});
      }
    }, timeoutMs);

    this.disconnectTimeouts.set(userId, timeout);
  }

  async onDispose() {
    for (const timeout of this.disconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.disconnectTimeouts.clear();
    this.clearTurnTimer();

    await prisma.match.update({
      where: { id: this.roomId },
      data: { status: "FINISHED", endedAt: new Date() },
    });
  }
}
