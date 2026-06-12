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
      <div style={{ padding: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Error</h1>
        <p style={{ marginBottom: 16 }}>{error}</p>
        <button onClick={() => navigate("/")}
          style={{ padding: "8px 20px", cursor: "pointer" }}
        >Back to Lobby</button>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p style={{ fontSize: 18, color: "#888" }}>Joining room...</p>
      </div>
    );
  }

  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayer?.sessionId === mySessionId;
  const canDraw = phase === "draw" && isMyTurn;
  const canDiscard = phase === "discard" && isMyTurn;
  const canMeld = phase === "main_phase" && isMyTurn;

  const myPlayer = players.find((p) => p.sessionId === mySessionId);
  const myHand = myPlayer?.hand ?? [];
  const myBoard = myPlayer?.board ?? [];
  const canAddToMeld = canMeld && myBoard.length > 0;
  const opponents = players.filter((p) => p.sessionId !== mySessionId);

  // Arrange opponents: top, right, left (for 3-4 players)
  const topOpponent = opponents[0] ?? null;
  const rightOpponent = opponents[1] ?? null;
  const leftOpponent = opponents[2] ?? null;

  const wildName = RANK_NAMES[wildRank] || String(wildRank);

  // ── Handlers ──

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

  // ── Drag and Drop ──

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
      // Dropped in the void — if from staging, return to hand
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

    // ── Discard pile drop ──
    if (dropId === "discard-pile" && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      if (canDiscard && room) {
        room.send("discard", { cardIndex: handIndex });
      }
      return;
    }

    // ── Staging well drop ──
    if (dropId === "staging-well" && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      const card = getCardFromHand(handIndex);
      if (!card || !canMeld) return;
      setStagedCards((prev) => [...prev, { ...card, handIndex }]);
      return;
    }

    // ── Meld group drop (add card) ──
    if (dropId.startsWith("meld-group-") && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      const meldGroupId = (over.data.current as Record<string, unknown> | undefined)?.meldGroupId as string;
      if (!room || !canMeld) return;
      room.send("add_to_meld", { cardIndex: handIndex, meldGroupId, preferSwap: false });
      return;
    }

    // ── Wild card drop (swap wild) ──
    if (dropId.startsWith("wild-") && sourceData.type === "hand") {
      const handIndex = sourceData.handIndex as number;
      const meldGroupId = (over.data.current as Record<string, unknown> | undefined)?.meldGroupId as string;
      if (!room || !canMeld) return;
      room.send("add_to_meld", { cardIndex: handIndex, meldGroupId, preferSwap: true });
      return;
    }

    // ── Staging card dropped back in void ── handled above in !over
  };

  // ── Drag Overlay render ──

  const renderDragOverlay = () => {
    if (!activeDragId) return null;
    const data = (() => {
      // Check hand
      const parts = activeDragId.split("-");
      if (parts[0] === "hand") {
        const idx = parseInt(parts[1]);
        const card = myHand[idx];
        if (card) return { rank: card.rank, suit: card.suit, wild: isWild(card, wildRank) };
      }
      // Check staging
      if (parts[0] === "staging") {
        const idx = parseInt(parts[1]);
        const card = stagedCards[idx];
        if (card) return { rank: card.rank, suit: card.suit, wild: isWild(card, wildRank) };
      }
      return null;
    })();

    if (!data) return null;
    return (
      <div style={{ pointerEvents: "none", transform: "rotate(3deg)" }}>
        <AnimatedCard
          rank={data.rank}
          suit={data.suit}
          wild={data.wild}
          layoutId={`card-${data.rank}-${data.suit}`}
        />
      </div>
    );
  };

  // ── Meld groups data ──

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

  // ── Round scores ──

  const roundScores = players.map((p) => {
    const roundScore = p.hand.reduce(
      (sum, card) => sum + (card.rank === wildRank ? 25 : card.rank > 10 ? 10 : card.rank === 1 ? 10 : card.rank),
      0,
    );
    return { ...p, roundScore };
  });

  // ── Render ──

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#1a5c2a",
        fontFamily: "system-ui, sans-serif",
        color: "#fff",
      }}>
        {/* Top bar: round info */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "6px 16px",
          background: "rgba(0,0,0,0.2)",
          fontSize: 13,
          flexShrink: 0,
        }}>
          <span>Round {currentRound + 1}/13</span>
          <span style={{ fontWeight: "bold" }}>Wild: {wildName}</span>
          {status === "playing" && phase !== "waiting" && (
            <span>Phase: {phase === "draw" ? "Draw" : phase === "main_phase" ? "Meld" : "Discard"}</span>
          )}
          {phase === "waiting" && <span>Waiting for players...</span>}
        </div>

        {/* Timer bar */}
        {status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished" && (
          <div style={{ height: 4, width: "100%", background: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
            {isMyTurn ? (
              <div style={{
                width: `${timerPct}%`,
                height: "100%",
                background: timerPct > 30 ? "#4caf50" : timerPct > 10 ? "#ff9800" : "#f44336",
                transition: "width 0.1s linear",
              }} />
            ) : (
              <div style={{
                width: `${timerPct}%`,
                height: "100%",
                background: "#555",
                transition: "width 0.1s linear",
                opacity: 0.5,
              }} />
            )}
          </div>
        )}

        {/* Main board area */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Top opponent */}
          {topOpponent && (
            <OpponentSection
              player={topOpponent}
              wildRank={wildRank}
              getMeldGroups={getMeldGroups}
              isMeldActive={canAddToMeld}
            />
          )}

          {/* Middle: left opponent + center area + right opponent */}
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}>
            {/* Left opponent */}
            {leftOpponent && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 8, width: 140, flexShrink: 0 }}>
                <PlayerChip player={leftOpponent} />
                <div style={{ display: "flex", gap: 2 }}>
                  {leftOpponent.hand.map((_, i) => (
                    <AnimatedCard key={i} faceDown small />
                  ))}
                </div>
                <MeldsDisplay
                  player={leftOpponent}
                  wildRank={wildRank}
                  getMeldGroups={getMeldGroups}
                  isMeldActive={canAddToMeld}
                />
              </div>
            )}

            {/* Center: draw, discard, staging */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}>
              {/* Draw + Discard */}
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: "rgba(255,255,255,0.7)" }}>
                    Draw
                  </p>
                  <AnimatedCard
                    faceDown
                    onClick={handleDrawFromDeck}
                    disabled={!canDraw}
                    layoutId="draw-pile"
                  />
                  <p style={{ fontSize: 10, marginTop: 4, color: "rgba(255,255,255,0.5)" }}>
                    {drawPile.length}
                  </p>
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
                <button onClick={() => room?.send("start_game")}
                  style={{ padding: "10px 24px", fontSize: 15, fontWeight: "bold", cursor: "pointer", background: "#4caf50", color: "#fff", border: "none", borderRadius: 8 }}
                >Start Game</button>
              )}

              {canMeld && interactionMode === "none" && stagedCards.length === 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handlePassMeld}
                    style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6 }}
                  >Pass Meld</button>
                  {canAddToMeld && (
                    <button onClick={handleEnterAddMode}
                      style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6 }}
                    >Add to Meld</button>
                  )}
                </div>
              )}

              {interactionMode === "adding" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontStyle: "italic", color: "rgba(255,255,255,0.8)" }}>
                    Click a meld group to add card
                  </span>
                  <button onClick={handleCancelMode}
                    style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6 }}
                  >Cancel</button>
                </div>
              )}

              {meldError && (
                <p style={{ fontSize: 12, color: "#ff6b6b", margin: 0 }}>{meldError}</p>
              )}
            </div>

            {/* Right opponent */}
            {rightOpponent && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 8, width: 140, flexShrink: 0 }}>
                <PlayerChip player={rightOpponent} />
                <div style={{ display: "flex", gap: 2 }}>
                  {rightOpponent.hand.map((_, i) => (
                    <AnimatedCard key={i} faceDown small />
                  ))}
                </div>
                <MeldsDisplay
                  player={rightOpponent}
                  wildRank={wildRank}
                  getMeldGroups={getMeldGroups}
                  isMeldActive={canAddToMeld}
                />
              </div>
            )}
          </div>

          {/* Bottom: your area */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            flexShrink: 0,
            background: "rgba(0,0,0,0.15)",
          }}>
            {/* Your melds */}
            {myBoard.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

            {/* Your hand */}
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
              {myHand.length === 0 && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: 8 }}>
                  Waiting for game to start...
                </p>
              )}
              {myHand.map((card, i) => {
                const isStaged = stagedCards.some((s) => s.handIndex === i);
                if (isStaged) return null;
                const isSelected = selectedCardIndices.includes(i);
                return (
                  <AnimatedCard
                    key={i}
                    rank={card.rank}
                    suit={card.suit}
                    wild={isWild(card, wildRank)}
                    selected={isSelected}
                    dragId={`hand-${i}`}
                    dragData={{ type: "hand", handIndex: i, rank: card.rank, suit: card.suit }}
                    layoutId={`card-${card.rank}-${card.suit}`}
                    onClick={
                      canMeld
                        ? () => setSelectedCardIndices((prev) =>
                            prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                          )
                        : canDiscard
                        ? () => handleDiscard(i)
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
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}>
            <div style={{ background: "#fff", color: "#333", borderRadius: 12, padding: 24, minWidth: 320, maxWidth: 400 }}>
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>Round {currentRound + 1} Summary</h2>
              <p style={{ fontSize: 14, marginBottom: 12, color: "#666" }}>Wild: {wildName}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>Player</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Round</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {roundScores.map((p) => (
                    <tr key={p.sessionId} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "4px 8px" }}>{p.name}</td>
                      <td style={{ textAlign: "right", padding: "4px 8px" }}>{p.roundScore}</td>
                      <td style={{ textAlign: "right", padding: "4px 8px" }}>{p.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Match finished */}
        {status === "finished" && winnerSessionId && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}>
            <div style={{ background: "#fff", color: "#333", borderRadius: 12, padding: 24, minWidth: 320, maxWidth: 400 }}>
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>Match Over!</h2>
              <p style={{ fontSize: 16, marginBottom: 16, color: "#4caf50", fontWeight: "bold" }}>
                Winner: {players.find((p) => p.sessionId === winnerSessionId)?.name ?? "Unknown"}
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>#</th>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>Player</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...players]
                    .sort((a, b) => a.score - b.score)
                    .map((p, i) => (
                      <tr key={p.sessionId} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "4px 8px" }}>{i + 1}</td>
                        <td style={{ padding: "4px 8px" }}>{p.name}</td>
                        <td style={{ textAlign: "right", padding: "4px 8px" }}>{p.score}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <button onClick={() => { cleanupRef.current(); navigate("/"); }}
                style={{ padding: "8px 20px", cursor: "pointer", width: "100%" }}
              >Back to Lobby</button>
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

// ── Sub-components ──

function PlayerChip({ player }: { player: { name: string; score: number; disconnected: boolean } }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 8,
      background: "rgba(0,0,0,0.2)", fontSize: 12,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%",
        background: "#4a90d9", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontWeight: "bold", fontSize: 11, color: "#fff",
      }}>
        {player.name.charAt(0).toUpperCase()}
      </div>
      <span style={{ fontWeight: 600 }}>{player.name}</span>
      <span style={{ color: "rgba(255,255,255,0.6)" }}>{player.score}</span>
      {player.disconnected && (
        <span style={{ color: "#ff6b6b", fontSize: 10 }}>(DC)</span>
      )}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
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
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "6px 16px", flexShrink: 0,
    }}>
      <PlayerChip player={player} />
      <div style={{ display: "flex", gap: 2 }}>
        {player.hand.map((_, i) => (
          <AnimatedCard key={i} faceDown small />
        ))}
      </div>
      <MeldsDisplay
        player={player}
        wildRank={wildRank}
        getMeldGroups={getMeldGroups}
        isMeldActive={isMeldActive}
      />
    </div>
  );
}
