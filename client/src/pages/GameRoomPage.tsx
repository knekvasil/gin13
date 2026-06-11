import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Room } from "colyseus.js";
import Card from "../components/Card";

function isWild(card: { rank: number }, wildRank: number): boolean {
  return card.rank === wildRank;
}

function canMeldCards(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length < 3) return false;
  return isValidSet(cards, wildRank) || isValidStraightFlush(cards, wildRank);
}

function isValidSet(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length > 4 || cards.length < 3) return false;
  if (cards.every((c) => isWild(c, wildRank))) return true;
  let setRank: number | null = null;
  const suits = new Set<number>();
  for (const c of cards) {
    if (isWild(c, wildRank)) continue;
    if (setRank === null) setRank = c.rank;
    else if (c.rank !== setRank) return false;
    if (suits.has(c.suit)) return false;
    suits.add(c.suit);
  }
  if (setRank === null) return false;
  const wildCount = cards.filter((c) => isWild(c, wildRank)).length;
  return suits.size === cards.length - wildCount;
}

function isValidStraightFlush(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length < 4) return false;
  let suit: number | null = null;
  const nonWild: number[] = [];
  let wildCount = 0;
  for (const c of cards) {
    if (isWild(c, wildRank)) { wildCount++; continue; }
    if (suit === null) suit = c.suit;
    else if (c.suit !== suit) return false;
    nonWild.push(c.rank);
  }
  if (suit === null) return false;
  const unique = new Set(nonWild);
  if (unique.size !== nonWild.length) return false;
  nonWild.sort((a, b) => a - b);
  const min = nonWild[0]!, max = nonWild[nonWild.length - 1]!;
  if (max - min >= 12) return false;
  return max - min + 1 - nonWild.length <= wildCount;
}

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
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [meldError, setMeldError] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("none");
  const [addCardIndex, setAddCardIndex] = useState<number | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ meldGroupId: string; meldCardIndex: number } | null>(null);
  const [meldChoice, setMeldChoice] = useState<{ cardIndex: number; meldGroupId: string } | null>(null);
  const dragRef = useRef<{ cardIndex: number } | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [timerPct, setTimerPct] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startClientTimer = () => {
    clearTimer();
    setTimerPct(100);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.max(0, 100 - (elapsed / 60000) * 100);
      setTimerPct(pct);
      if (pct <= 0) {
        clearTimer();
      }
    }, 100);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished") {
      startClientTimer();
    } else {
      clearTimer();
      setTimerPct(100);
    }
  }, [status, phase, currentPlayerIndex, currentRound]);

  useEffect(() => {
    if (!token || !roomId) return;

    const client = createColyseusClient(token);
    let cancelled = false;
    let joined: Room | null = null;

    client.joinById(roomId).then((joinedRoom) => {
      if (cancelled) {
        joinedRoom.leave();
        return;
      }

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
      <div>
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => navigate("/")}>Back to Lobby</button>
      </div>
    );
  }

  if (!room) {
    return <div>Joining room...</div>;
  }

  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayer?.sessionId === mySessionId;
  const myPlayer = players.find((p) => p.sessionId === mySessionId);
  const canDraw = phase === "draw" && isMyTurn;
  const canDiscard = phase === "discard" && isMyTurn;
  const canMeld = phase === "main_phase" && isMyTurn;

  const handleDrawFromDeck = () => {
    if (!canDraw) return;
    room.send("draw", { source: "deck" });
  };

  const handleDrawFromDiscard = () => {
    if (!canDraw) return;
    room.send("draw", { source: "discard" });
  };

  const handleDiscard = (cardIndex: number) => {
    if (!canDiscard) return;
    room.send("discard", { cardIndex });
  };

  const handleToggleCard = (cardIndex: number) => {
    if (!canMeld) return;
    setSelectedCardIndices((prev) =>
      prev.includes(cardIndex) ? prev.filter((i) => i !== cardIndex) : [...prev, cardIndex],
    );
    setMeldError(null);
  };

  const handleMeld = () => {
    if (!canMeld || selectedCardIndices.length === 0) return;
    room.send("meld", { cardIndices: selectedCardIndices });
    setSelectedCardIndices([]);
  };

  const handlePassMeld = () => {
    if (!canMeld) return;
    room.send("pass_meld");
    setSelectedCardIndices([]);
  };

  const handleCancelMode = () => {
    setInteractionMode("none");
    setAddCardIndex(null);
    setSwapTarget(null);
    setMeldChoice(null);
    setMeldError(null);
  };

  const handleEnterAddMode = () => {
    setInteractionMode("adding");
    setAddCardIndex(null);
    setSwapTarget(null);
    setMeldError(null);
  };

  const handleHandClick = (cardIndex: number) => {
    if (interactionMode === "adding") {
      setAddCardIndex(cardIndex);
      return;
    }
    if (interactionMode === "swapping" && swapTarget && room) {
      room.send("swap_wild", {
        meldGroupId: swapTarget.meldGroupId,
        meldCardIndex: swapTarget.meldCardIndex,
        handCardIndex: cardIndex,
      });
      setInteractionMode("none");
      setSwapTarget(null);
      setMeldError(null);
      return;
    }
    if (interactionMode === "none") {
      setSelectedCardIndices((prev) =>
        prev.includes(cardIndex) ? prev.filter((i) => i !== cardIndex) : [...prev, cardIndex],
      );
      setMeldError(null);
    }
  };

  const handleAddToMeld = (meldGroupId: string) => {
    if (addCardIndex === null || !room) return;

    const meldCards: { rank: number; suit: number }[] = [];
    for (const p of players) {
      for (const c of p.board) {
        if (c.meldGroupId === meldGroupId) meldCards.push(c);
      }
    }

    const myPlayer = players.find((p) => p.sessionId === mySessionId);
    const handCard = myPlayer?.hand[addCardIndex];
    if (!handCard) { setMeldError("Card not found"); return; }

    const hasWild = meldCards.some((c) => isWild(c, wildRank));
    const canAdd = canMeldCards([...meldCards, handCard], wildRank);
    const canSwapWild = hasWild && canMeldCards(
      meldCards.filter((c) => !isWild(c, wildRank)).concat(handCard),
      wildRank,
    );

    if (canAdd && canSwapWild) {
      setMeldChoice({ cardIndex: addCardIndex, meldGroupId });
      return;
    }

    room.send("add_to_meld", { cardIndex: addCardIndex, meldGroupId, preferSwap: !canAdd && canSwapWild || false });
    setInteractionMode("none");
    setAddCardIndex(null);
    setMeldError(null);
  };

  const handleMeldChoice = (preferSwap: boolean) => {
    if (!meldChoice || !room) return;
    room.send("add_to_meld", { cardIndex: meldChoice.cardIndex, meldGroupId: meldChoice.meldGroupId, preferSwap });
    setMeldChoice(null);
    setInteractionMode("none");
    setAddCardIndex(null);
    setMeldError(null);
  };

  const handleDragStart = (cardIndex: number) => (e: React.DragEvent) => {
    dragRef.current = { cardIndex };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnBoard = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragRef.current || !room) return;
    room.send("meld", { cardIndices: [dragRef.current.cardIndex] });
    dragRef.current = null;
  };

  const handleDropOnMeld = (meldGroupId: string, meldCards: { rank: number; suit: number }[]) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragRef.current || !room) return;
    const ci = dragRef.current.cardIndex;
    const handCard = myPlayer?.hand[ci];
    if (!handCard) { dragRef.current = null; return; }
    const hasWild = meldCards.some((c) => isWild(c, wildRank));
    const canAdd = canMeldCards([...meldCards, handCard], wildRank);
    const canSwap = hasWild && canMeldCards(meldCards.filter((c) => !isWild(c, wildRank)).concat(handCard), wildRank);
    if (canAdd && canSwap) {
      setMeldChoice({ cardIndex: ci, meldGroupId });
      dragRef.current = null;
      return;
    }
    room.send("add_to_meld", { cardIndex: ci, meldGroupId, preferSwap: !canAdd && canSwap || false });
    dragRef.current = null;
  };

  const handleDropOnDiscard = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragRef.current || !room) return;
    room.send("discard", { cardIndex: dragRef.current.cardIndex });
    dragRef.current = null;
  };

  const handleBoardCardClick = (card: CardData, ci: number) => {
    if (interactionMode === "none" && card.rank === wildRank) {
      setInteractionMode("swapping");
      setSwapTarget({ meldGroupId: card.meldGroupId, meldCardIndex: ci });
      setMeldError(null);
    }
  };

  const myBoard = players.find((p) => p.sessionId === mySessionId)?.board ?? [];
  const hasMelds = myBoard.length > 0;

  const wildRankNames = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const wildName = wildRankNames[wildRank] || String(wildRank);

  const roundScores = players.map((p) => {
    const roundScore = p.hand.reduce(
      (sum, card) => sum + (card.rank === wildRank ? 25 : card.rank),
      0,
    );
    return { ...p, roundScore };
  });

  return (
    <div>
      <h1>Gin 13</h1>
      {status === "waiting" && <p>Room: {roomId}</p>}

      {status === "playing" && (
        <p>
          Round {currentRound + 1} — Wild: {wildName}
        </p>
      )}

      {status === "playing" && phase !== "waiting" && (
        <p>
          Phase: {phase} | Current turn: {players[currentPlayerIndex]?.name ?? "—"}
        </p>
      )}

      {status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished" && (
        <div>
          {isMyTurn ? (
            <div data-testid="turn-timer" style={{ width: "100%", height: 8, background: "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${timerPct}%`, height: "100%", background: timerPct > 30 ? "#4caf50" : timerPct > 10 ? "#ff9800" : "#f44336", transition: "width 0.1s linear" }} />
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#666" }}>
              Waiting for {players[currentPlayerIndex]?.name ?? "..."}...
            </p>
          )}
        </div>
      )}

      {status === "waiting" && players.length >= 3 && (
        <button onClick={() => room.send("start_game")}>Start Game</button>
      )}

      <h2>Players ({players.length}/4)</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }, (_, i) => {
            const p = players[i];
            const isWinner = status === "finished" && winnerSessionId && p?.sessionId === winnerSessionId;
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  {p ? p.name : <em>Waiting...</em>}
                  {isWinner && " 👑"}
                </td>
                <td>{p?.score ?? "—"}</td>
                <td>
                  {p?.disconnected ? "Disconnected" : p ? "Connected" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {status === "playing" && phase !== "waiting" && (
        <div>
          <h2>Game Board</h2>
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start", marginBottom: 24 }}>
            <div style={{ textAlign: "center" }}>
              <p><strong>Draw Pile</strong></p>
              <Card faceDown onClick={handleDrawFromDeck} disabled={!canDraw} />
              <p style={{ fontSize: 12, marginTop: 4 }}>{drawPile.length} cards</p>
            </div>

            <div
              onDragOver={canDiscard ? handleDragOver : undefined}
              onDrop={canDiscard ? handleDropOnDiscard : undefined}
              style={{
                textAlign: "center", padding: 8, borderRadius: 8,
                border: canDiscard ? "2px dashed #94a3b8" : "none",
                transition: "border 0.2s",
              }}
            >
              <p><strong>Discard Pile</strong></p>
              <div style={{ display: "flex", gap: 2 }}>
                {discardPile.length > 1 && <Card faceDown />}
                {discardPile.length > 0 && (
                  <Card
                    rank={discardPile[discardPile.length - 1].rank}
                    suit={discardPile[discardPile.length - 1].suit}
                    wild={discardPile[discardPile.length - 1].rank === wildRank}
                    onClick={handleDrawFromDiscard}
                    disabled={!canDraw}
                  />
                )}
              </div>
            </div>

            <div>
              <p><strong>Melds</strong></p>
              {players.filter((p) => p.board.length > 0).length === 0 && (
                <p style={{ fontSize: 12, color: "#888" }}>No melds yet</p>
              )}
              {players
                .filter((p) => p.board.length > 0)
                .map((player) => {
                  const meldGroups = new Map<string, CardData[]>();
                  for (const card of player.board) {
                    if (!card.meldGroupId) continue;
                    const group = meldGroups.get(card.meldGroupId);
                    if (group) group.push(card);
                    else meldGroups.set(card.meldGroupId, [card]);
                  }
                  for (const [, group] of meldGroups) {
                    const nonWild = group.filter((c) => !isWild(c, wildRank));
                    const wilds = group.filter((c) => isWild(c, wildRank));
                    if (nonWild.length >= 2 && new Set(nonWild.map((c) => c.rank)).size > 1) {
                      group.sort((a, b) => a.rank - b.rank);
                    } else {
                      group.length = 0; group.push(...nonWild, ...wilds);
                    }
                  }
                  const isOwn = player.sessionId === mySessionId;
                  const groupEntries = [...meldGroups.entries()];
                  return (
                    <div key={player.sessionId} style={{ marginBottom: 12 }}>
                      <p style={{ fontWeight: "bold", fontSize: 14 }}>{player.name}</p>
                      {groupEntries.map(([meldGroupId, group]) => {
                        const meldCards = group.map((c) => ({ rank: c.rank, suit: c.suit }));
                        return (
                          <div
                            key={meldGroupId}
                            data-testid={`meld-group-${meldGroupId}`}
                            onDragOver={canMeld ? handleDragOver : undefined}
                            onDrop={canMeld ? handleDropOnMeld(meldGroupId, meldCards) : undefined}
                            onClick={
                              interactionMode === "adding"
                                ? () => handleAddToMeld(meldGroupId)
                                : undefined
                            }
                            style={{
                              display: "flex",
                              gap: 4,
                              marginBottom: 6,
                              padding: 4,
                              borderRadius: 8,
                              ...(interactionMode === "adding" ? {
                                outline: "2px dashed #4caf50",
                                cursor: "pointer",
                                background: "#f0faf0",
                              } : {}),
                            }}
                          >
                            {group.map((card, ci) => {
                              const isSelectedForSwap = interactionMode === "swapping" && swapTarget?.meldGroupId === meldGroupId && swapTarget?.meldCardIndex === ci;
                              return (
                                <Card
                                  key={ci}
                                  rank={card.rank}
                                  suit={card.suit}
                                  wild={card.rank === wildRank}
                                  onClick={
                                    isOwn && canMeld && card.rank === wildRank && interactionMode === "none"
                                      ? () => handleBoardCardClick(card, ci)
                                      : undefined
                                  }
                                  selected={isSelectedForSwap}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          </div>

            <div style={{ marginTop: 16 }}>
            <p><strong>Your Hand</strong></p>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {players
                .find((p) => p.sessionId === mySessionId)
                ?.hand.map((card, i) => {
                  const isSelectedForMeld = selectedCardIndices.includes(i);
                  const isSelectedForAdd = interactionMode === "adding" && addCardIndex === i;
                  return (
                    <Card
                      key={i}
                      rank={card.rank}
                      suit={card.suit}
                      wild={card.rank === wildRank}
                      selected={isSelectedForMeld || isSelectedForAdd}
                      onClick={canMeld ? () => handleHandClick(i) : canDiscard ? () => handleDiscard(i) : undefined}
                      disabled={!canMeld && !canDiscard}
                      draggable={canMeld || canDiscard}
                      onDragStart={canMeld || canDiscard ? handleDragStart(i) : undefined}
                    />
                  );
                })}
            </div>
            {!players.find((p) => p.sessionId === mySessionId) && (
              <p style={{ fontSize: 12, color: "#888" }}>Waiting for game to start...</p>
            )}
            {meldChoice && (
              <div style={{ marginTop: 8, padding: 8, border: "1px solid #ccc", borderRadius: 6, background: "#fffbe6" }}>
                <p style={{ fontSize: 13, marginBottom: 4 }}>
                  You can add this card to the meld or swap it with the wild card:
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleMeldChoice(false)}>Add</button>
                  <button onClick={() => handleMeldChoice(true)}>Swap Wild</button>
                  <button onClick={() => { setMeldChoice(null); setInteractionMode("none"); setAddCardIndex(null); }}>Cancel</button>
                </div>
              </div>
            )}

            {canMeld && !meldChoice && (
              <div style={{ marginTop: 8 }}>
                {interactionMode !== "none" && (
                  <p style={{ fontSize: 13, fontStyle: "italic", marginBottom: 4 }}>
                    {interactionMode === "adding" && (addCardIndex === null
                      ? "Adding to meld — select a card from your hand"
                      : "Adding to meld — click a meld group")}
                    {interactionMode === "swapping" && "Swapping wild — click a hand card to swap"}
                  </p>
                )}
                {interactionMode !== "none" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={handleCancelMode}>Cancel</button>
                    {meldError && <span style={{ color: "red", fontSize: 13 }}>{meldError}</span>}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={handleMeld} disabled={selectedCardIndices.length === 0}>
                      Meld ({selectedCardIndices.length})
                    </button>
                    <button onClick={handlePassMeld}>Pass Meld</button>
                    {hasMelds && <button onClick={handleEnterAddMode}>Add to Meld</button>}
                    {meldError && <span style={{ color: "red", fontSize: 13 }}>{meldError}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {phase === "round_ended" && (
        <div style={{ border: "2px solid #ff9800", borderRadius: 8, padding: 16, marginBottom: 16, background: "#fff3e0" }}>
          <h2>Round {currentRound + 1} Summary</h2>
          <p>Wild: {wildName}</p>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Round Score</th>
                <th>Total Score</th>
              </tr>
            </thead>
            <tbody>
              {roundScores.map((p) => (
                <tr key={p.sessionId}>
                  <td>{p.name}</td>
                  <td>{p.roundScore}</td>
                  <td>{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status === "finished" && winnerSessionId && (
        <div>
          <h2>Match Over!</h2>
          <p>
            Winner: {players.find((p) => p.sessionId === winnerSessionId)?.name ?? "Unknown"}
          </p>
          <h3>Final Scores</h3>
          <ul>
            {[...players]
              .sort((a, b) => a.score - b.score)
              .map((p, i) => (
                <li key={p.sessionId}>
                  {i + 1}. {p.name} — {p.score} points
                </li>
              ))}
          </ul>
          <button onClick={() => { cleanupRef.current(); navigate("/"); }}>Back to Lobby</button>
        </div>
      )}

      {!status.startsWith("finished") && (
        <button onClick={() => { cleanupRef.current(); navigate("/"); }}>Leave Room</button>
      )}
    </div>
  );
}
