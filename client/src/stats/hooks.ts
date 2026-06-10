import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, fetchMatchHistory } from "./api";

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
  });
}

export function useMatchHistory(userId: string) {
  return useQuery({
    queryKey: ["matchHistory", userId],
    queryFn: () => fetchMatchHistory(userId),
    enabled: !!userId,
  });
}
