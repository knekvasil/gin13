import { Router, Request, Response } from "express";
import { prisma } from "../db";
import {
  computeWinRate,
  computeAvgRank,
  computeEloHistory,
  computePeakElo,
  computeTotalRoundsPlayed,
  computeScoreHistory,
  computeRankDistribution,
  computeWinStreaks,
  computeCurrentForm,
  computePercentiles,
} from "../services/stats-service";

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

    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { userId, match: { status: "FINISHED" } },
      include: { match: { select: { endedAt: true, totalRounds: true } } },
      orderBy: { match: { endedAt: "asc" } },
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
        biggestWinDiff: null,
        totalRoundsPlayed: 0,
        peakElo: 1000,
        percentiles: {},
        scoreHistory: [],
        eloHistory: [],
        rankHistory: [],
        rankDistribution: [],
        longestGameWinStreak: 0,
        longestRoundWinStreak: 0,
        currentGameWinStreak: 0,
        currentForm: [],
      });
      return;
    }

    const winRate = computeWinRate(stats.wins, stats.totalMatches);
    const avgRank = computeAvgRank(results as any);
    const eloHistory = computeEloHistory(matchPlayers as any);
    const peakElo = computePeakElo(eloHistory);
    const totalRoundsPlayed = computeTotalRoundsPlayed(matchPlayers as any);
    const scoreHistory = computeScoreHistory(results as any);
    const rankDistribution = computeRankDistribution(results as any);
    const { longestGameWinStreak, currentGameWinStreak } = computeWinStreaks(results as any);
    const currentForm = computeCurrentForm(results as any);

    const rankHistory: { date: string; rank: number }[] = [];
    const resultsAsc = [...results].reverse();
    for (const r of resultsAsc) {
      if (r.rank != null) {
        rankHistory.push({
          date: r.endedAt.toISOString().slice(0, 10),
          rank: r.rank,
        });
      }
    }

    const allStats = (await prisma.playerStats.findMany()) as any[];
    const percentiles = computePercentiles(allStats, { ...stats, longestGameWinStreak }, winRate);

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
      biggestWinDiff: stats.biggestWinDiff,
      totalRoundsPlayed,
      peakElo,
      percentiles,
      scoreHistory,
      eloHistory,
      rankHistory,
      rankDistribution,
      longestGameWinStreak,
      currentGameWinStreak,
      currentForm,
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
      eloBefore: mp.eloBefore,
      eloDelta: mp.eloDelta,
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
