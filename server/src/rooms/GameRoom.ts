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
} from "./game-engine";
import { ArraySchema } from "@colyseus/schema";

export class GameRoom extends Room<GameState> {
  static async onAuth(token: string, _req: http.IncomingMessage) {
    const payload = verifyToken(token);
    if (!payload) return false;
    return { userId: payload.sub, name: payload.name };
  }

  async onCreate(options: any) {
    this.maxClients = 4;
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
  }

  async onJoin(client: any, _options: any) {
    const existingPlayer = this.state.players.find(
      (p) => p.userId === client.auth.userId,
    );
    if (existingPlayer) {
      existingPlayer.sessionId = client.sessionId;
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
      players: this.state.players.length,
    });
  }

  onLeave(client: any) {
    const idx = this.state.players.findIndex(
      (p) => p.sessionId === client.sessionId,
    );
    if (idx !== -1) {
      this.state.players.splice(idx, 1);
    }

    this.setMetadata({
      totalRounds: this.state.totalRounds,
      players: this.state.players.length,
    });
  }

  async onDispose() {
    await prisma.match.update({
      where: { id: this.roomId },
      data: { status: "FINISHED", endedAt: new Date() },
    });
  }
}
