import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { MatchDetail, MatchDetailPlayer, RoundScoreEntry } from "../stats/api";

function computeCumulative(roundScores: RoundScoreEntry[], userId: string): { round: number; cumulative: number }[] {
  let total = 0;
  return roundScores.map((rs) => {
    const entry = rs.scores.find((s) => s.userId === userId);
    total += entry?.handScore ?? 0;
    return { round: rs.roundNumber, cumulative: total };
  });
}

function roundLabel(wildRank: number): string {
  if (wildRank === 1) return "A";
  if (wildRank === 11) return "J";
  if (wildRank === 12) return "Q";
  if (wildRank === 13) return "K";
  return String(wildRank);
}

const COLORS = ["var(--color-primary)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-5)"];

function PlayerAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ${className ?? ""}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function EloDisplay({ eloBefore, eloDelta }: { eloBefore: number; eloDelta: number }) {
  const color = eloDelta > 0 ? "text-green-500" : eloDelta < 0 ? "text-red-500" : "text-muted-foreground";
  const sign = eloDelta > 0 ? "+" : "";
  return (
    <span className={`tabular-nums ${color}`}>
      {eloBefore} ({sign}{eloDelta})
    </span>
  );
}

function PodiumPlayer({ player, place }: { player: MatchDetailPlayer; place: 1 | 2 | 3 }) {
  const heights: Record<number, string> = { 1: "h-32", 2: "h-24", 3: "h-20" };
  const order: Record<number, string> = { 1: "order-2", 2: "order-1", 3: "order-3" };
  const medalColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-gray-400", 3: "text-amber-700" };

  return (
    <div className={`flex flex-col items-center justify-end gap-2 ${order[place]}`}>
      <PlayerAvatar name={player.displayName} />
      <p className="text-xs font-semibold text-center max-w-[80px] truncate">{player.displayName}</p>
      <EloDisplay eloBefore={player.eloBefore} eloDelta={player.eloDelta} />
      <span className={`text-2xl font-bold ${medalColors[place]}`}>{place}</span>
      <div className={`w-24 ${heights[place]} bg-muted rounded-t-lg flex items-center justify-center`}>
        <span className="text-lg font-bold tabular-nums">{player.totalScore}</span>
      </div>
    </div>
  );
}

export default function MatchOverScreen({ matchDetail }: { matchDetail: MatchDetail }) {
  const { players, roundScores } = matchDetail;
  const roundLabels = roundScores.map((rs) => roundLabel(rs.wildRank));

  const sortedPlayers = [...players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const podiumPlayers = sortedPlayers.slice(0, 3);
  const tablePlayers = sortedPlayers;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Podium */}
      <div className="flex items-end justify-center gap-4 pt-4">
        {podiumPlayers.length >= 2 && (
          <PodiumPlayer player={podiumPlayers[1]} place={2} />
        )}
        {podiumPlayers.length >= 1 && (
          <PodiumPlayer player={podiumPlayers[0]} place={1} />
        )}
        {podiumPlayers.length >= 3 && (
          <PodiumPlayer player={podiumPlayers[2]} place={3} />
        )}
      </div>

      {/* Horizontal score table: players as rows, rounds as columns */}
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
            {tablePlayers.map((p) => {
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

      {/* Both charts side by side */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-2 text-[0.65rem] font-medium uppercase tracking-wider">
            Cumulative Points
          </p>
          <div className="h-40">
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
                      activeDot={false}
                    />
                  );
                })}
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
              <LineChart>
                <XAxis
                  dataKey="round"
                  ticks={roundScores.map((r) => r.roundNumber)}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                {players.map((p, i) => {
                  const data = roundScores.map((rs) => {
                    const entry = rs.scores.find((s) => s.userId === p.userId);
                    return { round: rs.roundNumber, delta: entry?.handScore ?? 0 };
                  });
                  return (
                    <Line
                      key={p.userId}
                      data={data}
                      type="monotone"
                      dataKey="delta"
                      name={p.displayName}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      activeDot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
