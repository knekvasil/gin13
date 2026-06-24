import { useParams, useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { useBotDetail } from "../stats/league-hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>();
  const { data, isLoading } = useBotDetail(botId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <p className="text-destructive text-sm">Bot not found</p>
        <Button variant="outline" onClick={() => navigate("/bot-league")}>Back to League</Button>
      </div>
    );
  }

  const winRate = data.totalMatches > 0
    ? Math.round((data.wins / data.totalMatches) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="text-muted-foreground text-sm">ID: {data.botId}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{data.elo}</p>
          <p className="text-muted-foreground text-xs">ELO</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{data.totalMatches}</p>
          <p className="text-muted-foreground text-xs">Matches</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{winRate}%</p>
          <p className="text-muted-foreground text-xs">Win Rate</p>
        </div>
      </div>

      {data.eloHistory.length > 1 && (
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">ELO History</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.eloHistory}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
                <Line type="monotone" dataKey="elo" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.seasons.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Season History</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Season</TableHead>
                <TableHead className="text-right text-xs">MP</TableHead>
                <TableHead className="text-right text-xs">Pld</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.seasons.map((s) => (
                <TableRow key={s.seasonId} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/bot-league`)}>
                  <TableCell className="text-xs">{s.seasonName}</TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">{s.matchPoints}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{s.matchesPlayed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/bot-league")}>Back to League</Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/lobby")}>Lobby</Button>
      </div>
    </div>
  );
}
