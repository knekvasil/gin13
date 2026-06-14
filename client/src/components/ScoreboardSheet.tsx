import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { BarChart3, Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";
import type { MatchDetail } from "../stats/api";

function roundLabelForWildRank(wildRank: number): string {
  if (wildRank === 1) return "A";
  if (wildRank === 11) return "J";
  if (wildRank === 12) return "Q";
  if (wildRank === 13) return "K";
  return String(wildRank);
}

function roundLabelForRoundNumber(roundNum: number): string {
  const wildRank = roundNum % 13 || 13;
  return roundLabelForWildRank(wildRank);
}

const COLORS = ["var(--color-primary)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-5)"];

function PlayerAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground ${className ?? ""}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function ScoreboardSheet({ matchDetail }: { matchDetail: MatchDetail | null }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const themeIcon = resolvedTheme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />;

  if (!matchDetail) return null;

  const { players, roundScores, totalRounds } = matchDetail;
  const roundNumbers = Array.from({ length: totalRounds }, (_, i) => i + 1);

  function playedRound(rn: number) {
    return roundScores.find((rs) => rs.roundNumber === rn);
  }

  const playerTotals: Record<string, number> = {};
  const cumulativeChartData = roundNumbers.map((rn) => {
    const pr = playedRound(rn);
    const point: Record<string, number | string | null> = { round: rn };
    for (const p of players) {
      if (pr) {
        const entry = pr.scores.find((s) => s.userId === p.userId);
        if (entry) playerTotals[p.userId] = (playerTotals[p.userId] ?? 0) + entry.handScore;
        point[p.userId] = playerTotals[p.userId] ?? null;
      } else {
        point[p.userId] = null;
      }
    }
    return point;
  });

  const deltaChartData = roundNumbers.map((rn) => {
    const pr = playedRound(rn);
    const point: Record<string, number | string | null> = { round: rn };
    for (const p of players) {
      if (pr) {
        const entry = pr.scores.find((s) => s.userId === p.userId);
        point[p.userId] = entry?.handScore ?? null;
      } else {
        point[p.userId] = null;
      }
    }
    return point;
  });

  return (
    <div className="fixed right-2 top-2 z-40 flex gap-1">
      <button
        onClick={toggleTheme}
        className="hover:bg-accent hover:text-accent-foreground rounded-md p-2 transition-colors"
        aria-label="Toggle theme"
      >
        {themeIcon}
      </button>
      <Sheet>
        <SheetTrigger asChild>
          <button
            className="hover:bg-accent hover:text-accent-foreground rounded-md p-2 transition-colors"
            aria-label="Scoreboard"
          >
            <BarChart3 className="size-4" />
          </button>
        </SheetTrigger>
      <SheetContent side="right" className="w-[90vw] max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Scoreboard</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6 px-4">
          {/* Transposed table: rounds as rows, players as columns */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-border border-b">
                  <th className="px-2 py-1 text-left font-medium">Round</th>
                  {players.map((p) => (
                    <th key={p.userId} className="px-1.5 py-1 text-center font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <PlayerAvatar name={p.displayName} />
                        <span className="truncate max-w-[60px]">{p.displayName}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roundNumbers.map((rn) => {
                  const pr = playedRound(rn);
                  return (
                    <tr key={rn} className="border-border/50 border-b">
                      <td className="px-2 py-1 font-medium tabular-nums text-center">
                        {roundLabelForRoundNumber(rn)}
                      </td>
                      {players.map((p) => {
                        const entry = pr?.scores.find((s) => s.userId === p.userId);
                        return (
                          <td key={p.userId} className="px-1.5 py-1 text-center tabular-nums">
                            {entry != null ? entry.handScore : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="border-border border-t-2 font-bold">
                  <td className="px-2 py-1 text-center">Total</td>
                  {players.map((p) => (
                    <td key={p.userId} className="px-1.5 py-1 text-center tabular-nums">
                      {p.totalScore}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cumulative score line chart */}
          <div>
            <p className="text-muted-foreground mb-2 text-[0.65rem] font-medium uppercase tracking-wider">
              Cumulative Points
            </p>
            <div className="h-48">
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
                  {players.map((p, i) => (
                    <Line
                      key={p.userId}
                      type="monotone"
                      dataKey={p.userId}
                      name={p.displayName}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      activeDot={false}
                      animationDuration={300}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-round delta line chart */}
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
                  {players.map((p, i) => (
                    <Line
                      key={p.userId}
                      type="monotone"
                      dataKey={p.userId}
                      name={p.displayName}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      activeDot={false}
                      animationDuration={300}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    </div>
  );
}
