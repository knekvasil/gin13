import { Router, Request, Response } from "express";
import { prisma } from "../db";

interface MatchPlayerWithScore {
  matchId: string;
  score: number;
  finalRank: number | null;
  match: { endedAt: Date | null };
}

const router = Router();

router.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const playerStats = await prisma.playerStats.findMany({
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { elo: "desc" },
    });

    const leaderboard = playerStats.map((ps: any, index: number) => ({
      rank: index + 1,
      userId: ps.userId,
      displayName: ps.user.displayName,
      elo: ps.elo,
      totalScore: ps.totalScore,
      wins: ps.wins,
      matches: ps.totalMatches,
      roundWins: ps.roundWins,
    }));

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

router.get("/stats/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const stats = await prisma.playerStats.findUnique({ where: { userId } });
    const results = await prisma.playerMatchResult.findMany({
      where: { userId },
      orderBy: { endedAt: "desc" },
      select: { rank: true, score: true, endedAt: true },
    });

    if (!stats) {
      res.json({
        elo: 1000,
        totalMatches: 0,
        wins: 0,
        winRate: 0,
        avgRank: 0,
        bestScore: 0,
        worstScore: 0,
        biggestRoundLoss: null,
        mostRoundsWonInAGame: null,
        maxOpponentPointsInWonRound: null,
        biggestGameWin: null,
        biggestGameLoss: null,
        scoreHistory: [],
        rankDistribution: [],
        longestGameWinStreak: 0,
        longestRoundWinStreak: 0,
        currentGameWinStreak: 0,
        currentForm: [],
      });
      return;
    }

    const winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
    const avgRank = results.length > 0
      ? Math.round((results.reduce((s: number, r: any) => s + (r.rank ?? 5), 0) / results.length) * 10) / 10
      : 0;

    const scoreHistory: { matchId: string; date: string; score: number }[] = [];
    for (const r of results) {
      scoreHistory.push({
        matchId: "",
        date: r.endedAt.toISOString().slice(0, 10),
        score: r.score,
      });
    }

    const dist = new Map<number, number>();
    for (const r of results) {
      if (r.rank != null) dist.set(r.rank, (dist.get(r.rank) ?? 0) + 1);
    }
    const rankDistribution = Array.from(dist.entries())
      .map(([rank, count]: [number, number]) => ({ rank, count }))
      .sort((a: any, b: any) => a.rank - b.rank);

    let longestGameWinStreak = 0;
    let currentGameWinStreak = 0;
    let currentRun = 0;
    for (const r of results) {
      if (r.rank === 1) {
        currentRun++;
        longestGameWinStreak = Math.max(longestGameWinStreak, currentRun);
      } else {
        currentRun = 0;
      }
    }
    currentGameWinStreak = currentRun;

    const form = results.slice(0, 10).map((r: any) => ({
      result: r.rank === 1 ? "W" : "L" as const,
      score: r.score,
    }));

    res.json({
      elo: stats.elo,
      totalMatches: stats.totalMatches,
      wins: stats.wins,
      winRate,
      avgRank,
      bestScore: stats.biggestGameWin ?? 0,
      worstScore: stats.biggestGameLoss ?? 0,
      biggestRoundLoss: stats.biggestRoundLoss,
      mostRoundsWonInAGame: stats.mostRoundsWonInAGame,
      maxOpponentPointsInWonRound: stats.maxOpponentPointsInWonRound,
      biggestGameWin: stats.biggestGameWin,
      biggestGameLoss: stats.biggestGameLoss,
      scoreHistory,
      rankDistribution,
      longestGameWinStreak,
      currentGameWinStreak,
      currentForm: form,
    });
  } catch (err) {
    console.error("stats error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/match/:matchId", async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        roundResults: true,
      },
    });

    if (!match) {
      res.status(404).json({ error: "match not found" });
      return;
    }

    const roundNumbers = [...new Set((match.roundResults as any[]).map((rr: any) => rr.roundNumber))].sort((a: number, b: number) => a - b);

    const players = (match.players as any[]).map((mp: any) => ({
      userId: mp.userId,
      displayName: mp.user.displayName,
      totalScore: mp.score,
      rank: mp.finalRank,
    }));

    const roundScores: { roundNumber: number; wildRank: number; scores: { userId: string; handScore: number }[] }[] = [];
    for (const rn of roundNumbers) {
      const entries = (match.roundResults as any[]).filter((rr: any) => rr.roundNumber === rn);
      roundScores.push({
        roundNumber: rn,
        wildRank: entries[0]?.wildRank ?? 0,
        scores: (match.players as any[]).map((mp: any) => {
          const rr = entries.find((e: any) => e.playerId === mp.userId);
          return { userId: mp.userId, handScore: rr?.handScore ?? 0 };
        }),
      });
    }

    res.json({
      matchId: match.id,
      totalRounds: match.totalRounds,
      players,
      roundScores,
    });
  } catch (err) {
    console.error("match detail error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

export default router;
