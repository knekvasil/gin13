import { Router, Request, Response } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/league/current", async (_req: Request, res: Response) => {
  try {
    const season = await prisma.botSeason.findFirst({
      where: { endedAt: null },
      include: {
        standings: { orderBy: { matchPoints: "desc" } },
        rounds: { orderBy: { roundNumber: "asc" } },
      },
    });

    if (!season) {
      res.json({ season: null });
      return;
    }

    const botIds = season.standings.map((s: any) => s.botId);
    const users = (await prisma.user.findMany({
      where: { id: { in: botIds } },
    })) as any[];
    const nameMap = new Map(users.map((u: any) => [u.id, u.displayName]));

    const playerStats = (await prisma.playerStats.findMany({
      where: { userId: { in: botIds } },
    })) as any[];
    const eloMap = new Map(playerStats.map((s: any) => [s.userId, s.elo]));

    const completedRounds = season.rounds.filter((r: any) => r.status === "COMPLETE").length;

    const botMatches = (await prisma.botMatch.findMany({
      where: { round: { seasonId: season.id, status: "COMPLETE" } },
      include: { round: true },
    })) as any[];

    const matchIds = botMatches.map((bm: any) => bm.matchId);
    const matchPlayers = (await prisma.matchPlayer.findMany({
      where: { matchId: { in: matchIds } },
    })) as any[];

    const placementMap = new Map<string, Map<number, number>>();
    for (const bm of botMatches) {
      for (const mp of matchPlayers) {
        if (mp.matchId !== bm.matchId) continue;
        if (mp.finalRank == null) continue;
        let botPlacements = placementMap.get(mp.userId);
        if (!botPlacements) {
          botPlacements = new Map();
          placementMap.set(mp.userId, botPlacements);
        }
        botPlacements.set(bm.round.roundNumber, mp.finalRank);
      }
    }

    const standings = season.standings.map((s: any) => {
      const placements = placementMap.get(s.botId);
      const roundRanks: (number | null)[] = [];
      for (let r = 1; r <= season.roundCount; r++) {
        roundRanks.push(placements?.get(r) ?? null);
      }
      return {
        botId: s.botId,
        name: nameMap.get(s.botId) ?? s.botId,
        matchPoints: s.matchPoints,
        matchesPlayed: s.matchesPlayed,
        elo: eloMap.get(s.botId) ?? 1000,
        roundRanks,
      };
    });

    res.json({
      season: {
        id: season.id,
        name: season.name,
        roundCount: season.roundCount,
        currentRound: completedRounds + 1,
        standings,
      },
    });
  } catch (err) {
    console.error("league current error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/league/seasons", async (_req: Request, res: Response) => {
  try {
    const seasons = (await prisma.botSeason.findMany({
      orderBy: { startedAt: "desc" },
      include: {
        standings: { orderBy: { matchPoints: "desc" }, take: 3 },
      },
    })) as any[];

    const list = seasons.map((s) => ({
      id: s.id,
      name: s.name,
      roundCount: s.roundCount,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      topThree: s.standings.map((st: any) => ({ botId: st.botId, matchPoints: st.matchPoints })),
    }));

    res.json({ seasons: list });
  } catch (err) {
    console.error("league seasons error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/league/rounds/:seasonId", async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;

    const season = await prisma.botSeason.findUnique({
      where: { id: seasonId },
    });
    if (!season) {
      res.status(404).json({ error: "season not found" });
      return;
    }

    const rounds = (await prisma.botRound.findMany({
      where: { seasonId },
      orderBy: { roundNumber: "asc" },
      include: { matches: true },
    })) as any[];

    const allMatchIds = rounds.flatMap((r: any) => r.matches.map((m: any) => m.matchId));

    const matchPlayers = (await prisma.matchPlayer.findMany({
      where: { matchId: { in: allMatchIds } },
      orderBy: { finalRank: "asc" },
    })) as any[];

    const matchPlayerMap = new Map<string, any[]>();
    for (const mp of matchPlayers) {
      const arr = matchPlayerMap.get(mp.matchId) ?? [];
      arr.push(mp);
      matchPlayerMap.set(mp.matchId, arr);
    }

    const botIds = [...new Set(matchPlayers.map((mp: any) => mp.userId))];
    const users = (await prisma.user.findMany({
      where: { id: { in: botIds } },
    })) as any[];
    const nameMap = new Map(users.map((u: any) => [u.id, u.displayName]));

    const roundDetails = rounds.map((r: any) => ({
      roundNumber: r.roundNumber,
      status: r.status,
      pods: r.matches.map((m: any) => ({
        matchId: m.matchId,
        results: (matchPlayerMap.get(m.matchId) ?? []).map((mp: any) => ({
          botId: mp.userId,
          name: nameMap.get(mp.userId) ?? mp.userId,
          rank: mp.finalRank,
          score: mp.score,
        })),
      })),
    }));

    res.json({ seasonName: season.name, rounds: roundDetails });
  } catch (err) {
    console.error("league rounds error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/league/bot/:botId", async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: botId } }) as any;
    if (!user) {
      res.status(404).json({ error: "bot not found" });
      return;
    }

    const stats = await prisma.playerStats.findUnique({ where: { userId: botId } }) as any;

    const seasonStandings = (await prisma.botStanding.findMany({
      where: { botId },
      include: { season: true },
      orderBy: { season: { startedAt: "desc" } },
    })) as any[];

    const matchResults = (await prisma.playerMatchResult.findMany({
      where: { userId: botId },
      orderBy: { endedAt: "desc" },
      take: 50,
    })) as any[];

    const seasons = seasonStandings.map((ss: any) => ({
      seasonId: ss.season.id,
      seasonName: ss.season.name,
      matchPoints: ss.matchPoints,
      matchesPlayed: ss.matchesPlayed,
    }));

    const eloHistory = [...matchResults].reverse().reduce((acc: any[], r: any) => {
      const prev = acc.length > 0 ? acc[acc.length - 1]!.elo : 1000;
      acc.push({ date: r.endedAt, elo: prev + (r.eloDelta ?? 0) });
      return acc;
    }, [] as any[]);

    res.json({
      botId: user.id,
      name: user.displayName,
      totalMatches: stats?.totalMatches ?? 0,
      wins: stats?.wins ?? 0,
      elo: stats?.elo ?? 1000,
      seasons,
      eloHistory,
    });
  } catch (err) {
    console.error("league bot error", err);
    res.status(500).json({ error: "internal server error" });
  }
});

export default router;
