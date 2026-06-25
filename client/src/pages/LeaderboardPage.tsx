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

const RANK_LABELS = ["", "1st", "2nd", "3rd", "4th"];
const RANK_COLORS = ["", "text-yellow-500", "text-gray-400", "text-amber-700", "text-muted-foreground"];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <span className={`font-bold text-sm tabular-nums ${RANK_COLORS[rank]}`}>{RANK_LABELS[rank]}</span>;
  }
  return <span className="text-muted-foreground text-sm tabular-nums">{rank}</span>;
}

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
                <TableCell className="font-medium"><RankBadge rank={index + 1} /></TableCell>
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
