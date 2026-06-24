import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createColyseusClient } from "../auth/colyseus";
import type { Client } from "colyseus.js";
import { useAuth } from "../auth/AuthContext";
import {
  useLeaderboard,
  useMatchHistory,
  usePlayerStats,
  useFriends,
  useHeadToHead,
  useUserSearch,
  useSendFriendRequest,
  useRemoveFriend,
  useFriendsStatus,
} from "../stats/hooks";
import {
  Trophy,
  Swords,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import PlayNowPopover from "../components/PlayNowPopover";
import PlayerStatsPanel from "../components/PlayerStatsPanel";
import FriendsPanel from "../components/FriendsPanel";

interface RoomEntry {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: { totalRounds?: number; players?: number };
}

function rankLabel(r: number | null): string {
  if (r === 1) return "1st";
  if (r === 2) return "2nd";
  if (r === 3) return "3rd";
  if (r === 4) return "4th";
  return "-";
}

export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const clientRef = useRef<Client | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [sentRequests, setSentRequests] = useState<Map<string, "sending" | "sent" | "error">>(new Map());
  const [friendError, setFriendError] = useState("");

  const { data: leaderboard } = useLeaderboard();
  const { data: matchHistory } = useMatchHistory(user?.id ?? "");
  const { data: stats } = usePlayerStats(user?.id ?? "");
  const { data: friends } = useFriends();
  const { data: friendStatuses } = useFriendsStatus();
  const { data: headtohead } = useHeadToHead(user?.id ?? "");
  const { data: searchResults } = useUserSearch(searchQ);
  const sendReq = useSendFriendRequest();
  const removeFriendMut = useRemoveFriend();

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    const c = createColyseusClient(token);
    clientRef.current = c;

    const fetchRooms = async () => {
      try {
        const available = await c.getAvailableRooms("game_room");
        setRooms(available as RoomEntry[]);
      } catch { }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  const refreshRooms = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    try {
      const available = await c.getAvailableRooms("game_room");
      setRooms(available as RoomEntry[]);
    } catch { }
  }, []);

  const handleQuickPlay = useCallback(async () => {
    const c = clientRef.current;
    const token = localStorage.getItem("jwt");
    if (!c || !token) return;
    try {
      const room = await c.joinOrCreate("game_room", {});
      navigate(`/game/${room.roomId}`);
      room.leave();
    } catch (err) {
      console.error("quick play failed", err);
    }
  }, [navigate]);

  const handlePractice = useCallback(async (bots: number) => {
    const c = clientRef.current;
    const token = localStorage.getItem("jwt");
    if (!c || !token) return;
    try {
      const room = await c.create("game_room", { totalRounds: 13, bots });
      navigate(`/game/${room.roomId}`);
      room.leave();
    } catch (err) {
      console.error("practice room failed", err);
    }
  }, [navigate]);

  const handleJoin = useCallback(
    async (roomId: string) => {
      const c = clientRef.current;
      const token = localStorage.getItem("jwt");
      if (!c || !token) return;
      try {
        const room = await c.joinById(roomId);
        navigate(`/game/${room.roomId}`);
        room.leave();
      } catch {
        refreshRooms();
      }
    },
    [navigate, refreshRooms],
  );

  const handleSendRequest = useCallback((targetUserId: string) => {
    setSentRequests((prev) => new Map(prev).set(targetUserId, "sending"));
    sendReq.mutate(targetUserId, {
      onSuccess: () => {
        setSentRequests((prev) => new Map(prev).set(targetUserId, "sent"));
        setTimeout(() => {
          setSentRequests((prev) => {
            const next = new Map(prev);
            next.delete(targetUserId);
            return next;
          });
        }, 3000);
      },
      onError: (err) => {
        setSentRequests((prev) => new Map(prev).set(targetUserId, "error"));
        setFriendError(err.message);
        setTimeout(() => {
          setSentRequests((prev) => {
            const next = new Map(prev);
            next.delete(targetUserId);
            return next;
          });
          setFriendError("");
        }, 4000);
      },
    });
  }, [sendReq]);

  const recentMatches = matchHistory?.slice(0, 10) ?? [];
  const topPlayers = (leaderboard ?? []).slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlayNowPopover onQuickPlay={handleQuickPlay} onPractice={handlePractice} />
        <Button variant="outline" size="sm" onClick={() => navigate("/bot-league")}>
          Bot League
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PlayerStatsPanel stats={stats as any} />

        <FriendsPanel
          friends={friends ?? []}
          friendStatuses={friendStatuses ?? []}
          rivals={headtohead ?? []}
          searchResults={searchResults ?? []}
          sentRequests={sentRequests}
          friendError={friendError}
          onSendRequest={handleSendRequest}
          onRemoveFriend={(id) => removeFriendMut.mutate(id)}
          onSearchChange={setSearchQ}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-sm">Open Rooms</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pt-0 relative flex-1 min-h-[140px]">
            {rooms.length === 0 ? (
              <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs">
                <Swords className="size-8 opacity-40" />
                <span>No open rooms</span>
                <span className="flex gap-2">
                  <Button size="xs" onClick={handleQuickPlay}>
                    Quick Play
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => handlePractice(2)}>
                    Practice
                  </Button>
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {rooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                  >
                    <span>
                      <span className="font-medium">{room.clients}/{room.maxClients}</span>
                      <span className="text-muted-foreground ml-1.5">
                        players &middot; {room.metadata?.totalRounds ?? "?"} rounds
                      </span>
                    </span>
                    <Button
                      size="xs"
                      onClick={() => handleJoin(room.roomId)}
                      disabled={room.clients >= room.maxClients}
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Trophy className="size-3.5" />
                Global Leaderboard
              </CardTitle>
              <Button variant="link" size="xs" onClick={() => navigate("/leaderboard")}>
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-0">
            {topPlayers.length === 0 ? (
              <p className="text-muted-foreground text-xs">No completed matches yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-xs">#</TableHead>
                    <TableHead className="text-xs">Player</TableHead>
                    <TableHead className="w-14 text-right text-xs">ELO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPlayers.map((p) => (
                    <TableRow key={p.userId}>
                      <TableCell className="text-xs font-medium">{p.rank}</TableCell>
                      <TableCell className="text-xs">{p.displayName}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{p.elo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Match History</CardTitle>
              <Button variant="link" size="xs" onClick={() => navigate("/matches")}>
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-0">
            {recentMatches.length === 0 ? (
              <p className="text-muted-foreground text-xs">No completed matches yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Rank</TableHead>
                    <TableHead className="w-16 text-right text-xs">Score</TableHead>
                    <TableHead className="w-16 text-right text-xs">Rounds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMatches.map((m) => (
                    <TableRow key={m.matchId}>
                      <TableCell className="text-xs">{new Date(m.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs">{rankLabel(m.finalRank)}</TableCell>
                      <TableCell className="text-right text-xs">{m.totalScore}</TableCell>
                      <TableCell className="text-right text-xs">{m.totalRounds}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
