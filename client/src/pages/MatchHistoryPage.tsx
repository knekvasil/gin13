import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useMatchHistory } from "../stats/hooks";

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
    <div>
      <h1>Match History</h1>
      <button onClick={() => navigate("/")}>Back to Lobby</button>

      {isLoading && <p>Loading...</p>}

      {error && <p>Error loading match history</p>}

      {matches && matches.length === 0 && <p>No completed matches yet.</p>}

      {matches && matches.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Rank</th>
              <th>Score</th>
              <th>Rounds</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.matchId}>
                <td>{new Date(m.date).toLocaleDateString()}</td>
                <td>{rankLabel(m.finalRank)}</td>
                <td>{m.totalScore}</td>
                <td>{m.totalRounds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
