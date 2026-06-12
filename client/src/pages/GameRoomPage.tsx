import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Room } from "colyseus.js";
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
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

type InteractionMode = "none" | "adding" | "swapping";

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

function PlayerChip({ player }: { player: { name: string; score: number; disconnected: boolean } }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-xs">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
        {player.name.charAt(0).toUpperCase()}
      </span>
      <span className="font-semibold">{player.name}</span>
      <span className="text-muted-foreground">{player.score}</span>
      {player.disconnected && <span className="text-destructive text-[10px]">(DC)</span>}
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
  player, wildRank, getMeldGroups, isMeldActive,
}: {
  player: PlayerState;
  wildRank: number;
  getMeldGroups: (p: PlayerState) => Map<string, CardData[]>;
  isMeldActive: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 flex-col items-center gap-1 px-4 py-1.5">
      <PlayerChip player={player} />
      <div className="flex gap-0.5">
        {player.hand.map((_, i) => (
          <AnimatedCard key={i} faceDown small />
        ))}
      </div>
      <MeldsDisplay player={player} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={isMeldActive} />
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
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("none");
  const [addCardIndex, setAddCardIndex] = useState<number | null>(null);
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const cleanupRef = useRef<() => void>(() => {});
  const [timerPct, setTimerPct] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [stagedCards, setStagedCards] = useState<StagedCard[]>([]);
  const [cardOrder, setCardOrder] = useState<number[]>([]);

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

        const myHand = list.find((p) => p.sessionId === sessionId)?.hand;
        if (myHand) {
          setSelectedCardIndices((prev) => prev.filter((i) => i < myHand.length));
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">Error</h1>
        <p className="text-muted-foreground">{error}</p>
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

  useEffect(() => {
    setCardOrder((prev) => {
      if (prev.length === myHand.length) return prev;
      return myHand.map((_, i) => i);
    });
  }, [myHand.length]);
  const canAddToMeld = canMeld && myBoard.length > 0;
  const opponents = players.filter((p) => p.sessionId !== mySessionId);

  const topOpponent = opponents[0] ?? null;
  const rightOpponent = opponents[1] ?? null;
  const leftOpponent = opponents[2] ?? null;

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

  const handlePassMeld = () => {
    if (!canMeld || !room) return;
    room.send("pass_meld");
    setSelectedCardIndices([]);
    setStagedCards([]);
  };

  const handleCancelMode = () => {
    setInteractionMode("none");
    setAddCardIndex(null);
    setMeldError(null);
  };

  const handleEnterAddMode = () => {
    setInteractionMode("adding");
    setAddCardIndex(null);
    setMeldError(null);
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground font-sans">
        {/* Top bar: round info */}
        <div className="flex flex-shrink-0 items-center justify-center gap-4 bg-muted/50 px-4 py-1.5 text-xs">
          <span>Round {currentRound + 1}/13</span>
          <span className="font-semibold">Wild: {wildName}</span>
          {status === "playing" && phase !== "waiting" && (
            <span>Phase: {phase === "draw" ? "Draw" : phase === "main_phase" ? "Meld" : "Discard"}</span>
          )}
          {phase === "waiting" && <span>Waiting for players...</span>}
        </div>

        {/* Timer bar */}
        {status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished" && (
          <div className="h-1 w-full flex-shrink-0 bg-muted">
            <div
              className="h-full transition-[width] duration-100 linear"
              style={{
                width: `${timerPct}%`,
                background: isMyTurn
                  ? timerPct > 30 ? "var(--color-primary)" : timerPct > 10 ? "#ff9800" : "#f44336"
                  : "var(--color-muted-foreground)",
                opacity: isMyTurn ? 1 : 0.5,
              }}
            />
          </div>
        )}

        {/* Main board area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Top opponent */}
          {topOpponent && (
            <OpponentSection
              player={topOpponent}
              wildRank={wildRank}
              getMeldGroups={getMeldGroups}
              isMeldActive={canAddToMeld}
            />
          )}

          {/* Middle: left opponent + center + right opponent */}
          <div className="relative flex flex-1 items-center">
            {/* Left opponent */}
            {leftOpponent && (
              <div className="flex w-[140px] flex-shrink-0 flex-col items-center gap-2 p-2">
                <PlayerChip player={leftOpponent} />
                <div className="flex gap-0.5">
                  {leftOpponent.hand.map((_, i) => (
                    <AnimatedCard key={i} faceDown small />
                  ))}
                </div>
                <MeldsDisplay player={leftOpponent} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={canAddToMeld} />
              </div>
            )}

            {/* Center: draw, discard, staging */}
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              {/* Draw + Discard */}
              <div className="flex items-start gap-6">
                <div className="text-center">
                  <p className="text-muted-foreground mb-1 text-[11px] font-semibold">Draw</p>
                  <AnimatedCard
                    faceDown
                    onClick={handleDrawFromDeck}
                    disabled={!canDraw}
                    layoutId="draw-pile"
                  />
                  <p className="text-muted-foreground mt-1 text-[10px]">{drawPile.length}</p>
                </div>
                <DiscardZone
                  discardPile={discardPile}
                  wildRank={wildRank}
                  isActive={canDiscard}
                />
              </div>

              {/* Staging Well */}
              <StagingWell
                cards={stagedCards}
                wildRank={wildRank}
                onPlay={handleMeld}
                onClear={handleClearStaging}
                isActive={canMeld}
              />

              {/* Action buttons */}
              {status === "waiting" && players.length >= 3 && (
                <Button size="lg" onClick={() => room?.send("start_game")}>
                  Start Game
                </Button>
              )}

              {canMeld && interactionMode === "none" && stagedCards.length === 0 && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handlePassMeld}>Pass Meld</Button>
                  {canAddToMeld && (
                    <Button variant="secondary" onClick={handleEnterAddMode}>Add to Meld</Button>
                  )}
                </div>
              )}

              {interactionMode === "adding" && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs italic">
                    Click a meld group to add card
                  </span>
                  <Button variant="ghost" size="sm" onClick={handleCancelMode}>Cancel</Button>
                </div>
              )}

              {meldError && <p className="text-destructive m-0 text-xs">{meldError}</p>}
            </div>

            {/* Right opponent */}
            {rightOpponent && (
              <div className="flex w-[140px] flex-shrink-0 flex-col items-center gap-2 p-2">
                <PlayerChip player={rightOpponent} />
                <div className="flex gap-0.5">
                  {rightOpponent.hand.map((_, i) => (
                    <AnimatedCard key={i} faceDown small />
                  ))}
                </div>
                <MeldsDisplay player={rightOpponent} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={canAddToMeld} />
              </div>
            )}
          </div>

          {/* Bottom: your area */}
          <div className="flex flex-shrink-0 flex-col items-center gap-1.5 bg-muted/30 px-4 py-2">
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
              {cardOrder.map((idx) => {
                const card = myHand[idx];
                if (!card) return null;
                const isStaged = stagedCards.some((s) => s.handIndex === idx);
                if (isStaged) return null;
                const isSelected = selectedCardIndices.includes(idx);
                return (
                  <AnimatedCard
                    key={idx}
                    rank={card.rank}
                    suit={card.suit}
                    wild={isWild(card, wildRank)}
                    selected={isSelected}
                    dragId={`hand-${idx}`}
                    dragData={{ type: "hand", handIndex: idx, rank: card.rank, suit: card.suit }}
                    layoutId={`card-${card.rank}-${card.suit}`}
                    onClick={
                      canMeld
                        ? () => setSelectedCardIndices((prev) =>
                            prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                          )
                        : canDiscard
                        ? () => handleDiscard(idx)
                        : undefined
                    }
                    disabled={!canMeld && !canDiscard}
                  />
                );
              })}
            </div>

            <PlayerChip player={myPlayer ?? { sessionId: mySessionId, userId: "", name: "You", score: 0, disconnected: false, hand: [], board: [] }} />
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
