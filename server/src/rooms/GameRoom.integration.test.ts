import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import http from "http";
import { Server } from "colyseus";
import { Client } from "colyseus.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] || "dev-secret-change-in-production";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockMatchPlayerCreate = vi.fn();

vi.mock("../db", () => ({
  prisma: {
    match: {
      create: (...args: any[]) => mockCreate(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    matchPlayer: {
      create: (...args: any[]) => mockMatchPlayerCreate(...args),
    },
  },
}));

const { GameRoom } = await import("./GameRoom");

describe("GameRoom integration", () => {
  let httpServer: http.Server;
  let colyseusServer: Server;
  let port: number;
  const testToken = jwt.sign({ sub: "test-user-id", name: "TestPlayer" }, JWT_SECRET);

  beforeAll(async () => {
    httpServer = http.createServer();
    colyseusServer = new Server({ server: httpServer });
    colyseusServer.define("game_room", GameRoom);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockMatchPlayerCreate.mockResolvedValue({});
  });

  function authedClient() {
    return new Client(`ws://localhost:${port}`, {
      headers: { Authorization: `Bearer ${testToken}` },
    });
  }

  it("creates a Match record when a room is created", async () => {
    mockCreate.mockResolvedValue({ id: "test-id", totalRounds: 10, status: "WAITING" });
    mockMatchPlayerCreate.mockResolvedValue({});

    const client = authedClient();
    const room = await client.create("game_room", { totalRounds: 10 });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.totalRounds).toBe(10);
    expect(createCall.data.status).toBe("WAITING");

    expect(mockMatchPlayerCreate).toHaveBeenCalledTimes(1);
    const joinCall = mockMatchPlayerCreate.mock.calls[0][0];
    expect(joinCall.data.matchId).toBe(room.roomId);
    expect(joinCall.data.userId).toBe("test-user-id");

    room.leave();
  });

  it("uses default totalRounds of 13 when not specified", async () => {
    mockCreate.mockResolvedValue({});
    mockMatchPlayerCreate.mockResolvedValue({});

    const client = authedClient();
    const room = await client.create("game_room", {});

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].data.totalRounds).toBe(13);
    expect(mockCreate.mock.calls[0][0].data.status).toBe("WAITING");

    room.leave();
  });

  it("sets room metadata for lobby listing", async () => {
    mockCreate.mockResolvedValue({});
    mockMatchPlayerCreate.mockResolvedValue({});

    const client = authedClient();
    const room = await client.create("game_room", { totalRounds: 7 });

    const rooms = await client.getAvailableRooms("game_room");
    const listing = rooms.find((r) => r.roomId === room.roomId);
    expect(listing).toBeDefined();
    expect(listing!.metadata).toBeDefined();
    expect(listing!.metadata.totalRounds).toBe(7);
    expect(listing!.metadata.players).toBe(1);

    room.leave();
  });

  it("updates player count in metadata when a second player joins", async () => {
    mockCreate.mockResolvedValue({});
    mockMatchPlayerCreate.mockResolvedValue({});

    const client1 = authedClient();
    const room = await client1.create("game_room", {});

    const token2 = jwt.sign({ sub: "user-2", name: "Player2" }, JWT_SECRET);
    const client2 = new Client(`ws://localhost:${port}`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const room2 = await client2.joinById(room.roomId);

    const rooms = await client1.getAvailableRooms("game_room");
    const listing = rooms.find((r) => r.roomId === room.roomId);
    expect(listing!.metadata.players).toBe(2);

    room.leave();
    room2.leave();
  });
});
