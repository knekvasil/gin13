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
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  useFriendsStatus,
} from "../stats/hooks";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Plus,
  UserPlus,
  X,
  Check,
  Search,
  Trophy,
  Users,
  Swords,
  Ellipsis,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="p-3 pb-0">
        <CardDescription className="text-[0.65rem] uppercase tracking-wider">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1">
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function FormBadge({ result }: { result: "W" | "L" }) {
  return (
    <span
      className={`inline-flex size-5 items-center justify-center rounded-full text-[0.6rem] font-bold leading-none ${
        result === "W"
          ? "bg-primary/15 text-primary"
          : "bg-destructive/15 text-destructive"
      }`}
    >
      {result}
    </span>
  );
}

export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [roundCount, setRoundCount] = useState(13);
  const [creating, setCreating] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const [friendTab, setFriendTab] = useState<"friends" | "rivals">("friends");
  const [searchQ, setSearchQ] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);
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
  const acceptReq = useAcceptFriendRequest();
  const declineReq = useDeclineFriendRequest();
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
      } catch {}
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
    } catch {}
  }, []);

  const handleCreate = useCallback(async () => {
    const c = clientRef.current;
    const token = localStorage.getItem("jwt");
    if (!c || !token || creating) return;
    setCreating(true);
    try {
      const room = await c.create("game_room", { totalRounds: roundCount });
      navigate(`/game/${room.roomId}`);
      room.leave();
    } catch (err) {
      console.error("create room failed", err);
      setCreating(false);
    }
  }, [roundCount, navigate, creating]);

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

  const recentMatches = matchHistory?.slice(0, 10) ?? [];
  const topPlayers = (leaderboard ?? []).slice(0, 5);

  const scoreHistory = stats?.scoreHistory ?? [];
  const rankDistribution = stats?.rankDistribution ?? [];
  const currentForm = stats?.currentForm ?? [];
  const friendList = friends ?? [];
  const statusMap = new Map((friendStatuses ?? []).map((s) => [s.userId, s]));
  const rivals = headtohead ?? [];

  const statCards = stats
    ? [
        { label: "ELO", value: stats.elo },
        { label: "Matches", value: stats.totalMatches },
        { label: "Wins", value: stats.wins },
        { label: "Win Rate", value: `${stats.winRate}%` },
        { label: "Avg Rank", value: stats.avgRank },
        { label: "Biggest Win", value: stats.biggestGameWin ?? "-" },
        { label: "Biggest Loss", value: stats.biggestGameLoss ?? "-" },
        { label: "Best Streak", value: stats.longestGameWinStreak },
        { label: "Win Streak", value: stats.currentGameWinStreak },
        { label: "Rounds/Match", value: stats.mostRoundsWonInAGame ?? "-" },
        { label: "Big Round", value: stats.biggestRoundLoss ?? "-" },
      ]
    : [];

  const topStatCards = statCards.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleQuickPlay}>Quick Play</Button>
        <Button variant="outline" onClick={() => setShowCreate((v) => !v)}>
          Create Room
        </Button>
        {showCreate && (
          <div className="flex items-center gap-2">
            <Input
              id="rounds"
              type="number"
              min={1}
              max={13}
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
              className="h-7 w-16"
              aria-label="Number of rounds"
            />
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              Start
            </Button>
          </div>
        )}
      </div>

      {/* Row 1: Open Rooms | Friends / Rivals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Open Rooms */}
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm">Open Rooms</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {rooms.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No open rooms. Create one or use Quick Play!
              </p>
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

        {/* Friends / Rivals */}
        <Card>
          <CardHeader className="p-4 pb-0">
            <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
              <button
                onClick={() => setFriendTab("friends")}
                className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                  friendTab === "friends"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-3.5" />
                Friends
              </button>
              <button
                onClick={() => setFriendTab("rivals")}
                className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                  friendTab === "rivals"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Swords className="size-3.5" />
                Rivals
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {friendTab === "friends" ? (
              <>
                {friendList.length === 0 && !showAddFriend ? (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 py-4 text-xs">
                    <Users className="size-8 opacity-40" />
                    <p>No friends yet.</p>
                    <Button size="xs" variant="outline" onClick={() => setShowAddFriend(true)}>
                      <UserPlus className="mr-1 size-3" />
                      Add Friend
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {friendList.map((f) => {
                      const st = statusMap.get(f.id);
                      const isOnline = st?.inGame || (st?.lastSeen && Date.now() - new Date(st.lastSeen).getTime() < 120_000);
                      const dot = isOnline ? "bg-green-500" : "bg-red-500";
                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative flex-shrink-0">
                              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[0.6rem] font-bold">
                                {f.displayName.charAt(0).toUpperCase()}
                              </span>
                              <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background ${dot}`} />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium leading-tight">{f.displayName}</span>
                              {st?.lastSeen ? (
                                <span className="text-muted-foreground leading-tight text-[0.6rem]">
                                  {(() => {
                                    const diff = Date.now() - new Date(st.lastSeen).getTime();
                                    const mins = Math.floor(diff / 60000);
                                    if (mins < 1) return "Just now";
                                    if (mins < 60) return `${mins}m ago`;
                                    const hours = Math.floor(mins / 60);
                                    if (hours < 24) return `${hours}h ago`;
                                    const days = Math.floor(hours / 24);
                                    if (days === 1) return "Yesterday";
                                    return `${days}d ago`;
                                  })()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {st?.elo != null && (
                              <span className="tabular-nums text-[0.6rem] font-medium text-muted-foreground">{st.elo}</span>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger className="hover:bg-accent rounded-md p-1 transition-colors">
                                <Ellipsis className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={4} className="w-36">
                                <DropdownMenuItem onClick={() => removeFriendMut.mutate(f.id)}>
                                  <X className="mr-2 size-3" />
                                  Remove friend
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                    {showAddFriend && (
                      <div className="pt-2">
                        <div className="relative">
                          <Search className="text-muted-foreground absolute top-1/2 left-2 size-3 -translate-y-1/2" />
                          <Input
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder="Search players..."
                            className="h-7 pl-7 text-xs"
                          />
                        </div>
                        {searchResults && searchResults.length > 0 && (
                          <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                            {searchResults
                              .filter((u) => !friendList.some((f) => f.id === u.id))
                              .map((u) => {
                                const reqState = sentRequests.get(u.id);
                                return (
                                  <div
                                    key={u.id}
                                    className="flex items-center justify-between rounded-sm px-2 py-1 text-xs hover:bg-muted"
                                  >
                                    <span>{u.displayName}</span>
                                    {reqState === "sending" ? (
                                      <span className="text-muted-foreground size-5 inline-flex items-center justify-center text-[0.6rem]">...</span>
                                    ) : reqState === "sent" ? (
                                      <span className="text-primary size-5 inline-flex items-center justify-center">
                                        <Check className="size-3" />
                                      </span>
                                    ) : (
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => {
                                          setSentRequests((prev) => new Map(prev).set(u.id, "sending"));
                                          sendReq.mutate(u.id, {
                                            onSuccess: () => {
                                              setSentRequests((prev) => new Map(prev).set(u.id, "sent"));
                                              setTimeout(() => {
                                                setSentRequests((prev) => {
                                                  const next = new Map(prev);
                                                  next.delete(u.id);
                                                  return next;
                                                });
                                              }, 3000);
                                            },
                                            onError: (err) => {
                                              setSentRequests((prev) => new Map(prev).set(u.id, "error"));
                                              setFriendError(err.message);
                                              setTimeout(() => {
                                                setSentRequests((prev) => {
                                                  const next = new Map(prev);
                                                  next.delete(u.id);
                                                  return next;
                                                });
                                                setFriendError("");
                                              }, 4000);
                                            },
                                          });
                                        }}
                                      >
                                        <Plus className="size-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        {friendError && (
                          <p className="text-destructive mt-1 text-[0.6rem]">{friendError}</p>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setShowAddFriend(false);
                            setSearchQ("");
                          }}
                          className="mt-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    {!showAddFriend && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setShowAddFriend(true)}
                        className="mt-1 w-full"
                      >
                        <UserPlus className="mr-1 size-3" />
                        Add Friend
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {rivals.length === 0 ? (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 py-4 text-xs">
                    <Swords className="size-8 opacity-40" />
                    <p>Play matches to see rival stats.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {rivals.slice(0, 10).map((r) => (
                      <div
                        key={r.opponentId}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{r.displayName}</span>
                        <span className="text-muted-foreground">
                          {r.wins}W / {r.losses}L
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Leaderboard | Stats + Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Leaderboard */}
        <Card>
          <CardHeader className="p-4 pb-0">
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
          <CardContent className="p-4">
                {topPlayers.length === 0 ? (
              <p className="text-muted-foreground text-xs">No completed matches yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-xs">#</TableHead>
                    <TableHead className="text-xs">Player</TableHead>
                    <TableHead className="w-14 text-right text-xs">ELO</TableHead>
                    <TableHead className="w-14 text-right text-xs">W</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPlayers.map((p) => (
                    <TableRow key={p.userId}>
                      <TableCell className="text-xs font-medium">{p.rank}</TableCell>
                      <TableCell className="text-xs">{p.displayName}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{p.elo}</TableCell>
                      <TableCell className="text-right text-xs">{p.wins}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stats + Charts */}
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm">My Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {!stats ? (
              <p className="text-muted-foreground pt-3 text-xs">
                Play some matches to see your stats.
              </p>
            ) : (
              <>
                {/* Stat cards grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {topStatCards.map((s) => (
                    <StatCard key={s.label} label={s.label} value={s.value} />
                  ))}
                </div>

                {/* Current form */}
                {currentForm.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-[0.65rem] uppercase tracking-wider">
                      Form (last {currentForm.length})
                    </p>
                    <div className="flex gap-1">
                      {currentForm.map((f, i) => (
                        <FormBadge key={i} result={f.result} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Score trend */}
                {scoreHistory.length > 1 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-[0.65rem] uppercase tracking-wider">
                      Score Trend
                    </p>
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={scoreHistory}>
                          <XAxis dataKey="date" hide />
                          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                          <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="var(--color-primary)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Rank distribution */}
                {rankDistribution.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-[0.65rem] uppercase tracking-wider">
                      Rank Distribution
                    </p>
                    <div className="h-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rankDistribution}>
                          <XAxis dataKey="rank" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ fontSize: 12 }} />
                          <Bar dataKey="count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="p-4 pt-0">
            <Button variant="link" size="xs" onClick={() => navigate("/matches")}>
              View full match history
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Row 3: Extended stats + Match History */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Extra stat cards */}
        {stats && statCards.length > 4 && (
          <Card className="lg:col-span-1">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm">Records</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {statCards.slice(4).map((s) => (
                  <StatCard key={s.label} label={s.label} value={s.value} className="[--card-spacing:--spacing(3)]" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Match History */}
        <Card className={stats && statCards.length > 4 ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Match History</CardTitle>
              <Button variant="link" size="xs" onClick={() => navigate("/matches")}>
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
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
