import { useNavigate } from "react-router-dom";
import { useLeaderboard } from "../stats/hooks";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { data: leaderboard, isLoading, error } = useLeaderboard();

  return (
    <div>
      <h1>Leaderboard</h1>
      <button onClick={() => navigate("/")}>Back to Lobby</button>

      {isLoading && <p>Loading...</p>}

      {error && <p>Error loading leaderboard</p>}

      {leaderboard && leaderboard.length === 0 && <p>No completed matches yet.</p>}

      {leaderboard && leaderboard.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Total Score</th>
              <th>Round Wins</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr key={entry.userId}>
                <td>{index + 1}</td>
                <td>{entry.displayName}</td>
                <td>{entry.totalScore}</td>
                <td>{entry.roundWins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
