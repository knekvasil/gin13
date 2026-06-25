import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface PlayerStats {
  elo: number;
  totalMatches: number;
  wins: number;
  winRate: number;
  avgRank: number;
  biggestWinDiff: number | null;
  biggestGameLoss: number | null;
  biggestRoundLoss: number | null;
  mostRoundsWonInAGame: number | null;
  longestGameWinStreak: number;
  currentGameWinStreak: number;
  totalRoundsPlayed: number;
  peakElo: number;
  percentiles: Record<string, number>;
  eloHistory: { date: string; elo: number }[];
  rankHistory: { date: string; rank: number }[];
  currentForm: { rank: number; score: number }[];
}

const FORM_COLORS = [
  "bg-green-500/15 text-green-500",
  "bg-yellow-500/15 text-yellow-500",
  "bg-orange-500/15 text-orange-500",
  "bg-red-500/15 text-red-500",
];

function FormBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex size-5 items-center justify-center rounded-full text-[0.6rem] font-bold leading-none ${FORM_COLORS[rank - 1] ?? FORM_COLORS[3]}`}
    >
      {rank}
    </span>
  );
}

interface PlayerStatsPanelProps {
  stats: PlayerStats | undefined;
}

export default function PlayerStatsPanel({ stats }: PlayerStatsPanelProps) {
  const currentForm = stats?.currentForm ?? [];

  if (!stats) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-sm">My Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pt-0">
          <p className="text-muted-foreground pt-3 text-xs">
            Play some matches to see your stats.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-sm">My Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pt-0">
        {currentForm.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-[0.65rem] uppercase tracking-wider">
              Form (last {currentForm.length})
            </p>
            <div className="flex gap-1">
              {currentForm.map((f, i) => (
                <FormBadge key={i} rank={f.rank} />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-muted-foreground mb-1 text-[0.65rem] uppercase tracking-wider">
            Career Stats
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(() => {
              type StatEntry = { key: string; label: string; value: string | number; arrow: "up" | "down"; pctKey?: string };
              const entries: StatEntry[] = [
                { key: "elo", label: "ELO", value: stats.elo, arrow: "up", pctKey: "elo" },
                { key: "matches", label: "Matches", value: stats.totalMatches, arrow: "up", pctKey: "totalMatches" },
                { key: "winRate", label: "1st %", value: `${stats.winRate}%`, arrow: "up", pctKey: "winRate" },
                { key: "avgRank", label: "Avg Rank", value: stats.avgRank, arrow: "down" },
                { key: "blowout", label: "Biggest Blowout", value: stats.biggestWinDiff ?? "-", arrow: "up", pctKey: "biggestWinDiff" },
                { key: "worstGame", label: "Worst Game", value: stats.biggestGameLoss ?? "-", arrow: "down", pctKey: "biggestGameLoss" },
                { key: "worstRound", label: "Worst Round", value: stats.biggestRoundLoss ?? "-", arrow: "down", pctKey: "biggestRoundLoss" },
                { key: "mostRounds", label: "Most Rounds Won", value: stats.mostRoundsWonInAGame ?? "-", arrow: "up", pctKey: "mostRoundsWonInAGame" },
                { key: "streak", label: "Win Streak", value: stats.longestGameWinStreak, arrow: "up", pctKey: "longestGameWinStreak" },
                { key: "currentStreak", label: "Current Streak", value: stats.currentGameWinStreak, arrow: "up" },
                { key: "totalRounds", label: "Total Rounds", value: stats.totalRoundsPlayed, arrow: "up" },
                { key: "peakElo", label: "Peak ELO", value: stats.peakElo, arrow: "up" },
              ];
              return entries.map((e) => {
                const pctVal = e.pctKey ? stats.percentiles[e.pctKey] : undefined;
                const pctColor = pctVal != null ? (pctVal >= 67 ? "text-green-500" : pctVal >= 33 ? "text-yellow-500" : "text-red-500") : "";
                return (
                  <div key={e.key} className="flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5">
                    <span className="text-[0.55rem] uppercase tracking-wider text-muted-foreground truncate">{e.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold tabular-nums">{e.value}</span>
                      {pctVal != null && (
                        <span className={`text-[0.6rem] font-semibold tabular-nums ${pctColor}`}>
                          {pctVal}th
                        </span>
                      )}
                      <span className={`inline-flex size-4 items-center justify-center rounded-full ${e.arrow === "up" ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                        {e.arrow === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stats.eloHistory.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-muted-foreground text-[0.65rem] uppercase tracking-wider">ELO</p>
                <span className="text-lg font-bold tabular-nums">{stats.elo}</span>
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.eloHistory}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
                    <Line
                      type="monotone"
                      dataKey="elo"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {stats.rankHistory.length > 1 && (() => {
            const rankColors = ["var(--color-primary)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-5)"];
            const cumulative = { 1: 0, 2: 0, 3: 0, 4: 0 };
            const areaData = stats.rankHistory.map((entry) => {
              cumulative[entry.rank as keyof typeof cumulative] = (cumulative[entry.rank as keyof typeof cumulative] ?? 0) + 1;
              const total = cumulative[1] + cumulative[2] + cumulative[3] + cumulative[4];
              return {
                date: entry.date,
                rank1: Math.round((cumulative[1] / total) * 100),
                rank2: Math.round((cumulative[2] / total) * 100),
                rank3: Math.round((cumulative[3] / total) * 100),
                rank4: Math.round((cumulative[4] / total) * 100),
              };
            });
            return (
              <div>
                <p className="text-muted-foreground mb-1 text-[0.65rem] uppercase tracking-wider">
                  Rank Distribution
                </p>
                <div className="h-24 overflow-hidden rounded-lg relative">
                  <ResponsiveContainer className="relative -translate-x-2 -translate-y-2" width="105%" height="115%">
                    <AreaChart data={areaData}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={[0, 100]} />
                      {[1, 2, 3, 4].map((r) => (
                        <Area
                          key={r}
                          type="monotone"
                          dataKey={`rank${r}`}
                          name={`${r}${r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th"}`}
                          stackId="1"
                          stroke={rankColors[r - 1]}
                          fill={rankColors[r - 1]}
                          activeDot={false}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
