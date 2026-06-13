import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMatchDetail, type MatchDetail } from "../stats/api";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Room } from "colyseus.js";
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AnimatedCard from "../components/AnimatedCard";
import StagingWell from "../components/StagingWell";
import MeldGroup from "../components/MeldGroup";
import DiscardZone from "../components/DiscardZone";
import { isWild, canMeldCards, RANK_NAMES } from "../lib/card-utils";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { toast } from "sonner";
import ScoreboardSheet from "../components/ScoreboardSheet";

interface CardData {
  rank: number;
  suit: number;
  meldGroupId: string;
}

interface PlayerState {
  sessionId: string;
  userId: string;
  name: string;
  score: number;
  disconnected: boolean;
  hand: CardData[];
  board: CardData[];
}

interface StagedCard extends CardData {
  handIndex: number;
}

function PlayerChip({
  player, isTurn, timerPct, rank,
}: {
  player: { name: string; score: number; disconnected: boolean };
  isTurn?: boolean;
  timerPct?: number;
  rank?: number | null;
}) {
  const isActive = !player.disconnected;
  const rankColor = rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-amber-700" : "";
  return (
    <div className={`relative flex flex-col rounded-lg px-2.5 py-1 text-xs transition-colors ${
      isTurn
        ? "ring-2 ring-primary bg-primary/5"
        : "bg-muted/50"
    }`}>
      {isTurn && timerPct != null && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none z-0">
          <div
            className="h-full transition-[width] duration-100 linear rounded-lg"
            style={{
              width: `${timerPct}%`,
              background: timerPct > 30
                ? "oklch(from var(--primary) l c h / 0.3)"
                : timerPct > 10
                  ? "rgb(255 152 0 / 0.3)"
                  : "rgb(244 67 54 / 0.4)",
            }}
          />
          {timerPct <= 10 && (
            <div className="absolute inset-0 animate-pulse rounded-lg" style={{ background: "rgb(244 67 54 / 0.15)" }} />
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5 relative z-20">
        <div className="relative flex-shrink-0">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {player.name.charAt(0).toUpperCase()}
          </span>
          {isActive && (
            <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background ${
              isTurn ? "bg-green-500 animate-pulse" : "bg-green-500"
            }`} />
          )}
          {!isActive && (
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-red-500" />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{player.name}</span>
            {player.disconnected && <span className="text-destructive text-[10px]">(DC)</span>}
          </div>
          <div className="flex items-center gap-1">
            {rank != null && rank <= 3 && (
              <span className={`font-bold ${rankColor}`}>
                {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
              </span>
            )}
            {rank != null && rank >= 4 && (
              <span className="text-muted-foreground">{rank}th</span>
            )}
            {rank != null && <span className="text-muted-foreground">&mdash;</span>}
            <span className="text-muted-foreground">{player.score}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeldsDisplay({
  player, wildRank, getMeldGroups, isMeldActive,
}: {
  player: PlayerState;
  wildRank: number;
  getMeldGroups: (p: PlayerState) => Map<string, CardData[]>;
  isMeldActive: boolean;
}) {
  const groups = getMeldGroups(player);
  if (groups.size === 0) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      {[...groups].map(([meldGroupId, group]) => (
        <MeldGroup
          key={meldGroupId}
          meldGroupId={meldGroupId}
          cards={group}
          wildRank={wildRank}
          isOwn={false}
          isActive={isMeldActive}
        />
      ))}
    </div>
  );
}

function OpponentSection({
  player, wildRank, getMeldGroups, isMeldActive, timerPct, isTurn, rank,
}: {
  player: PlayerState;
  wildRank: number;
  getMeldGroups: (p: PlayerState) => Map<string, CardData[]>;
  isMeldActive: boolean;
  timerPct?: number;
  isTurn?: boolean;
  rank?: number | null;
}) {
  return (
    <div className="flex flex-shrink-0 flex-col items-center gap-1 px-2 py-1.5">
      <PlayerChip player={player} isTurn={isTurn} timerPct={timerPct} rank={rank} />
      <div className="flex gap-0.5">
        {player.hand.map((_, i) => (
          <AnimatedCard key={i} faceDown small />
        ))}
      </div>
      <MeldsDisplay player={player} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={isMeldActive} />
    </div>
  );
}

function SortableHandCard({
  handIndex, card, wildRank, selected, canMeld, canDiscard, onClick,
}: {
  handIndex: number;
  card: CardData;
  wildRank: number;
  selected: boolean;
  canMeld: boolean;
  canDiscard: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `hand-${handIndex}`,
    data: { type: "hand", handIndex, rank: card.rank, suit: card.suit },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      {...attributes}
      {...listeners}
    >
      <AnimatedCard
        rank={card.rank}
        suit={card.suit}
        wild={card.rank === wildRank}
        selected={selected}
        layoutId={`card-${card.rank}-${card.suit}`}
        onClick={onClick}
        disabled={!canMeld && !canDiscard}
      />
    </div>
  );
}

export default function GameRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [status, setStatus] = useState("waiting");
  const [phase, setPhase] = useState("waiting");
  const [currentRound, setCurrentRound] = useState(0);
  const [wildRank, setWildRank] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [winnerSessionId, setWinnerSessionId] = useState("");
  const [drawPile, setDrawPile] = useState<CardData[]>([]);
  const [discardPile, setDiscardPile] = useState<CardData[]>([]);
  const [mySessionId, setMySessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [meldError, setMeldError] = useState<string | null>(null);
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const cleanupRef = useRef<() => void>(() => {});
  const [timerPct, setTimerPct] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [stagedCards, setStagedCards] = useState<StagedCard[]>([]);
  const [cardOrder, setCardOrder] = useState<number[]>([]);
  const prevHandRef = useRef<CardData[]>([]);
  const { data: matchDetail } = useQuery({
    queryKey: ["matchDetail", roomId],
    queryFn: () => fetchMatchDetail(roomId!),
    enabled: status === "finished" && !!roomId,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startClientTimer = useCallback(() => {
    clearTimer();
    setTimerPct(100);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.max(0, 100 - (elapsed / 60000) * 100);
      setTimerPct(pct);
      if (pct <= 0) clearTimer();
    }, 100);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    if (status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished") {
      startClientTimer();
    } else {
      clearTimer();
      setTimerPct(100);
    }
  }, [status, phase, currentPlayerIndex, currentRound, startClientTimer, clearTimer]);

  useEffect(() => {
    if (!token || !roomId) return;

    const client = createColyseusClient(token);
    let cancelled = false;
    let joined: Room | null = null;

    client.joinById(roomId).then((joinedRoom) => {
      if (cancelled) { joinedRoom.leave(); return; }

      joined = joinedRoom;
      setRoom(joinedRoom);
      const sessionId = joinedRoom.sessionId;
      setMySessionId(sessionId);

      const getState = () => joinedRoom.state as any;

      const updatePlayers = () => {
        if (cancelled) return;
        const state = getState();
        setStatus(state.status || "waiting");
        setPhase(state.phase || "waiting");
        setCurrentRound(state.currentRound ?? 0);
        setWildRank(state.wildRank ?? 0);
        setCurrentPlayerIndex(state.currentPlayerIndex ?? 0);
        setWinnerSessionId(state.winnerSessionId || "");
        const list: PlayerState[] = [];
        state.players?.forEach?.((p: PlayerState) => list.push(p));
        setPlayers(list);

        const rawHand = list.find((p) => p.sessionId === sessionId)?.hand;
        if (rawHand) {
          const oldHand = prevHandRef.current.slice();
          const myHand = rawHand.slice();
          prevHandRef.current = myHand;
          setSelectedCardIndices((prev) => prev.filter((i) => i < myHand.length));
          setCardOrder((prev) => {
            if (prev.length === myHand.length) return prev;
            const surviving: number[] = [];
            for (const oldIdx of prev) {
              const oldCard = oldHand[oldIdx];
              if (!oldCard) continue;
              const newIdx = myHand.findIndex((c) => c.rank === oldCard.rank && c.suit === oldCard.suit);
              if (newIdx !== -1) surviving.push(newIdx);
            }
            for (let i = 0; i < myHand.length; i++) {
              if (!surviving.includes(i)) surviving.push(i);
            }
            return surviving;
          });
        }

        const dPile: CardData[] = [];
        state.drawPile?.forEach?.((c: CardData) => dPile.push(c));
        setDrawPile(dPile);

        const diPile: CardData[] = [];
        state.discardPile?.forEach?.((c: CardData) => diPile.push(c));
        setDiscardPile(diPile);
      };

      updatePlayers();
      joinedRoom.onStateChange(updatePlayers);

      joinedRoom.onMessage("meld_error", (msg: { message: string }) => {
        setMeldError(msg.message);
      });

      cleanupRef.current = () => {
        joinedRoom.onStateChange.remove(updatePlayers);
        joined?.leave();
      };
    }).catch((err) => {
      if (!cancelled) setError(err.message || "Failed to join room");
    });

    return () => {
      cancelled = true;
      cleanupRef.current();
    };
  }, [token, roomId]);

  useEffect(() => {
    if (meldError) toast.error(meldError);
  }, [meldError]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <Button onClick={() => navigate("/")}>Back to Lobby</Button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground text-lg">Joining room...</p>
      </div>
    );
  }

  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayer?.sessionId === mySessionId;
  const canDraw = phase === "draw" && isMyTurn;
  const canDiscard = (phase === "discard" || phase === "main_phase") && isMyTurn;
  const canMeld = phase === "main_phase" && isMyTurn;

  const myPlayer = players.find((p) => p.sessionId === mySessionId);
  const myHand = myPlayer?.hand ?? [];
  const myBoard = myPlayer?.board ?? [];

  const canAddToMeld = canMeld && myBoard.length > 0;
  const opponents = players.filter((p) => p.sessionId !== mySessionId);

  const playerCount = players.length;
  const topOpponent = playerCount >= 4 ? opponents[0] : null;
  const sideOpponents = playerCount >= 4 ? opponents.slice(1) : opponents;
  const leftOpponent = sideOpponents[0] ?? null;
  const rightOpponent = sideOpponents[1] ?? null;

  const wildName = RANK_NAMES[wildRank] || String(wildRank);

  const handleDrawFromDeck = () => {
    if (!canDraw || !room) return;
    room.send("draw", { source: "deck" });
  };

  const handleDrawFromDiscard = () => {
    if (!canDraw || !room) return;
    room.send("draw", { source: "discard" });
  };

  const handleDiscard = (cardIndex: number) => {
    if (!canDiscard || !room) return;
    room.send("discard", { cardIndex });
  };

  const handleMeld = () => {
    if (!canMeld || stagedCards.length === 0 || !room) return;
    const indices = stagedCards.map((c) => c.handIndex);
    room.send("meld", { cardIndices: indices });
    setStagedCards([]);
    setSelectedCardIndices([]);
  };

  const handleClearStaging = () => {
    setStagedCards([]);
    setSelectedCardIndices([]);
  };

  const getCardFromHand = (handIndex: number): CardData | null => {
    return myHand[handIndex] ?? null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) {
      const data = active.data.current as Record<string, unknown> | undefined;
      if (data?.type === "staging") {
        const idx = data.stagingIndex as number;
        setStagedCards((prev) => prev.filter((_, i) => i !== idx));
      }
      return;
    }

    const dropId = over.id as string;
    const sourceData = active.data.current as Record<string, unknown> | undefined;
    if (!sourceData) return;

    // Hand-to-hand reorder
    if (sourceData.type === "hand" && dropId.startsWith("hand-")) {
      const activeHandIdx = sourceData.handIndex as number;
      const overHandIdx = parseInt(dropId.split("-")[1]);
      if (activeHandIdx !== overHandIdx) {
        const oldIdx = cardOrder.indexOf(activeHandIdx);
        const newIdx = cardOrder.indexOf(overHandIdx);
        if (oldIdx !== -1 && newIdx !== -1) {
          setCardOrder(arrayMove(cardOrder, oldIdx, newIdx));
        }
      }
      return;
    }

    if (dropId === "discard-pile" && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      if (canDiscard && room) {
        setStagedCards([]);
        setSelectedCardIndices([]);
        room.send("discard", { cardIndex: handIndex });
      }
      return;
    }

    if (dropId === "staging-well" && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      const card = getCardFromHand(handIndex);
      if (!card || !canMeld) return;
      setStagedCards((prev) => [...prev, { ...card, handIndex }]);
      return;
    }

    if (dropId.startsWith("meld-group-") && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      const meldGroupId = (over.data.current as Record<string, unknown> | undefined)?.meldGroupId as string;
      if (!room || !canMeld) return;
      room.send("add_to_meld", { cardIndex: handIndex, meldGroupId, preferSwap: false });
      return;
    }

    if (dropId.startsWith("wild-") && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      const meldGroupId = (over.data.current as Record<string, unknown> | undefined)?.meldGroupId as string;
      if (!room || !canMeld) return;
      room.send("add_to_meld", { cardIndex: handIndex, meldGroupId, preferSwap: true });
      return;
    }
  };

  const renderDragOverlay = () => {
    if (!activeDragId) return null;
    const data = (() => {
      const parts = activeDragId.split("-");
      if (parts[0] === "hand") {
        const idx = parseInt(parts[1]);
        const card = myHand[idx];
        if (card) return { rank: card.rank, suit: card.suit, wild: isWild(card, wildRank) };
      }
      if (parts[0] === "staging") {
        const idx = parseInt(parts[1]);
        const card = stagedCards[idx];
        if (card) return { rank: card.rank, suit: card.suit, wild: isWild(card, wildRank) };
      }
      return null;
    })();

    if (!data) return null;
    return (
      <div className="pointer-events-none rotate-3">
        <AnimatedCard
          rank={data.rank}
          suit={data.suit}
          wild={data.wild}
          layoutId={`card-${data.rank}-${data.suit}`}
        />
      </div>
    );
  };

  function getMeldGroups(player: PlayerState): Map<string, CardData[]> {
    const groups = new Map<string, CardData[]>();
    for (const card of player.board) {
      if (!card.meldGroupId) continue;
      const g = groups.get(card.meldGroupId);
      if (g) g.push(card);
      else groups.set(card.meldGroupId, [card]);
    }
    for (const [, group] of groups) {
      const nonWild = group.filter((c) => !isWild(c, wildRank));
      const wilds = group.filter((c) => isWild(c, wildRank));
      if (nonWild.length >= 2 && new Set(nonWild.map((c) => c.rank)).size > 1) {
        group.sort((a, b) => a.rank - b.rank);
      } else {
        group.length = 0; group.push(...nonWild, ...wilds);
      }
    }
    return groups;
  }

  const roundScores = players.map((p) => {
    const roundScore = p.hand.reduce(
      (sum, card) => sum + (card.rank === wildRank ? 25 : card.rank > 10 ? 10 : card.rank === 1 ? 10 : card.rank),
      0,
    );
    return { ...p, roundScore };
  });

  const rankedByScore = [...players].sort((a, b) => a.score - b.score);
  const rankMap = new Map(rankedByScore.map((p, i) => [p.sessionId, i + 1]));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground font-sans">
        {/* Scoreboard Sheet trigger */}
        <ScoreboardSheet matchDetail={matchDetail ?? null} />

        {/* Main board area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Top opponent (only for 4 players) */}
          {topOpponent && (
            <OpponentSection
              player={topOpponent}
              wildRank={wildRank}
              getMeldGroups={getMeldGroups}
              isMeldActive={canAddToMeld}
              timerPct={currentPlayer?.sessionId === topOpponent.sessionId ? timerPct : undefined}
              isTurn={currentPlayer?.sessionId === topOpponent.sessionId}
              rank={rankMap.get(topOpponent.sessionId)}
            />
          )}

          {/* Rhombus layout: left/right row then decks below */}
          <div className="relative flex flex-1 flex-col items-center">
            <div className="flex flex-col items-center gap-3 my-auto">
            {/* Left + Right opponents row */}
            <div className="flex items-start justify-center gap-12 sm:gap-24">
              {/* Left opponent */}
              {leftOpponent && (
                <div className="flex flex-col items-center gap-2 p-1.5 sm:p-2 max-sm:hidden">
                  <PlayerChip player={leftOpponent} isTurn={currentPlayer?.sessionId === leftOpponent.sessionId} timerPct={currentPlayer?.sessionId === leftOpponent.sessionId ? timerPct : undefined} rank={rankMap.get(leftOpponent.sessionId)} />
                  <div className="flex gap-0.5">
                    {leftOpponent.hand.map((_, i) => (
                      <AnimatedCard key={i} faceDown small />
                    ))}
                  </div>
                  <MeldsDisplay player={leftOpponent} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={canAddToMeld} />
                </div>
              )}

              {/* Right opponent */}
              {rightOpponent && (
                <div className="flex flex-col items-center gap-2 p-1.5 sm:p-2 max-sm:hidden">
                  <PlayerChip player={rightOpponent} isTurn={currentPlayer?.sessionId === rightOpponent.sessionId} timerPct={currentPlayer?.sessionId === rightOpponent.sessionId ? timerPct : undefined} rank={rankMap.get(rightOpponent.sessionId)} />
                  <div className="flex gap-0.5">
                    {rightOpponent.hand.map((_, i) => (
                      <AnimatedCard key={i} faceDown small />
                    ))}
                  </div>
                  <MeldsDisplay player={rightOpponent} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={canAddToMeld} />
                </div>
              )}
            </div>

            {/* Decks row (below left/right) */}
            <div className="flex items-start gap-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-1 text-[11px] font-semibold">Draw</p>
                  <AnimatedCard
                    faceDown
                    onClick={handleDrawFromDeck}
                    disabled={!canDraw}
                    layoutId="draw-pile"
                    badge={drawPile.length}
                    glow={canDraw ? "green" : undefined}
                  />
              </div>
              <DiscardZone
                discardPile={discardPile}
                wildRank={wildRank}
                isActive={canDraw || canDiscard}
                onClick={canDraw ? handleDrawFromDiscard : undefined}
                activeGlow={canDraw ? "green" : canDiscard ? "red" : undefined}
              />
            </div>

            {status === "waiting" && players.length >= 3 && (
              <Button size="lg" onClick={() => room?.send("start_game")}>
                Start Game
              </Button>
            )}

            {meldError && <p className="text-destructive m-0 text-xs">{meldError}</p>}
            </div>
          </div>

          {/* Bottom: your area */}
          <div className="relative flex flex-shrink-0 flex-col items-center gap-1.5 px-4 py-2 bg-muted/30">
            {isMyTurn && timerPct <= 10 && (
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/8 to-red-500/0 animate-pulse pointer-events-none" />
            )}
            <StagingWell
              cards={stagedCards}
              wildRank={wildRank}
              onPlay={handleMeld}
              onClear={handleClearStaging}
              isActive={canMeld}
            />
            {myBoard.length > 0 && (
              <div className="flex items-center gap-2">
                {[...getMeldGroups(myPlayer!)].map(([meldGroupId, group]) => (
                  <MeldGroup
                    key={meldGroupId}
                    meldGroupId={meldGroupId}
                    cards={group}
                    wildRank={wildRank}
                    isOwn
                    isActive={canAddToMeld}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-0.5">
              {myHand.length === 0 && (
                <p className="text-muted-foreground p-2 text-xs">Waiting for game to start...</p>
              )}
              {myHand.length > 0 && (
                <SortableContext items={cardOrder.map((i) => `hand-${i}`)} strategy={horizontalListSortingStrategy}>
                  {cardOrder.map((idx) => {
                    const card = myHand[idx];
                    if (!card) return null;
                    const isStaged = stagedCards.some((s) => s.handIndex === idx);
                    if (isStaged) return null;
                    const isSelected = selectedCardIndices.includes(idx);
                    return (
                      <SortableHandCard
                        key={idx}
                        handIndex={idx}
                        card={card}
                        wildRank={wildRank}
                        selected={isSelected}
                        canMeld={canMeld}
                        canDiscard={canDiscard}
                        onClick={
                          canMeld
                            ? () => setSelectedCardIndices((prev) =>
                                prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                              )
                            : canDiscard
                            ? () => handleDiscard(idx)
                            : undefined
                        }
                      />
                    );
                  })}
                </SortableContext>
              )}
            </div>

            <PlayerChip player={myPlayer ?? { sessionId: mySessionId, userId: "", name: "You", score: 0, disconnected: false, hand: [], board: [] }} isTurn={isMyTurn} timerPct={isMyTurn ? timerPct : undefined} rank={myPlayer ? rankMap.get(myPlayer.sessionId) : null} />
          </div>
        </div>

        {/* Round ended overlay */}
        {phase === "round_ended" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Round {currentRound + 1} Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-sm">Wild: {wildName}</p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="px-2 py-1 text-left">Player</th>
                      <th className="px-2 py-1 text-right">Round</th>
                      <th className="px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundScores.map((p) => (
                      <tr key={p.sessionId} className="border-border/50 border-b">
                        <td className="px-2 py-1">{p.name}</td>
                        <td className="px-2 py-1 text-right">{p.roundScore}</td>
                        <td className="px-2 py-1 text-right">{p.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Match finished */}
        {status === "finished" && winnerSessionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Match Over!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-primary text-base font-bold">
                  Winner: {players.find((p) => p.sessionId === winnerSessionId)?.name ?? "Unknown"}
                </p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">Player</th>
                      <th className="px-2 py-1 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...players]
                      .sort((a, b) => a.score - b.score)
                      .map((p, i) => (
                        <tr key={p.sessionId} className="border-border/50 border-b">
                          <td className="px-2 py-1">{i + 1}</td>
                          <td className="px-2 py-1">{p.name}</td>
                          <td className="px-2 py-1 text-right">{p.score}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <Button className="w-full" onClick={() => { cleanupRef.current(); navigate("/"); }}>
                  Back to Lobby
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {renderDragOverlay()}
      </DragOverlay>
    </DndContext>
  );
}
