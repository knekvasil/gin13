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
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Match History</h1>
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
          <p className="text-sm text-red-600 dark:text-red-400">Error loading match history</p>
        </div>
      )}

      {matches && matches.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No completed matches yet.</p>
        </div>
      )}

      {matches && matches.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Rank</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Score</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.matchId} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="px-4 py-3">{new Date(m.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{rankLabel(m.finalRank)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.totalScore}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.totalRounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
