export function computeWinRate(wins: number, totalMatches: number): number {
  return totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
}

export function computeAvgRank(results: { rank: number | null }[]): number {
  return results.length > 0
    ? Math.round((results.reduce((s, r) => s + (r.rank ?? 5), 0) / results.length) * 10) / 10
    : 0;
}

export function computeEloHistory(
  matchPlayers: { match: { endedAt: Date | null }; eloDelta: number; matchId: string }[],
): { date: string; elo: number }[] {
  let runningElo = 1000;
  const eloHistory: { date: string; elo: number }[] = [];
  for (const mp of matchPlayers) {
    if (!mp.match.endedAt) continue;
    runningElo += mp.eloDelta;
    eloHistory.push({
      date: mp.match.endedAt.toISOString().slice(0, 10),
      elo: runningElo,
    });
  }
  return eloHistory;
}

export function computePeakElo(eloHistory: { elo: number }[]): number {
  return eloHistory.reduce((peak, entry) => Math.max(peak, entry.elo), 1000);
}

export function computeTotalRoundsPlayed(
  matchPlayers: { match: { totalRounds: number } }[],
): number {
  return matchPlayers.reduce((sum, mp) => sum + mp.match.totalRounds, 0);
}

export function computeScoreHistory(
  results: { endedAt: Date; score: number }[],
): { matchId: string; date: string; score: number }[] {
  const history: { matchId: string; date: string; score: number }[] = [];
  for (const r of results) {
    history.push({
      matchId: "",
      date: r.endedAt.toISOString().slice(0, 10),
      score: r.score,
    });
  }
  return history;
}

export function computeRankDistribution(
  results: { rank: number | null }[],
): { rank: number; count: number }[] {
  const dist = new Map<number, number>();
  for (const r of results) {
    if (r.rank != null) dist.set(r.rank, (dist.get(r.rank) ?? 0) + 1);
  }
  return Array.from(dist.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => a.rank - b.rank);
}

export function computeWinStreaks(
  results: { rank: number | null }[],
): { longestGameWinStreak: number; currentGameWinStreak: number } {
  let longestGameWinStreak = 0;
  let currentRun = 0;
  for (const r of results) {
    if (r.rank === 1) {
      currentRun++;
      longestGameWinStreak = Math.max(longestGameWinStreak, currentRun);
    } else {
      currentRun = 0;
    }
  }
  return { longestGameWinStreak, currentGameWinStreak: currentRun };
}

export function computeCurrentForm(
  results: { rank: number | null; score: number }[],
): { result: "W" | "L"; score: number }[] {
  return results.slice(0, 10).map((r) => ({
    result: r.rank === 1 ? "W" as const : "L" as const,
    score: r.score,
  }));
}

export function computePercentiles(
  allStats: any[],
  playerStats: { elo: number; totalMatches: number; wins: number; biggestWinDiff: number | null; biggestGameLoss: number | null; biggestRoundLoss: number | null; mostRoundsWonInAGame: number | null; longestGameWinStreak: number },
  winRate: number,
): Record<string, number> {
  function pct(values: number[], playerVal: number, higherIsBetter: boolean): number {
    if (values.length === 0) return 50;
    const sorted = [...values].sort((a, b) => higherIsBetter ? a - b : b - a);
    const idx = sorted.findIndex((v) => higherIsBetter ? v >= playerVal : v <= playerVal);
    return Math.round(((idx === -1 ? values.length - 1 : idx) / (values.length - 1)) * 100);
  }

  const winRates = allStats.map((s: any) => s.totalMatches > 0 ? Math.round((s.wins / s.totalMatches) * 100) : 0);

  return {
    elo: pct(allStats.map((s: any) => s.elo), playerStats.elo, true),
    totalMatches: pct(allStats.map((s: any) => s.totalMatches), playerStats.totalMatches, true),
    winRate: pct(winRates, winRate, true),
    biggestWinDiff: pct(allStats.map((s: any) => s.biggestWinDiff ?? 0), playerStats.biggestWinDiff ?? 0, true),
    biggestGameLoss: pct(allStats.map((s: any) => s.biggestGameLoss ?? 0), playerStats.biggestGameLoss ?? 0, false),
    biggestRoundLoss: pct(allStats.map((s: any) => s.biggestRoundLoss ?? 0), playerStats.biggestRoundLoss ?? 0, false),
    mostRoundsWonInAGame: pct(allStats.map((s: any) => s.mostRoundsWonInAGame ?? 0), playerStats.mostRoundsWonInAGame ?? 0, true),
    longestGameWinStreak: pct(allStats.map((s: any) => s.longestGameWinStreak), playerStats.longestGameWinStreak, true),
  };
}
