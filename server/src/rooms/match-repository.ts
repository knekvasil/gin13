import type { Player } from "./GameState";
import { computeEloDeltas } from "./elo";

type PrismaClient = {
  roundResult: {
    create: (data: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
  matchPlayer: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
  };
  playerStats: {
    findMany: (args: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
  };
  playerMatchResult: {
    create: (data: any) => Promise<any>;
  };
  match: {
    update: (args: any) => Promise<any>;
  };
};

export async function persistRoundResults(
  db: PrismaClient,
  matchId: string,
  roundNumber: number,
  wildRank: number,
  scores: Map<string, number>,
  players: Array<Player>,
): Promise<void> {
  for (const player of players) {
    const handScore = scores.get(player.sessionId) ?? 0;
    await db.roundResult.create({
      data: {
        matchId,
        roundNumber,
        wildRank,
        playerId: player.userId,
        handScore,
      },
    }).catch(() => {});
  }
}

export async function persistMatchEnd(
  db: PrismaClient,
  matchId: string,
  players: Array<Player>,
): Promise<void> {
  type RoundResultRow = { playerId: string; roundNumber: number; handScore: number };
  const roundResults = (await db.roundResult.findMany({
    where: { matchId },
  })) as unknown as RoundResultRow[];

  const roundWinsPerPlayer = new Map<string, number>();
  const maxHandScorePerPlayer = new Map<string, number>();
  const opponentScoresInWonRounds = new Map<string, number[]>();

  const roundsByNumber = new Map<number, RoundResultRow[]>();
  for (const rr of roundResults) {
    const group = roundsByNumber.get(rr.roundNumber) ?? [];
    group.push(rr);
    roundsByNumber.set(rr.roundNumber, group);
  }

  for (const entries of roundsByNumber.values()) {
    const minScore = Math.min(...entries.map((e: RoundResultRow) => e.handScore));
    const winners = entries.filter((e: RoundResultRow) => e.handScore === minScore);
    for (const winner of winners) {
      const prev = roundWinsPerPlayer.get(winner.playerId) ?? 0;
      roundWinsPerPlayer.set(winner.playerId, prev + 1);

      const oppSum = entries
        .filter((e: RoundResultRow) => e.playerId !== winner.playerId)
        .reduce((s: number, e: RoundResultRow) => s + e.handScore, 0);
      const arr = opponentScoresInWonRounds.get(winner.playerId) ?? [];
      arr.push(oppSum);
      opponentScoresInWonRounds.set(winner.playerId, arr);
    }
    for (const entry of entries) {
      const prev = maxHandScorePerPlayer.get(entry.playerId) ?? 0;
      if (entry.handScore > prev) {
        maxHandScorePerPlayer.set(entry.playerId, entry.handScore);
      }
    }
  }

  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const rankedPlayers = sortedPlayers.map((p, i) => ({ player: p, rank: i + 1 }));
  const winDiff = sortedPlayers.length >= 2 ? sortedPlayers[1]!.score - sortedPlayers[0]!.score : 0;

  const userIds = rankedPlayers.map((rp) => rp.player.userId);
  const existingStats = await db.playerStats.findMany({
    where: { userId: { in: userIds } },
  });
  const eloMap = new Map<string, number>(existingStats.map((s: any) => [s.userId, s.elo]));

  const eloInputs = rankedPlayers.map((rp) => ({
    userId: rp.player.userId,
    currentElo: eloMap.get(rp.player.userId) ?? 1000,
  }));
  const eloDeltas = computeEloDeltas(eloInputs);

  for (const entry of rankedPlayers) {
    const p = entry.player;
    const rank = entry.rank;

    const matchPlayer = await db.matchPlayer.findUnique({
      where: { matchId_userId: { matchId, userId: p.userId } },
    });
    if (!matchPlayer) continue;

    const eloBefore = eloMap.get(p.userId) ?? 1000;
    const eloDelta = eloDeltas.get(p.userId) ?? 0;

    await db.matchPlayer.update({
      where: { id: matchPlayer.id },
      data: { score: p.score, finalRank: rank, eloBefore, eloDelta },
    });

    const roundWins = roundWinsPerPlayer.get(p.userId) ?? 0;
    const biggestRoundLoss = maxHandScorePerPlayer.get(p.userId) ?? null;
    const opponentPoints = opponentScoresInWonRounds.get(p.userId) ?? [];
    const maxOpponentPoints = opponentPoints.length > 0 ? Math.max(...opponentPoints) : null;
    const isWin = rank === 1;

    const existing = await db.playerStats.findUnique({
      where: { userId: p.userId },
    });

    await db.playerStats.upsert({
      where: { userId: p.userId },
      create: {
        userId: p.userId,
        elo: 1000 + eloDelta,
        totalMatches: 1,
        wins: isWin ? 1 : 0,
        totalScore: p.score,
        roundWins,
        biggestRoundLoss,
        mostRoundsWonInAGame: roundWins || null,
        maxOpponentPointsInWonRound: maxOpponentPoints,
        biggestGameWin: isWin ? p.score : null,
        biggestGameLoss: !isWin ? p.score : null,
        biggestWinDiff: isWin ? winDiff : null,
      },
      update: {
        elo: { increment: eloDelta },
        totalMatches: { increment: 1 },
        wins: isWin ? { increment: 1 } : undefined,
        totalScore: { increment: p.score },
        roundWins: { increment: roundWins },
        biggestRoundLoss: biggestRoundLoss != null && (existing?.biggestRoundLoss == null || biggestRoundLoss > existing.biggestRoundLoss)
          ? { set: biggestRoundLoss }
          : undefined,
        mostRoundsWonInAGame: roundWins > 0 && (existing?.mostRoundsWonInAGame == null || roundWins > existing.mostRoundsWonInAGame)
          ? { set: roundWins }
          : undefined,
        maxOpponentPointsInWonRound: maxOpponentPoints != null && (existing?.maxOpponentPointsInWonRound == null || maxOpponentPoints > existing.maxOpponentPointsInWonRound)
          ? { set: maxOpponentPoints }
          : undefined,
        biggestGameWin: isWin && (existing?.biggestGameWin == null || p.score < existing.biggestGameWin)
          ? { set: p.score }
          : undefined,
        biggestGameLoss: !isWin && (existing?.biggestGameLoss == null || p.score > existing.biggestGameLoss)
          ? { set: p.score }
          : undefined,
        biggestWinDiff: isWin && (existing?.biggestWinDiff == null || winDiff > existing.biggestWinDiff)
          ? { set: winDiff }
          : undefined,
      },
    });

    await db.playerMatchResult.create({
      data: {
        userId: p.userId,
        matchId,
        rank,
        score: p.score,
        roundsWon: roundWins,
        endedAt: new Date(),
      },
    });
  }

  await db.match.update({
    where: { id: matchId },
    data: { status: "FINISHED", endedAt: new Date() },
  });
}
