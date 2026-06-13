import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useMatchHistory } from "../stats/hooks";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export default function MatchHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: matches, isLoading, error } = useMatchHistory(user?.id ?? "");

  function rankLabel(rank: number | null): string {
    if (rank === 1) return "1st";
    if (rank === 2) return "2nd";
    if (rank === 3) return "3rd";
    if (rank === 4) return "4th";
    return "-";
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Match History
        </h1>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Lobby
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      {error && <p className="text-destructive text-sm">Error loading match history</p>}

      {matches && matches.length === 0 && (
        <p className="text-muted-foreground text-sm">No completed matches yet.</p>
      )}

      {matches && matches.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Rounds</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((m) => (
              <TableRow
                key={m.matchId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/match/${m.matchId}`)}
              >
                <TableCell>{new Date(m.date).toLocaleDateString()}</TableCell>
                <TableCell>{rankLabel(m.finalRank)}</TableCell>
                <TableCell>{m.totalScore}</TableCell>
                <TableCell>{m.totalRounds}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
