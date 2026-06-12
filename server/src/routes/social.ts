import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const router = Router();

const JWT_SECRET = process.env["JWT_SECRET"] || "dev-secret-change-in-production";

function authenticate(req: Request, res: Response): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing authorization header" });
    return null;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string; name: string };
    return payload.sub;
  } catch {
    res.status(401).json({ error: "invalid token" });
    return null;
  }
}

router.get("/users/search", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const q = (req.query.q as string) ?? "";
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const users = await prisma.user.findMany({
      where: {
        displayName: { contains: q, mode: "insensitive" },
        id: { not: userId },
      },
      select: { id: true, displayName: true },
      take: 20,
    });
    res.json(users);
  } catch (err) {
    console.error("user search error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.post("/heartbeat", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeen: new Date() },
  }).catch(() => {});
  res.json({ ok: true });
});

router.get("/friends", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const sent = await prisma.friendship.findMany({
      where: { userId, status: "ACCEPTED" },
      include: { friend: { select: { id: true, displayName: true } } },
    });
    const received = await prisma.friendship.findMany({
      where: { friendId: userId, status: "ACCEPTED" },
      include: { user: { select: { id: true, displayName: true } } },
    });
    const friends = [
      ...sent.map((f: any) => ({ id: f.friend.id, displayName: f.friend.displayName, since: f.createdAt })),
      ...received.map((f: any) => ({ id: f.user.id, displayName: f.user.displayName, since: f.createdAt })),
    ];
    res.json(friends);
  } catch (err) {
    console.error("list friends error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/friends/status", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const sent = await prisma.friendship.findMany({
      where: { userId, status: "ACCEPTED" },
      select: { friendId: true },
    });
    const received = await prisma.friendship.findMany({
      where: { friendId: userId, status: "ACCEPTED" },
      select: { userId: true },
    });

    const friendIds = [
      ...sent.map((f: any) => f.friendId),
      ...received.map((f: any) => f.userId),
    ];

    if (friendIds.length === 0) {
      res.json([]);
      return;
    }

    const friends = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, lastSeen: true },
    });

    const activeMatchPlayers = await prisma.matchPlayer.findMany({
      where: {
        userId: { in: friendIds },
        match: { status: "ACTIVE" },
      },
      select: { userId: true },
    });

    const playerStats = await prisma.playerStats.findMany({
      where: { userId: { in: friendIds } },
      select: { userId: true, elo: true },
    });
    const eloMap = new Map(playerStats.map((ps: any) => [ps.userId, ps.elo]));

    const inGameIds = new Set(activeMatchPlayers.map((mp: any) => mp.userId));

    const result = friends.map((f: any) => ({
      userId: f.id,
      inGame: inGameIds.has(f.id),
      lastSeen: f.lastSeen?.toISOString() ?? null,
      elo: eloMap.get(f.id) ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error("friends status error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/friends/pending", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const sent = await prisma.friendship.findMany({
      where: { userId, status: "PENDING" },
      include: { friend: { select: { id: true, displayName: true } } },
    });
    const received = await prisma.friendship.findMany({
      where: { friendId: userId, status: "PENDING" },
      include: { user: { select: { id: true, displayName: true } } },
    });
    res.json({
      outgoing: sent.map((f: any) => ({ id: f.id, friendId: f.friendId, displayName: f.friend.displayName, createdAt: f.createdAt })),
      incoming: received.map((f: any) => ({ id: f.id, userId: f.userId, displayName: f.user.displayName, createdAt: f.createdAt })),
    });
  } catch (err) {
    console.error("list pending error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.post("/friends/request", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { friendId } = req.body;
    if (!friendId || friendId === userId) {
      res.status(400).json({ error: "invalid friendId" });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id: friendId } });
    if (!target) {
      res.status(404).json({ error: "user not found" });
      return;
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status === "ACCEPTED") {
        res.status(409).json({ error: "already friends" });
        return;
      }
      if (existing.userId === userId) {
        res.status(409).json({ error: "request already sent" });
        return;
      }
      const updated = await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED" },
      });
      res.json(updated);
      return;
    }

    const friendship = await prisma.friendship.create({
      data: { userId, friendId },
    });
    res.status(201).json(friendship);
  } catch (err) {
    console.error("friend request error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.patch("/friends/request/:id/accept", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!friendship || friendship.friendId !== userId || friendship.status !== "PENDING") {
      res.status(404).json({ error: "request not found" });
      return;
    }
    const updated = await prisma.friendship.update({
      where: { id: req.params.id },
      data: { status: "ACCEPTED" },
    });
    res.json(updated);
  } catch (err) {
    console.error("accept request error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.patch("/friends/request/:id/decline", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!friendship || friendship.friendId !== userId || friendship.status !== "PENDING") {
      res.status(404).json({ error: "request not found" });
      return;
    }
    await prisma.friendship.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("decline request error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.delete("/friends/:friendId", async (req: Request, res: Response) => {
  const userId = authenticate(req, res);
  if (!userId) return;

  try {
    const { friendId } = req.params;
    const sent = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    const received = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: friendId, friendId: userId } },
    });
    if (sent) await prisma.friendship.delete({ where: { id: sent.id } });
    if (received) await prisma.friendship.delete({ where: { id: received.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("remove friend error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/recent-opponents/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { userId, match: { status: "FINISHED" } },
      select: { matchId: true, match: { select: { endedAt: true } } },
    });

    const matchIds = matchPlayers
      .filter((mp: any) => mp.match.endedAt)
      .map((mp: any) => mp.matchId);

    if (matchIds.length === 0) {
      res.json([]);
      return;
    }

    const opponents = await prisma.matchPlayer.findMany({
      where: { matchId: { in: matchIds }, userId: { not: userId } },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { matchId: "desc" },
    });

    const seen = new Set<string>();
    const result: { id: string; displayName: string; lastPlayed: string }[] = [];
    for (const opp of opponents) {
      if (!seen.has(opp.userId)) {
        seen.add(opp.userId);
        result.push({
          id: opp.user.id,
          displayName: opp.user.displayName,
          lastPlayed: new Date().toISOString(),
        });
      }
    }
    res.json(result.slice(0, 20));
  } catch (err) {
    console.error("recent opponents error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/headtohead/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { userId, match: { status: "FINISHED" } },
      select: { matchId: true, score: true, finalRank: true },
    });

    const matchIds = matchPlayers.map((mp: any) => mp.matchId);
    if (matchIds.length === 0) {
      res.json([]);
      return;
    }

    const opponents = await prisma.matchPlayer.findMany({
      where: { matchId: { in: matchIds }, userId: { not: userId } },
      select: { userId: true, matchId: true, finalRank: true, user: { select: { id: true, displayName: true } } },
    });

    const headMap = new Map<string, { displayName: string; matches: number; wins: number; losses: number }>();
    for (const opp of opponents) {
      const playerInMatch = matchPlayers.find((mp: any) => mp.matchId === opp.matchId);
      if (!playerInMatch) continue;

      const entry = headMap.get(opp.userId) ?? {
        displayName: opp.user.displayName,
        matches: 0,
        wins: 0,
        losses: 0,
      };
      entry.matches++;
      if (playerInMatch.finalRank === 1 && opp.finalRank !== 1) entry.wins++;
      else if (playerInMatch.finalRank !== 1 && opp.finalRank === 1) entry.losses++;
      headMap.set(opp.userId, entry);
    }

    const result = Array.from(headMap.entries())
      .map(([opponentId, data]) => ({ opponentId, ...data }))
      .sort((a, b) => b.matches - a.matches);

    res.json(result);
  } catch (err) {
    console.error("headtohead error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

export default router;
