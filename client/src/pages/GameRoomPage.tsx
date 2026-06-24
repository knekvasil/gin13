import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchMatchDetail } from "../stats/api";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
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
import PlayerChip from "../components/PlayerChip";
import { Button } from "../components/ui/button";
import ScoreboardSheet from "../components/ScoreboardSheet";
import MatchOverScreen from "../components/MatchOverScreen";
import RoundTransitionOverlay from "../components/RoundTransitionOverlay";
import { useGameRoom, type CardData, type PlayerState, type StagedCard } from "../hooks/useGameRoom";

function MeldsDisplay({
  player, wildRank, getMeldGroups, isMeldActive, celebrating,
}: {
  player: PlayerState;
  wildRank: number;
  getMeldGroups: (p: PlayerState) => Map<string, CardData[]>;
  isMeldActive: boolean;
  celebrating?: boolean;
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
          celebrating={celebrating}
        />
      ))}
    </div>
  );
}

function OpponentSection({
  player, wildRank, getMeldGroups, isMeldActive, timerPct, isTurn, rank, celebrating,
}: {
  player: PlayerState;
  wildRank: number;
  getMeldGroups: (p: PlayerState) => Map<string, CardData[]>;
  isMeldActive: boolean;
  timerPct?: number;
  isTurn?: boolean;
  rank?: number | null;
  celebrating?: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 flex-col items-center gap-1 px-2 py-1.5">
      <PlayerChip player={player} isTurn={isTurn} timerPct={timerPct} rank={rank} />
      <div className="flex gap-0.5">
        {player.hand.map((_, i) => (
          <AnimatedCard key={i} faceDown small />
        ))}
      </div>
      <MeldsDisplay player={player} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={isMeldActive} celebrating={celebrating} />
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
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition: isDragging ? transition : 'none 0s', opacity: isDragging ? 0 : 1 }}
        {...attributes}
        {...listeners}
      >
        <AnimatedCard
          rank={card.rank}
          suit={card.suit}
          wild={card.rank === wildRank}
          selected={selected}
          onClick={onClick}
          disabled={!canMeld && !canDiscard}
        />
      </div>
    </motion.div>
  );
}

export default function GameRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const {
    room, players, status, phase, currentRound, wildRank,
    currentPlayerIndex, winnerSessionId, drawPile, discardPile,
    mySessionId, error, cardOrder, setCardOrder,
    showCelebration, showRoundTransition, handledRoundRef,
    setShowRoundTransition, send, navigateHome,
  } = useGameRoom(roomId, token);

  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [timerPct, setTimerPct] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [stagedCards, setStagedCards] = useState<StagedCard[]>([]);

  const { data: matchDetail } = useQuery({
    queryKey: ["matchDetail", roomId, currentRound],
    queryFn: () => fetchMatchDetail(roomId!),
    enabled: !!roomId,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const customCollision: CollisionDetection = (args) => {
    const activeData = args.active.data.current as Record<string, unknown> | undefined;
    if (activeData?.type === "hand") {
      const filtered = args.droppableContainers.filter(
        (c) => String(c.id) === "staging-well" || !String(c.id).startsWith("staging-"),
      );
      return closestCorners({ ...args, droppableContainers: filtered });
    }
    return closestCorners(args);
  };

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
    if (status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished") {
      startClientTimer();
    } else {
      clearTimer();
      setTimerPct(100);
    }
  }, [status, phase, currentPlayerIndex, currentRound, startClientTimer, clearTimer]);

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

  const handleDrawFromDeck = () => send("draw", { source: "deck" });
  const handleDrawFromDiscard = () => send("draw", { source: "discard" });
  const handleDiscard = (cardIndex: number) => send("discard", { cardIndex });

  const handleMeld = () => {
    if (!canMeld || stagedCards.length === 0) return;
    const indices = stagedCards.map((c) => c.handIndex);
    send("meld", { cardIndices: indices });
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
        send("discard", { cardIndex: handIndex });
      }
      return;
    }

    if (sourceData.type === "staging" && dropId.startsWith("staging-")) {
      const fromIdx = sourceData.stagingIndex as number;
      const toIdx = parseInt(dropId.split("-")[1]);
      if (fromIdx !== toIdx) {
        setStagedCards((prev) => arrayMove(prev, fromIdx, toIdx));
      }
      return;
    }

    if (sourceData.type === "hand" && (dropId === "staging-well" || dropId.startsWith("staging-"))) {
      const handIndex = sourceData.handIndex as number;
      const card = getCardFromHand(handIndex);
      if (!card || !canMeld) return;
      setStagedCards((prev) => [...prev, { ...card, handIndex }]);
      return;
    }

    if (sourceData.type === "hand" && (dropId.startsWith("meld-group-start-") || dropId.startsWith("meld-group-end-") || dropId.startsWith("meld-group-"))) {
      const handIndex = sourceData.handIndex as number;
      const meldGroupId = (over.data.current as Record<string, unknown> | undefined)?.meldGroupId as string;
      if (!canMeld) return;
      let position: "start" | "end" | undefined;
      if (dropId.startsWith("meld-group-start-")) position = "start";
      else position = "end";
      send("add_to_meld", { cardIndex: handIndex, meldGroupId, preferSwap: false, position });
      return;
    }

    if (dropId.startsWith("wild-") && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      const dropData = over.data.current as Record<string, unknown> | undefined;
      const meldGroupId = dropData?.meldGroupId as string;
      const meldCardIndex = dropData?.meldCardIndex as number;
      if (!canMeld) return;
      if (sourceData.rank === wildRank) {
        send("add_to_meld", { cardIndex: handIndex, meldGroupId, preferSwap: false });
      } else {
        send("swap_wild", { meldGroupId, meldCardIndex, handCardIndex: handIndex });
      }
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
        <AnimatedCard rank={data.rank} suit={data.suit} wild={data.wild} layoutId={`card-${data.rank}-${data.suit}`} />
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
    return groups;
  }

  const rankedByScore = [...players].sort((a, b) => a.score - b.score);
  const rankMap = new Map(rankedByScore.map((p, i) => [p.sessionId, i + 1]));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <Button onClick={() => navigate("/lobby")}>Back to Lobby</Button>
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground font-sans">
        <ScoreboardSheet matchDetail={matchDetail ?? null} />

        <div className="relative flex flex-1 flex-col overflow-hidden">
          {topOpponent && (
            <OpponentSection
              player={topOpponent}
              wildRank={wildRank}
              getMeldGroups={getMeldGroups}
              isMeldActive={canAddToMeld}
              timerPct={currentPlayer?.sessionId === topOpponent.sessionId ? timerPct : undefined}
              isTurn={currentPlayer?.sessionId === topOpponent.sessionId}
              rank={rankMap.get(topOpponent.sessionId)}
              celebrating={showCelebration}
            />
          )}

          <div className="relative flex flex-1 flex-col items-center">
            <div className="flex flex-col items-center gap-3 my-auto">
              <div className="flex items-start justify-center gap-12 sm:gap-24">
                {leftOpponent && (
                  <div className="flex flex-col items-center gap-2 p-1.5 sm:p-2 max-sm:hidden">
                    <PlayerChip player={leftOpponent} isTurn={currentPlayer?.sessionId === leftOpponent.sessionId} timerPct={currentPlayer?.sessionId === leftOpponent.sessionId ? timerPct : undefined} rank={rankMap.get(leftOpponent.sessionId)} />
                    <div className="flex gap-0.5">
                      {leftOpponent.hand.map((_, i) => (
                        <AnimatedCard key={i} faceDown small />
                      ))}
                    </div>
                    <MeldsDisplay player={leftOpponent} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={canAddToMeld} celebrating={showCelebration} />
                  </div>
                )}

                {rightOpponent && (
                  <div className="flex flex-col items-center gap-2 p-1.5 sm:p-2 max-sm:hidden">
                    <PlayerChip player={rightOpponent} isTurn={currentPlayer?.sessionId === rightOpponent.sessionId} timerPct={currentPlayer?.sessionId === rightOpponent.sessionId ? timerPct : undefined} rank={rankMap.get(rightOpponent.sessionId)} />
                    <div className="flex gap-0.5">
                      {rightOpponent.hand.map((_, i) => (
                        <AnimatedCard key={i} faceDown small />
                      ))}
                    </div>
                    <MeldsDisplay player={rightOpponent} wildRank={wildRank} getMeldGroups={getMeldGroups} isMeldActive={canAddToMeld} celebrating={showCelebration} />
                  </div>
                )}
              </div>

              <div className="flex items-start gap-6">
                <div className="text-center">
                  <p className="text-muted-foreground mb-1 text-[11px] font-semibold">Draw</p>
                  <AnimatedCard faceDown onClick={handleDrawFromDeck} disabled={!canDraw} layoutId="draw-pile" badge={drawPile.length} glow={canDraw ? "green" : undefined} />
                </div>
                <DiscardZone discardPile={discardPile} wildRank={wildRank} isActive={canDraw || canDiscard} onClick={canDraw ? handleDrawFromDiscard : undefined} activeGlow={canDraw ? "green" : canDiscard ? "red" : undefined} />
              </div>

              {status === "waiting" && players.length >= 3 && (
                <Button size="lg" onClick={() => send("start_game")}>
                  Start Game
                </Button>
              )}
            </div>
          </div>

          <div className="relative flex flex-shrink-0 flex-col items-center gap-1.5 px-4 py-2 bg-muted/30">
            {isMyTurn && timerPct <= 10 && (
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/8 to-red-500/0 animate-pulse pointer-events-none" />
            )}
            <StagingWell cards={stagedCards} wildRank={wildRank} onPlay={handleMeld} onClear={handleClearStaging} isActive={canMeld} />
            {myBoard.length > 0 && (
              <div className="flex items-center gap-2">
                {[...getMeldGroups(myPlayer!)].map(([meldGroupId, group]) => (
                  <MeldGroup key={meldGroupId} meldGroupId={meldGroupId} cards={group} wildRank={wildRank} isOwn isActive={canAddToMeld} celebrating={showCelebration} />
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

        {showRoundTransition && matchDetail && (
          <RoundTransitionOverlay
            matchDetail={matchDetail}
            playerCumulativeScores={players.map((p) => ({
              userId: p.userId,
              name: p.name,
              cumulativeScore: p.score,
            }))}
            highlightRound={currentRound}
            onContinue={() => setShowRoundTransition(false)}
          />
        )}

        {status === "finished" && winnerSessionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto">
            <div className="bg-background rounded-lg border p-6 m-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Match Over!</h2>
                <Button variant="outline" size="sm" onClick={() => { navigateHome(); navigate("/lobby"); }}>
                  Back to Lobby
                </Button>
              </div>
              {matchDetail && <MatchOverScreen matchDetail={matchDetail} />}
            </div>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {renderDragOverlay()}
      </DragOverlay>
    </DndContext>
  );
}
