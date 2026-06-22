export function computeEloDeltas(
  rankedPlayers: { userId: string; currentElo: number }[],
): Map<string, number> {
  const K = 32;
  const deltas = new Map<string, number>();
  const count = new Map<string, number>();

  for (let i = 0; i < rankedPlayers.length; i++) {
    for (let j = i + 1; j < rankedPlayers.length; j++) {
      const higher = rankedPlayers[i]!;
      const lower = rankedPlayers[j]!;
      const expected = 1 / (1 + Math.pow(10, (lower.currentElo - higher.currentElo) / 400));
      deltas.set(higher.userId, (deltas.get(higher.userId) ?? 0) + K * (1 - expected));
      deltas.set(lower.userId, (deltas.get(lower.userId) ?? 0) + K * (0 - (1 - expected)));
      count.set(higher.userId, (count.get(higher.userId) ?? 0) + 1);
      count.set(lower.userId, (count.get(lower.userId) ?? 0) + 1);
    }
  }

  for (const userId of deltas.keys()) {
    const c = count.get(userId) ?? 1;
    deltas.set(userId, Math.round(deltas.get(userId)! / c));
  }
  return deltas;
}
