import http from "http";
import { Room } from "colyseus";
import { verifyToken } from "../auth";
import { prisma } from "../db";
import { Player, createGameState } from "./GameState";
import type { GameState } from "./GameState";

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
  }

  async onJoin(client: any, _options: any) {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.userId = client.auth.userId;
    player.name = client.auth.name;
    this.state.players.push(player);

    await prisma.matchPlayer.create({
      data: {
        matchId: this.roomId,
        userId: client.auth.userId,
      },
    });

    this.setMetadata({
      totalRounds: this.state.totalRounds,
      players: this.state.players.length,
    });
  }

  onLeave(client: any) {
    const idx = this.state.players.findIndex(
      (p) => p.sessionId === client.sessionId
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
