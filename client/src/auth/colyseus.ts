import { Client } from "colyseus.js";

const WS_URL = "ws://localhost:2567";

export function createColyseusClient(token: string): Client {
  return new Client(WS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
