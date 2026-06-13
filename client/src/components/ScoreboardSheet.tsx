import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import type { MatchDetail, MatchDetailPlayer, RoundScoreEntry } from "../stats/api";

function computeCumulative(roundScores: RoundScoreEntry[], userId: string): { round: number; cumulative: number }[] {
  let total = 0;
  return roundScores.map((rs) => {
    const entry = rs.scores.find((s) => s.userId === userId);
    total += entry?.handScore ?? 0;
    return { round: rs.roundNumber, cumulative: total };
  });
}

function computeDelta(roundScores: RoundScoreEntry[], userId: string): { round: number; delta: number }[] {
  return roundScores.map((rs) => {
    const entry = rs.scores.find((s) => s.userId === userId);
    return { round: rs.roundNumber, delta: entry?.handScore ?? 0 };
  });
}

const COLORS = ["var(--color-primary)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-5)"];

export default function ScoreboardSheet({ matchDetail }: { matchDetail: MatchDetail | null }) {
  if (!matchDetail) return null;

  const { players, roundScores, totalRounds } = matchDetail;
  const roundLabels = roundScores.map((rs) => {
    const w = rs.wildRank;
    if (w === 1) return "A";
    if (w === 11) return "J";
    if (w === 12) return "Q";
    if (w === 13) return "K";
    return String(w);
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed right-2 top-2 z-40 text-[10px]"
        >
          Scores
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[90vw] max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Scoreboard</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Score table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-border border-b">
                  <th className="px-2 py-1 text-left font-medium">Player</th>
                  {roundLabels.map((l, i) => (
                    <th key={i} className="px-1.5 py-1 text-right font-medium tabular-nums">
                      {l}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  let cumulative = 0;
                  return (
                    <tr key={p.userId} className="border-border/50 border-b">
                      <td className="px-2 py-1 font-medium">{p.displayName}</td>
                      {roundScores.map((rs) => {
                        const entry = rs.scores.find((s) => s.userId === p.userId);
                        cumulative += entry?.handScore ?? 0;
                        return (
                          <td key={rs.roundNumber} className="px-1.5 py-1 text-right tabular-nums">
                            {entry?.handScore ?? "-"}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-right font-bold tabular-nums">{p.totalScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cumulative score chart */}
          <div>
            <p className="text-muted-foreground mb-2 text-[0.65rem] font-medium uppercase tracking-wider">
              Cumulative Points
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <XAxis
                    dataKey="round"
                    ticks={roundScores.map((r) => r.roundNumber)}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  {players.map((p, i) => {
                    const data = computeCumulative(roundScores, p.userId);
                    return (
                      <Line
                        key={p.userId}
                        data={data}
                        type="monotone"
                        dataKey="cumulative"
                        name={p.displayName}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-round delta chart */}
          <div>
            <p className="text-muted-foreground mb-2 text-[0.65rem] font-medium uppercase tracking-wider">
              Points Per Round
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roundScores.map((rs) => {
                  const obj: Record<string, number | string> = { round: rs.roundNumber };
                  for (const p of players) {
                    const entry = rs.scores.find((s) => s.userId === p.userId);
                    obj[p.userId] = entry?.handScore ?? 0;
                  }
                  return obj;
                })}>
                  <XAxis
                    dataKey="round"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  {players.map((p, i) => (
                    <Bar
                      key={p.userId}
                      dataKey={p.userId}
                      name={p.displayName}
                      fill={COLORS[i % COLORS.length]}
                      radius={[2, 2, 0, 0]}
                      stackId="a"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
