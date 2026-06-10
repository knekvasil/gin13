import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import http from "http";

const mockMatchPlayerFindMany = vi.fn();
const mockRoundResultFindMany = vi.fn();

vi.mock("../db", () => ({
  prisma: {
    matchPlayer: {
      findMany: (...args: any[]) => mockMatchPlayerFindMany(...args),
    },
    roundResult: {
      findMany: (...args: any[]) => mockRoundResultFindMany(...args),
    },
  },
}));

let statsRouter: import("express").Router;

  let server: http.Server;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    const mod = await import("./stats");
    statsRouter = mod.default;

    const app = express();
    app.use(express.json());
    app.use("/", statsRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /leaderboard", () => {
    it("returns ranked list of players by total score (ascending)", async () => {
      mockMatchPlayerFindMany.mockResolvedValue([
        { id: "1", matchId: "m1", userId: "user1", score: 50, finalRank: 1, user: { id: "user1", displayName: "Alice" } },
        { id: "2", matchId: "m1", userId: "user2", score: 80, finalRank: 2, user: { id: "user2", displayName: "Bob" } },
        { id: "3", matchId: "m2", userId: "user1", score: 30, finalRank: 1, user: { id: "user1", displayName: "Alice" } },
        { id: "4", matchId: "m2", userId: "user3", score: 60, finalRank: 2, user: { id: "user3", displayName: "Charlie" } },
      ]);

      mockRoundResultFindMany.mockResolvedValue([
        { id: "r1", matchId: "m1", roundNumber: 1, playerId: "user1", handScore: 10 },
        { id: "r2", matchId: "m1", roundNumber: 1, playerId: "user2", handScore: 20 },
        { id: "r3", matchId: "m1", roundNumber: 2, playerId: "user1", handScore: 15 },
        { id: "r4", matchId: "m1", roundNumber: 2, playerId: "user2", handScore: 5 },
        { id: "r5", matchId: "m2", roundNumber: 1, playerId: "user1", handScore: 8 },
        { id: "r6", matchId: "m2", roundNumber: 1, playerId: "user3", handScore: 12 },
      ]);

      const res = await fetch(`${baseUrl}/leaderboard`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveLength(3);
      expect(data[0].totalScore).toBeLessThanOrEqual(data[1].totalScore);
      expect(data[1].totalScore).toBeLessThanOrEqual(data[2].totalScore);
      expect(data[0].userId).toBe("user3");
      expect(data[1].userId).toBe("user1");
      expect(data[2].userId).toBe("user2");
      expect(data[0].roundWins).toBe(0);
      expect(data[1].roundWins).toBe(2);
      expect(data[2].roundWins).toBe(1);
    });
  });

  describe("GET /matches/:userId", () => {
    it("returns match history for a user", async () => {
      const now = new Date();
      mockMatchPlayerFindMany.mockResolvedValue([
        {
          id: "mp1",
          matchId: "m1",
          userId: "user1",
          score: 50,
          finalRank: 1,
          match: { id: "m1", totalRounds: 13, endedAt: new Date(now.getTime() - 86400000), status: "FINISHED", createdAt: new Date(now.getTime() - 90000000) },
        },
        {
          id: "mp2",
          matchId: "m2",
          userId: "user1",
          score: 80,
          finalRank: 3,
          match: { id: "m2", totalRounds: 10, endedAt: now, status: "FINISHED", createdAt: new Date(now.getTime() - 3600000) },
        },
      ]);

      const res = await fetch(`${baseUrl}/matches/user1`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        matchId: "m2",
        date: now.toISOString(),
        finalRank: 3,
        totalScore: 80,
        totalRounds: 10,
      });
      expect(data[1]).toEqual({
        matchId: "m1",
        date: new Date(now.getTime() - 86400000).toISOString(),
        finalRank: 1,
        totalScore: 50,
        totalRounds: 13,
      });
    });
  });
