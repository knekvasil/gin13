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
  rearrangeMelds,
} from "./game-engine";
import { ArraySchema } from "@colyseus/schema";

const RECONNECT_TIMEOUT_MS = 60_000;

export class GameRoom extends Room<GameState> {
  private disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

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
    });

    this.onMessage("draw", (client, msg: { source: "deck" | "discard" }) => {
      if (msg.source === "discard") {
        drawFromDiscard(this.state, client.sessionId);
      } else {
        drawFromDeck(this.state, client.sessionId);
      }
    });

    this.onMessage("meld", (client, msg: { cardIndices: number[] }) => {
      meldCards(this.state, client.sessionId, msg.cardIndices);
    });

    this.onMessage("pass_meld", (client) => {
      passMeld(this.state, client.sessionId);
    });

    this.onMessage("discard", (client, msg: { cardIndex: number }) => {
      discardCard(this.state, client.sessionId, msg.cardIndex);
    });

    this.onMessage("add_to_meld", (client, msg: { cardIndex: number; meldGroupId: string }) => {
      addToMeld(this.state, client.sessionId, msg.cardIndex, msg.meldGroupId);
    });

    this.onMessage("swap_wild", (client, msg: { meldGroupId: string; meldCardIndex: number; handCardIndex: number }) => {
      swapWild(this.state, client.sessionId, msg.meldGroupId, msg.meldCardIndex, msg.handCardIndex);
    });

    this.onMessage("rearrange_melds", (client, msg: { newMelds: { source: string; index: number }[][] }) => {
      rearrangeMelds(this.state, client.sessionId, msg.newMelds);
    });
  }

  async onJoin(client: any, _options: any) {
    const existingPlayer = this.state.players.find(
      (p) => p.userId === client.auth.userId,
    );
    if (existingPlayer) {
      existingPlayer.sessionId = client.sessionId;

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

    this.setMetadata({
      totalRounds: this.state.totalRounds,
      players: Math.max(0, this.clients.length - 1),
    });

    const timeout = setTimeout(() => {
      this.disconnectTimeouts.delete(userId);

      const idx = this.state.players.findIndex((p) => p.userId === userId);
      if (idx !== -1) {
        this.state.players.splice(idx, 1);
      }

      if (this.state.players.length === 0) {
        this.disconnect().catch(() => {});
      }
    }, RECONNECT_TIMEOUT_MS);

    this.disconnectTimeouts.set(userId, timeout);
  }

  async onDispose() {
    for (const timeout of this.disconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.disconnectTimeouts.clear();

    await prisma.match.update({
      where: { id: this.roomId },
      data: { status: "FINISHED", endedAt: new Date() },
    });
  }
}
