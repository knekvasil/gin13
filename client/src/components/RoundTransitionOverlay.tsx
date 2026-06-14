import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { Button } from "../components/ui/button";
import type { MatchDetail } from "../stats/api";

function roundLabelForRoundNumber(roundNum: number): string {
  const wildRank = roundNum % 13 || 13;
  if (wildRank === 1) return "A";
  if (wildRank === 11) return "J";
  if (wildRank === 12) return "Q";
  if (wildRank === 13) return "K";
  return String(wildRank);
}

const COLORS = ["var(--color-primary)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-5)"];

export default function RoundTransitionOverlay({
  matchDetail,
  playerCumulativeScores,
  highlightRound,
  onContinue,
}: {
  matchDetail: MatchDetail;
  playerCumulativeScores: { userId: string; name: string; cumulativeScore: number }[];
  highlightRound: number;
  onContinue: () => void;
}) {
  const { roundScores, totalRounds } = matchDetail;
  const roundNumbers = Array.from({ length: totalRounds }, (_, i) => i + 1);

  const sorted = [...playerCumulativeScores].sort((a, b) => a.cumulativeScore - b.cumulativeScore);

  const playerTotals: Record<string, number> = {};
  const cumulativeChartData = roundNumbers.map((rn) => {
    const pr = roundScores.find((rs) => rs.roundNumber === rn);
    const point: Record<string, number | string | null> = { round: rn };
    for (const ps of playerCumulativeScores) {
      if (pr) {
        const entry = pr.scores.find((s) => s.userId === ps.userId);
        if (entry) playerTotals[ps.userId] = (playerTotals[ps.userId] ?? 0) + entry.handScore;
        point[ps.userId] = playerTotals[ps.userId] ?? null;
      } else {
        point[ps.userId] = null;
      }
    }
    return point;
  });

  const deltaChartData = roundNumbers.map((rn) => {
    const pr = roundScores.find((rs) => rs.roundNumber === rn);
    const point: Record<string, number | string | null> = { round: rn };
    for (const ps of playerCumulativeScores) {
      if (pr) {
        const entry = pr.scores.find((s) => s.userId === ps.userId);
        point[ps.userId] = entry?.handScore ?? null;
      } else {
        point[ps.userId] = null;
      }
    }
    return point;
  });
  const podium = sorted.slice(0, 3);

  function getRoundScore(userId: string) {
    const pr = roundScores.find((rs) => rs.roundNumber === highlightRound);
    return pr?.scores.find((s) => s.userId === userId)?.handScore ?? 0;
  }

  function playedRound(rn: number) {
    return roundScores.find((rs) => rs.roundNumber === rn);
  }

  const heightMap: Record<number, string> = { 1: "h-32", 2: "h-24", 3: "h-20" };
  const orderMap: Record<number, string> = { 1: "order-2", 2: "order-1", 3: "order-3" };
  const medalColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-gray-400", 3: "text-amber-700" };

  function PodiumSlot({ ps, place }: { ps: typeof sorted[number]; place: 1 | 2 | 3 }) {
    return (
      <div className={`flex flex-col items-center justify-end gap-2 ${orderMap[place]}`}>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {ps.name.charAt(0).toUpperCase()}
        </span>
        <p className="text-xs font-semibold text-center max-w-[80px] truncate">{ps.name}</p>
        <p className="text-xs tabular-nums">
          <span className="font-semibold">{ps.cumulativeScore}</span>
          <span className="text-muted-foreground"> (+{getRoundScore(ps.userId)})</span>
        </p>
        <span className={`text-2xl font-bold ${medalColors[place]}`}>{place}</span>
        <div className={`w-24 ${heightMap[place]} bg-muted rounded-t-lg flex items-center justify-center`}>
          <span className="text-lg font-bold tabular-nums">{ps.cumulativeScore}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto">
      <div className="bg-background rounded-lg border p-6 m-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6">
        {/* Podium */}
        <div className="flex items-end justify-center gap-4 pt-4">
          {podium.length >= 2 && <PodiumSlot ps={podium[1]} place={2} />}
          {podium.length >= 1 && <PodiumSlot ps={podium[0]} place={1} />}
          {podium.length >= 3 && <PodiumSlot ps={podium[2]} place={3} />}
        </div>

        {/* Horizontal score table with highlighted round column */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-1 text-left font-medium">Player</th>
                {roundNumbers.map((rn) => (
                  <th
                    key={rn}
                    className={`px-1.5 py-1 text-center font-medium tabular-nums ${
                      rn === highlightRound ? "bg-primary/10" : ""
                    }`}
                  >
                    {roundLabelForRoundNumber(rn)}
                  </th>
                ))}
                <th className="px-2 py-1 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ps) => {
                let cumulative = 0;
                return (
                  <tr key={ps.userId} className="border-border/50 border-b">
                    <td className="px-2 py-1 font-medium">{ps.name}</td>
                    {roundNumbers.map((rn) => {
                      const pr = playedRound(rn);
                      const entry = pr?.scores.find((s) => s.userId === ps.userId);
                      const val = entry?.handScore;
                      cumulative += val ?? 0;
                      return (
                        <td
                          key={rn}
                          className={`px-1.5 py-1 text-center tabular-nums ${
                            rn === highlightRound ? "bg-primary/10 font-bold" : ""
                          }`}
                        >
                          {val != null ? val : "-"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center font-bold tabular-nums">{ps.cumulativeScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Both charts stacked vertically */}
        <div className="space-y-4">
          <div>
            <p className="text-muted-foreground mb-2 text-[0.65rem] font-medium uppercase tracking-wider">
              Cumulative Points
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeChartData} margin={{ left: -8, right: 12, top: 4, bottom: 4 }}>
                  <XAxis
                    dataKey="round"
                    ticks={roundNumbers}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  {sorted.map((ps, i) => (
                    <Line
                      key={ps.userId}
                      type="monotone"
                      dataKey={ps.userId}
                      name={ps.name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      activeDot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-2 text-[0.65rem] font-medium uppercase tracking-wider">
              Points Per Round
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deltaChartData} margin={{ left: -8, right: 12, top: 4, bottom: 4 }}>
                  <XAxis
                    dataKey="round"
                    ticks={roundNumbers}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  {sorted.map((ps, i) => (
                    <Line
                      key={ps.userId}
                      type="monotone"
                      dataKey={ps.userId}
                      name={ps.name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      activeDot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <Button className="w-full" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
