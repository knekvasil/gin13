import { useState } from "react";
import {
  Plus,
  UserPlus,
  X,
  Check,
  Search,
  Users,
  Swords,
  Ellipsis,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardHeader,
} from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface FriendEntry {
  id: string;
  displayName: string;
}

interface FriendStatus {
  userId: string;
  inGame: boolean;
  lastSeen: string | null;
  elo: number | null;
}

interface HeadToHeadEntry {
  opponentId: string;
  displayName: string;
  wins: number;
  losses: number;
}

interface FriendsPanelProps {
  friends: FriendEntry[];
  friendStatuses: FriendStatus[];
  rivals: HeadToHeadEntry[];
  searchResults: FriendEntry[] | undefined;
  sentRequests: Map<string, "sending" | "sent" | "error">;
  friendError: string;
  onSendRequest: (userId: string) => void;
  onRemoveFriend: (friendId: string) => void;
  onSearchChange: (q: string) => void;
}

export default function FriendsPanel({
  friends,
  friendStatuses,
  rivals,
  searchResults,
  sentRequests,
  friendError,
  onSendRequest,
  onRemoveFriend,
  onSearchChange,
}: FriendsPanelProps) {
  const [friendTab, setFriendTab] = useState<"friends" | "rivals">("friends");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const statusMap = new Map(friendStatuses.map((s) => [s.userId, s]));

  return (
    <Card>
      <CardHeader className="px-4 pb-0">
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
          <button
            onClick={() => setFriendTab("friends")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors ${friendTab === "friends"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            Friends
          </button>
          <button
            onClick={() => setFriendTab("rivals")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors ${friendTab === "rivals"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Swords className="size-3.5" />
            Rivals
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-0 relative flex-1 min-h-[140px]">
        {friendTab === "friends" ? (
          <>
            {friends.length === 0 && !showAddFriend ? (
              <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs">
                <Users className="size-8 opacity-40" />
                <span>No friends yet</span>
                <Button size="xs" variant="outline" onClick={() => setShowAddFriend(true)}>
                  <UserPlus className="mr-1 size-3" />
                  Add Friend
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {friends.map((f) => {
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
                            <DropdownMenuItem onClick={() => onRemoveFriend(f.id)}>
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
                        onChange={(e) => {
                          setSearchQ(e.target.value);
                          onSearchChange(e.target.value);
                        }}
                        placeholder="Search players..."
                        className="h-7 pl-7 text-xs"
                      />
                    </div>
                    {searchResults && searchResults.length > 0 && (
                      <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                        {searchResults
                          .filter((u) => !friends.some((f) => f.id === u.id))
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
                                    onClick={() => onSendRequest(u.id)}
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
                        onSearchChange("");
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
  );
}
