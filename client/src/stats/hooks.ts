import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLeaderboard,
  fetchMatchHistory,
  fetchPlayerStats,
  searchUsers,
  fetchFriends,
  fetchFriendsStatus,
  fetchPendingFriends,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  fetchHeadToHead,
  fetchRecentOpponents,
} from "./api";

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

export function usePlayerStats(userId: string) {
  return useQuery({
    queryKey: ["playerStats", userId],
    queryFn: () => fetchPlayerStats(userId),
    enabled: !!userId,
  });
}

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
  });
}

export function useFriendsStatus() {
  return useQuery({
    queryKey: ["friends", "status"],
    queryFn: fetchFriendsStatus,
    refetchInterval: 15_000,
  });
}

export function usePendingFriends() {
  return useQuery({
    queryKey: ["friends", "pending"],
    queryFn: fetchPendingFriends,
    refetchInterval: 10_000,
  });
}

function invalidateFriendQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["friends"] });
  qc.invalidateQueries({ queryKey: ["friends", "pending"] });
  qc.invalidateQueries({ queryKey: ["friends", "status"] });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => invalidateFriendQueries(qc),
  });
}

export function useAcceptFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => invalidateFriendQueries(qc),
  });
}

export function useDeclineFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => invalidateFriendQueries(qc),
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

export function useHeadToHead(userId: string) {
  return useQuery({
    queryKey: ["headtohead", userId],
    queryFn: () => fetchHeadToHead(userId),
    enabled: !!userId,
  });
}

export function useRecentOpponents(userId: string) {
  return useQuery({
    queryKey: ["recentOpponents", userId],
    queryFn: () => fetchRecentOpponents(userId),
    enabled: !!userId,
  });
}

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: ["userSearch", q],
    queryFn: () => searchUsers(q),
    enabled: q.length >= 2,
  });
}
