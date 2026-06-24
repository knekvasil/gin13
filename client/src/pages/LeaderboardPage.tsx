import { useNavigate } from "react-router-dom";
import { useLeaderboard } from "../stats/hooks";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { data: leaderboard, isLoading, error } = useLeaderboard();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Leaderboard
        </h1>
        <Button variant="outline" onClick={() => navigate("/lobby")}>
          Back to Lobby
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      {error && <p className="text-destructive text-sm">Error loading leaderboard</p>}

      {leaderboard && leaderboard.length === 0 && (
        <p className="text-muted-foreground text-sm">No completed matches yet.</p>
      )}

      {leaderboard && leaderboard.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Total Score</TableHead>
              <TableHead>Round Wins</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((entry, index) => (
              <TableRow key={entry.userId}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{entry.displayName}</TableCell>
                <TableCell>{entry.totalScore}</TableCell>
                <TableCell>{entry.roundWins}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
