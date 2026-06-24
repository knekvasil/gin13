import { Client } from "colyseus.js";

const WS_URL = import.meta.env.DEV
  ? "ws://localhost:2567"
  : window.location.origin.replace(/^http/, "ws");

export function createColyseusClient(token: string): Client {
  return new Client(WS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
