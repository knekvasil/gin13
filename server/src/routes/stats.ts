import { Router, Request, Response } from "express";
import { prisma } from "../db";

interface MatchPlayerWithUser {
  userId: string;
  score: number;
  user: { id: string; displayName: string };
}

interface RoundResultRow {
  matchId: string;
  roundNumber: number;
  playerId: string;
  handScore: number;
}

const router = Router();

router.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const matchPlayers = (await prisma.matchPlayer.findMany({
      where: {
        match: { status: "FINISHED" },
      },
      include: {
        user: { select: { id: true, displayName: true } },
      },
    })) as MatchPlayerWithUser[];

    const scoreMap = new Map<string, { userId: string; displayName: string; totalScore: number }>();
    for (const mp of matchPlayers) {
      const existing = scoreMap.get(mp.userId);
      if (existing) {
        existing.totalScore += mp.score;
      } else {
        scoreMap.set(mp.userId, {
          userId: mp.userId,
          displayName: mp.user.displayName,
          totalScore: mp.score,
        });
      }
    }

    const roundResults = (await prisma.roundResult.findMany({
      where: {
        match: { status: "FINISHED" },
      },
    })) as RoundResultRow[];

    const sorted = [...roundResults].sort((a, b) => {
      if (a.matchId !== b.matchId) return a.matchId.localeCompare(b.matchId);
      if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
      return a.handScore - b.handScore;
    });

    const roundWins = new Map<string, number>();
    const seenRound = new Set<string>();
    for (const rr of sorted) {
      const key = `${rr.matchId}:${rr.roundNumber}`;
      if (!seenRound.has(key)) {
        seenRound.add(key);
        roundWins.set(rr.playerId, (roundWins.get(rr.playerId) ?? 0) + 1);
      }
    }

    const leaderboard = Array.from(scoreMap.values()).map((entry) => ({
      ...entry,
      roundWins: roundWins.get(entry.userId) ?? 0,
    }));

    leaderboard.sort((a, b) => a.totalScore - b.totalScore);

    res.json(leaderboard);
  } catch (err) {
    console.error("leaderboard error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/matches/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { userId },
      include: {
        match: { select: { id: true, totalRounds: true, endedAt: true, status: true, createdAt: true } },
      },
    });

    interface MatchPlayerWithMatch {
      matchId: string;
      userId: string;
      score: number;
      finalRank: number | null;
      match: { id: string; totalRounds: number; endedAt: Date | null; status: string; createdAt: Date };
    }

    const history = (matchPlayers as MatchPlayerWithMatch[])
      .filter((mp) => mp.match.status === "FINISHED" && mp.match.endedAt !== null)
      .map((mp) => ({
        matchId: mp.matchId,
        date: mp.match.endedAt!.toISOString(),
        finalRank: mp.finalRank,
        totalScore: mp.score,
        totalRounds: mp.match.totalRounds,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(history);
  } catch (err) {
    console.error("match history error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

export default router;
