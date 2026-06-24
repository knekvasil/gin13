import { Client } from "colyseus.js";

const WS_URL = location.port === "5173"
  ? "ws://localhost:2567"
  : location.origin.replace(/^http/, "ws");

export function createColyseusClient(token: string): Client {
  return new Client(WS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
