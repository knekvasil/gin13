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
  const handOrderRef = useRef<number[]>([]);
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
      if (pct <= 0) clearTimer();
    }, 100);
  };

  useEffect(() => () => clearTimer(), []);

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
          if (handOrderRef.current.length !== myHand.length) {
            handOrderRef.current = myHand.map((_, i) => i);
          }
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

    return () => { cancelled = true; cleanupRef.current(); };
  }, [token, roomId]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl font-bold">Error</h1>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => navigate("/")} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">Back to Lobby</button>
      </div>
    );
  }

  if (!room) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">Joining room...</div>;
  }

  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayer?.sessionId === mySessionId;
  const myPlayer = players.find((p) => p.sessionId === mySessionId);
  const canDraw = phase === "draw" && isMyTurn;
  const canDiscard = phase === "discard" && isMyTurn;
  const canMeld = phase === "main_phase" && isMyTurn;

  const handleDrawFromDeck = () => { if (canDraw) room.send("draw", { source: "deck" }); };
  const handleDrawFromDiscard = () => { if (canDraw) room.send("draw", { source: "discard" }); };
  const handleDiscard = (cardIndex: number) => { if (canDiscard) room.send("discard", { cardIndex }); };
  const handleToggleCard = (cardIndex: number) => {
    if (!canMeld) return;
    setSelectedCardIndices((prev) => prev.includes(cardIndex) ? prev.filter((i) => i !== cardIndex) : [...prev, cardIndex]);
    setMeldError(null);
  };

  const handleMeld = () => {
    if (!canMeld || selectedCardIndices.length === 0) return;
    room.send("meld", { cardIndices: selectedCardIndices });
    setSelectedCardIndices([]);
  };

  const handlePassMeld = () => { if (canMeld) { room.send("pass_meld"); setSelectedCardIndices([]); } };
  const handleCancelMode = () => { setInteractionMode("none"); setAddCardIndex(null); setSwapTarget(null); setMeldChoice(null); setMeldError(null); };
  const handleEnterAddMode = () => { setInteractionMode("adding"); setAddCardIndex(null); setSwapTarget(null); setMeldError(null); };

  const handleHandClick = (cardIndex: number) => {
    if (interactionMode === "adding") { setAddCardIndex(cardIndex); return; }
    if (interactionMode === "swapping" && swapTarget && room) {
      room.send("swap_wild", { meldGroupId: swapTarget.meldGroupId, meldCardIndex: swapTarget.meldCardIndex, handCardIndex: cardIndex });
      setInteractionMode("none"); setSwapTarget(null); setMeldError(null);
      return;
    }
    if (interactionMode === "none") {
      setSelectedCardIndices((prev) => prev.includes(cardIndex) ? prev.filter((i) => i !== cardIndex) : [...prev, cardIndex]);
      setMeldError(null);
    }
  };

  const handleAddToMeld = (meldGroupId: string) => {
    if (addCardIndex === null || !room) return;
    const meldCards: { rank: number; suit: number }[] = [];
    for (const p of players) { for (const c of p.board) { if (c.meldGroupId === meldGroupId) meldCards.push(c); } }
    const handCard = myPlayer?.hand[addCardIndex];
    if (!handCard) { setMeldError("Card not found"); return; }
    const hasWild = meldCards.some((c) => isWild(c, wildRank));
    const canAdd = canMeldCards([...meldCards, handCard], wildRank);
    const canSwapWild = hasWild && canMeldCards(meldCards.filter((c) => !isWild(c, wildRank)).concat(handCard), wildRank);
    if (canAdd && canSwapWild) { setMeldChoice({ cardIndex: addCardIndex, meldGroupId }); return; }
    room.send("add_to_meld", { cardIndex: addCardIndex, meldGroupId, preferSwap: !canAdd && canSwapWild || false });
    setInteractionMode("none"); setAddCardIndex(null); setMeldError(null);
  };

  const handleMeldChoice = (preferSwap: boolean) => {
    if (!meldChoice || !room) return;
    room.send("add_to_meld", { cardIndex: meldChoice.cardIndex, meldGroupId: meldChoice.meldGroupId, preferSwap });
    setMeldChoice(null); setInteractionMode("none"); setAddCardIndex(null); setMeldError(null);
  };

  const handleDragStart = (cardIndex: number) => (e: React.DragEvent) => { dragRef.current = { cardIndex }; e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDropOnBoard = (e: React.DragEvent) => { e.preventDefault(); if (dragRef.current && room) { room.send("meld", { cardIndices: [dragRef.current.cardIndex] }); dragRef.current = null; } };

  const handleDropOnMeld = (meldGroupId: string, meldCards: { rank: number; suit: number }[]) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragRef.current || !room) return;
    const ci = dragRef.current.cardIndex;
    const handCard = myPlayer?.hand[ci];
    if (!handCard) { dragRef.current = null; return; }
    const hasWild = meldCards.some((c) => isWild(c, wildRank));
    const canAdd = canMeldCards([...meldCards, handCard], wildRank);
    const canSwap = hasWild && canMeldCards(meldCards.filter((c) => !isWild(c, wildRank)).concat(handCard), wildRank);
    if (canAdd && canSwap) { setMeldChoice({ cardIndex: ci, meldGroupId }); dragRef.current = null; return; }
    room.send("add_to_meld", { cardIndex: ci, meldGroupId, preferSwap: !canAdd && canSwap || false });
    dragRef.current = null;
  };

  const handleDropOnDiscard = (e: React.DragEvent) => { e.preventDefault(); if (dragRef.current && room) { room.send("discard", { cardIndex: dragRef.current.cardIndex }); dragRef.current = null; } };

  const handleDropOnHand = (dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const fromIdx = handOrderRef.current.indexOf(dragRef.current.cardIndex);
    if (fromIdx === -1) return;
    const ordered = [...handOrderRef.current];
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(fromIdx < dropIndex ? dropIndex - 1 : dropIndex, 0, moved);
    handOrderRef.current = ordered;
    setPlayers((prev) => prev.map((p) => p.sessionId === mySessionId ? { ...p, hand: ordered.map((i) => p.hand[i]!) } : p));
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
    const roundScore = p.hand.reduce((sum, card) => sum + (card.rank === wildRank ? 25 : card.rank), 0);
    return { ...p, roundScore };
  });

  const timerColor = timerPct > 30 ? "bg-green-500" : timerPct > 10 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="min-h-screen px-4 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Gin 13</h1>
        {!status.startsWith("finished") && (
          <button onClick={() => { cleanupRef.current(); navigate("/"); }} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            Leave
          </button>
        )}
      </div>

      {/* Top info bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-gray-600 dark:text-gray-400">
        {status === "waiting" && <span>Room: {roomId}</span>}
        {status === "playing" && <span className="font-medium text-gray-900 dark:text-gray-100">Round {currentRound + 1}</span>}
        {status === "playing" && <span>Wild: <strong className="text-gray-900 dark:text-gray-100">{wildName}</strong></span>}
        {status === "playing" && phase !== "waiting" && (
          <span>
            Turn: <strong className={isMyTurn ? "text-blue-600 dark:text-blue-400" : ""}>
              {players[currentPlayerIndex]?.name ?? "—"}
            </strong>
          </span>
        )}
      </div>

      {/* Turn timer */}
      {status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished" && (
        <div className="mb-4">
          {isMyTurn ? (
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-100 ${timerColor}`} style={{ width: `${timerPct}%` }} />
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              Waiting for {players[currentPlayerIndex]?.name ?? "..."}...
            </p>
          )}
        </div>
      )}

      {/* Start Game button */}
      {status === "waiting" && players.length >= 3 && (
        <button onClick={() => room.send("start_game")} className="w-full mb-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition">
          Start Game
        </button>
      )}

      {/* Player table */}
      <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Score</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }, (_, i) => {
              const p = players[i];
              const isWinner = status === "finished" && winnerSessionId && p?.sessionId === winnerSessionId;
              return (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="px-3 py-2.5 tabular-nums">{i + 1}</td>
                  <td className={`px-3 py-2.5 ${isWinner ? "font-bold" : ""}`}>
                    {p ? p.name : <span className="text-gray-400 italic">Waiting...</span>}
                    {isWinner && <span className="ml-1">👑</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p?.score ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    {p?.disconnected ? <span className="text-red-500">Disconnected</span> : p ? <span className="text-green-600 dark:text-green-400">Connected</span> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Game board */}
      {status === "playing" && phase !== "waiting" && (
        <div className="mb-6">
          {/* Draw & Discard piles */}
          <div className="flex gap-8 items-start mb-6">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Draw Pile</p>
              <Card faceDown onClick={handleDrawFromDeck} disabled={!canDraw} />
              <p className="text-xs text-gray-400 mt-1">{drawPile.length} cards</p>
            </div>
            <div
              onDragOver={canDiscard ? handleDragOver : undefined}
              onDrop={canDiscard ? handleDropOnDiscard : undefined}
              className={`text-center p-2 rounded-lg transition-all ${canDiscard ? "border-2 border-dashed border-gray-400 dark:border-gray-500" : ""}`}
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Discard Pile</p>
              <div className="flex gap-1 justify-center">
                {discardPile.length > 1 && <Card faceDown small />}
                {discardPile.length > 0 && (
                  <Card rank={discardPile[discardPile.length - 1].rank} suit={discardPile[discardPile.length - 1].suit} wild={discardPile[discardPile.length - 1].rank === wildRank} onClick={handleDrawFromDiscard} disabled={!canDraw} />
                )}
              </div>
            </div>
          </div>

          {/* Melds */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Melds</p>
            <div
              onDragOver={canMeld ? handleDragOver : undefined}
              onDrop={canMeld ? handleDropOnBoard : undefined}
              className={`rounded-xl p-3 transition-all ${canMeld ? "border-2 border-dashed border-gray-300 dark:border-gray-600 min-h-[100px]" : ""}`}
            >
              {players.filter((p) => p.board.length > 0).length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                  {canMeld ? "Drag cards here to meld" : "No melds yet"}
                </p>
              )}
              {players.filter((p) => p.board.length > 0).map((player) => {
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
                  <div key={player.sessionId} className="mb-3 last:mb-0">
                    <p className={`text-xs font-semibold mb-1 ${isOwn ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}>{player.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {groupEntries.map(([meldGroupId, group]) => {
                        const meldCards = group.map((c) => ({ rank: c.rank, suit: c.suit }));
                        return (
                          <div
                            key={meldGroupId}
                            data-testid={`meld-group-${meldGroupId}`}
                            onDragOver={canMeld ? handleDragOver : undefined}
                            onDrop={canMeld ? handleDropOnMeld(meldGroupId, meldCards) : undefined}
                            onClick={interactionMode === "adding" ? () => handleAddToMeld(meldGroupId) : undefined}
                            className={`flex gap-1 p-1.5 rounded-lg transition-all ${interactionMode === "adding" ? "outline-2 outline-dashed outline-green-500 cursor-pointer bg-green-50 dark:bg-green-950" : ""}`}
                          >
                            {group.map((card, ci) => {
                              const isSelectedForSwap = interactionMode === "swapping" && swapTarget?.meldGroupId === meldGroupId && swapTarget?.meldCardIndex === ci;
                              return (
                                <Card
                                  key={ci}
                                  rank={card.rank}
                                  suit={card.suit}
                                  wild={card.rank === wildRank}
                                  onClick={isOwn && canMeld && card.rank === wildRank && interactionMode === "none" ? () => handleBoardCardClick(card, ci) : undefined}
                                  selected={isSelectedForSwap}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Your Hand */}
      {status === "playing" && phase !== "waiting" && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Your Hand</p>
          {(() => {
            const myPlayerHand = players.find((p) => p.sessionId === mySessionId)?.hand;
            if (!myPlayerHand) return <p className="text-xs text-gray-400 italic">Waiting for game to start...</p>;
            if (handOrderRef.current.length !== myPlayerHand.length) {
              handOrderRef.current = myPlayerHand.map((_, i) => i);
            }
            return (
              <div className="flex flex-wrap gap-1.5">
                {handOrderRef.current.map((origIdx, displayIdx) => {
                  const card = myPlayerHand[origIdx];
                  const isSelectedForMeld = selectedCardIndices.includes(origIdx);
                  const isSelectedForAdd = interactionMode === "adding" && addCardIndex === origIdx;
                  return (
                    <div key={origIdx} onDragOver={handleDragOver} onDrop={handleDropOnHand(displayIdx)} className="inline-flex">
                      <Card
                        rank={card.rank} suit={card.suit} wild={card.rank === wildRank}
                        selected={isSelectedForMeld || isSelectedForAdd}
                        onClick={canMeld ? () => handleHandClick(origIdx) : canDiscard ? () => handleDiscard(origIdx) : undefined}
                        disabled={!canMeld && !canDiscard}
                        draggable={canMeld || canDiscard}
                        onDragStart={canMeld || canDiscard ? handleDragStart(origIdx) : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Instructions / Errors */}
      {canMeld && !meldChoice && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">Drag cards to the board to meld, drag to a meld group to add</p>}
      {canDiscard && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">Drag a card to the discard pile</p>}
      {meldError && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{meldError}</p>}

      {/* Add/Swap choice dialog */}
      {meldChoice && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <p className="text-sm mb-4 text-center">Add this card to the meld or swap it with the wild card?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => handleMeldChoice(false)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition">Add</button>
              <button onClick={() => handleMeldChoice(true)} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition">Swap Wild</button>
              <button onClick={() => setMeldChoice(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Round summary */}
      {phase === "round_ended" && (
        <div className="rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950 p-4 mb-6">
          <h2 className="text-sm font-bold mb-2">Round {currentRound + 1} Summary — Wild: {wildName}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange-200 dark:border-orange-800">
                <th className="text-left px-2 py-1 font-medium text-orange-700 dark:text-orange-300">Player</th>
                <th className="text-right px-2 py-1 font-medium text-orange-700 dark:text-orange-300">Round</th>
                <th className="text-right px-2 py-1 font-medium text-orange-700 dark:text-orange-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {roundScores.map((p) => (
                <tr key={p.sessionId} className="border-b border-orange-200 dark:border-orange-800 last:border-0">
                  <td className="px-2 py-1.5">{p.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.roundScore}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Match over */}
      {status === "finished" && winnerSessionId && (
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold mb-1">Match Over!</h2>
          <p className="text-sm mb-4">
            Winner: <strong>{players.find((p) => p.sessionId === winnerSessionId)?.name ?? "Unknown"}</strong> 🎉
          </p>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">#</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Player</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Score</th>
                </tr>
              </thead>
              <tbody>
                {[...players].sort((a, b) => a.score - b.score).map((p, i) => (
                  <tr key={p.sessionId} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                    <td className={`px-3 py-2 ${i === 0 ? "font-bold" : ""}`}>{p.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => { cleanupRef.current(); navigate("/"); }} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition">
            Back to Lobby
          </button>
        </div>
      )}
    </div>
  );
}
