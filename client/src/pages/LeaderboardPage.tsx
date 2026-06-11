import { useNavigate } from "react-router-dom";
import { useLeaderboard } from "../stats/hooks";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { data: leaderboard, isLoading, error } = useLeaderboard();

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <button
          onClick={() => navigate("/")}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Back
        </button>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Loading...</p>
      )}

      {error && (
        <div className="rounded-xl border border-dashed border-red-300 dark:border-red-700 p-8 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">Error loading leaderboard</p>
        </div>
      )}

      {leaderboard && leaderboard.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No completed matches yet.</p>
        </div>
      )}

      {leaderboard && leaderboard.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-12">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Player</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Score</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Wins</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.userId} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="px-4 py-3 font-medium tabular-nums">{index + 1}</td>
                  <td className="px-4 py-3">{entry.displayName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{entry.totalScore}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{entry.roundWins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
