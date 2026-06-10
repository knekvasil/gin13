import http from "http";
import { Room } from "colyseus";
import { verifyToken } from "../auth";

export class GameRoom extends Room {
  static async onAuth(token: string, _req: http.IncomingMessage) {
    const payload = verifyToken(token);
    if (!payload) return false;
    return { userId: payload.sub, name: payload.name };
  }

  onCreate(_options: any) {
    this.maxClients = 4;
  }
}
