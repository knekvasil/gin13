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
  botPlayTurn,
  calculateRoundScores,
} from "./game-engine";
import { persistRoundResults, persistMatchEnd } from "./match-repository";
import { ArraySchema } from "@colyseus/schema";

const RECONNECT_TIMEOUT_MS = 60_000;
const TURN_TIMEOUT_MS = 60_000;
let nextBotIndex = 0;

const BOT_NAMES = ["Alpha","Beta","Gamma","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliett","Kilo","Lima","Mike","November","Oscar","Papa","Quebec","Romeo","Sierra","Tango","Uniform","Victor","Whiskey","X-ray"];

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

    const botIds = options.botIds as string[] | undefined;
    const botCount = botIds?.length ?? (options.bots ?? 0);
    for (let i = 0; i < botCount; i++) {
      const botId = botIds?.[i] ?? `bot_${(nextBotIndex + i) % BOT_NAMES.length}`;
      const botName = BOT_NAMES[Number(botId.replace("bot_", ""))] ?? botId;

      const bot = new Player();
      bot.sessionId = botId;
      bot.userId = botId;
      bot.name = botName;
      bot.hand = new ArraySchema<CardSchema>();
      bot.board = new ArraySchema<CardSchema>();
      bot.score = 0;
      bot.disconnected = false;
      bot.isBot = true;
      this.state.players.push(bot);

      // Ensure bot has a database profile
      // Bot user should already exist from seed; upsert as safety
      await prisma.user.upsert({
        where: { id: botId },
        update: {},
        create: {
          id: botId,
          passwordHash: "",
          displayName: botName,
        },
      });

      await prisma.matchPlayer.upsert({
        where: { matchId_userId: { matchId: this.roomId, userId: botId } },
        update: {},
        create: {
          matchId: this.roomId,
          userId: botId,
          score: 0,
        },
      });

      this.setMetadata({ totalRounds, players: this.state.players.length });
    }
    nextBotIndex = (nextBotIndex + botCount) % BOT_NAMES.length;

    this.onMessage("start_game", (_client) => {
      if (this.state.players.length < 2) return;
      startGame(this.state);
      this.setMetadata({ ...this.metadata, status: "playing" });
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

    this.onMessage("add_to_meld", (client, msg: { cardIndex: number; meldGroupId: string; preferSwap?: boolean; position?: "start" | "end" }) => {
      try {
        addToMeld(this.state, client.sessionId, msg.cardIndex, msg.meldGroupId, msg.preferSwap, msg.position);
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

    this.onMessage("resign", (client) => {
      this.resolveMatch(client.sessionId);
    });
  }

  private async resolveMatch(sessionId: string): Promise<void> {
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    if (!player || player.isBot) return;

    player.disconnected = true;
    this.clearTurnTimer();

    let iterations = 0;
    while (iterations < 5000) {
      iterations++;

      if (this.state.phase === "round_ended") {
        await this.persistRoundResults();
        startNextRound(this.state);
      }

      if (this.state.status === "finished") {
        await this.persistMatchEnd();
        return;
      }

      if (this.state.status === "playing" && this.state.phase === "draw") {
        const current = this.state.players[this.state.currentPlayerIndex];
        if (current?.disconnected || current?.isBot) {
          autoPlayTurn(this.state);
          continue;
        }
      }

      break;
    }

    if (this.state.status === "playing") {
      this.startTurnTimer();
    }
  }

  private async afterTurnAction(): Promise<void> {
    this.clearTurnTimer();

    let iterations = 0;
    while (iterations < 100) {
      iterations++;

      if (this.state.phase === "round_ended") {
        await this.persistRoundResults();
        // Let clients see the round_ended board state for celebration animations
        await new Promise((r) => setTimeout(r, 2000));
        startNextRound(this.state);
      }

      if (this.state.status === "finished") {
        await this.persistMatchEnd();
        return;
      }

      if (
        this.state.status === "playing" &&
        this.state.phase === "draw"
      ) {
        const current = this.state.players[this.state.currentPlayerIndex];
        if (current?.disconnected) {
          autoPlayTurn(this.state);
          continue;
        }
        if (current?.isBot) {
          await new Promise((r) => setTimeout(r, 1000));
          botPlayTurn(this.state);
          continue;
        }
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
    const allPlayers = Array.from(this.state.players).filter(Boolean) as Player[];
    await persistRoundResults(prisma as any, this.roomId, this.state.currentRound + 1, this.state.wildRank, scores, allPlayers);
  }

  private async persistMatchEnd(): Promise<void> {
    const allPlayers = Array.from(this.state.players).filter(Boolean) as Player[];
    await persistMatchEnd(prisma as any, this.roomId, allPlayers);
  }

  async onJoin(client: any, _options: any) {
    const timeout = this.disconnectTimeouts.get(client.auth.userId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(client.auth.userId);
    }

    const existingPlayer = this.state.players.find(
      (p) => p.userId === client.auth.userId,
    );
    if (existingPlayer) {
      existingPlayer.sessionId = client.sessionId;
      existingPlayer.disconnected = false;

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

    prisma.user.update({
      where: { id: client.auth.userId },
      data: { lastSeen: new Date() },
    }).catch(() => {});

    // Auto-start if bots are present
    if (this.state.players.some((p) => p.isBot)) {
      const humanCount = this.state.players.filter((p) => !p.isBot).length;
      if (humanCount >= 1) {
        setTimeout(() => {
          if (this.state.status === "waiting") {
            startGame(this.state);
            this.setMetadata({ ...this.metadata, status: "playing" });
            this.afterTurnAction().catch(() => {});
          }
        }, 500);
      }
    }
  }

  onLeave(client: any) {
    const player = this.state.players.find(
      (p) => p.sessionId === client.sessionId,
    );
    if (!player) return;

    this.resolveMatch(client.sessionId);

    const timeout = setTimeout(() => {
      if (this.state.players.length === 0) {
        this.disconnect().catch(() => {});
      }
    }, 60_000);

    this.disconnectTimeouts.set(player.userId, timeout);
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
