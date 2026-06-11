import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Room } from "colyseus.js";
import Card from "../components/Card";
import {
  DndContext, DragOverlay, closestCorners,
  type DragEndEvent, type DragStartEvent,
  useDroppable, useSensor, useSensors, PointerSensor, TouchSensor,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  for (const c of cards) { if (isWild(c, wildRank)) continue; if (setRank === null) setRank = c.rank; else if (c.rank !== setRank) return false; if (suits.has(c.suit)) return false; suits.add(c.suit); }
  if (setRank === null) return false;
  return suits.size === cards.length - cards.filter((c) => isWild(c, wildRank)).length;
}

function isValidStraightFlush(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length < 4) return false;
  let suit: number | null = null;
  const nonWild: number[] = []; let wildCount = 0;
  for (const c of cards) { if (isWild(c, wildRank)) { wildCount++; continue; } if (suit === null) suit = c.suit; else if (c.suit !== suit) return false; nonWild.push(c.rank); }
  if (suit === null) return false;
  const unique = new Set(nonWild);
  if (unique.size !== nonWild.length) return false;
  nonWild.sort((a, b) => a - b);
  const min = nonWild[0]!, max = nonWild[nonWild.length - 1]!;
  if (max - min >= 12) return false;
  return max - min + 1 - nonWild.length <= wildCount;
}

type InteractionMode = "none" | "adding" | "swapping";

interface CardData { rank: number; suit: number; meldGroupId: string; }
interface PlayerState { sessionId: string; userId: string; name: string; score: number; disconnected: boolean; hand: CardData[]; board: CardData[]; }

// ---------- Draggable Hand Card ----------
function SortableCard({ card, origIdx, wildRank, canDrag, onContextMenu }: { card: CardData; origIdx: number; wildRank: number; canDrag: boolean; onContextMenu?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `hand-${origIdx}`, disabled: !canDrag });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(); }} className="inline-flex">
      <Card rank={card.rank} suit={card.suit} wild={card.rank === wildRank} disabled={!canDrag} small />
    </div>
  );
}

// ---------- Droppable Meld Group ----------
function DroppableMeldGroup({ id, children, canDrop, onClick }: { id: string; children: React.ReactNode; canDrop: boolean; onClick?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canDrop });
  return (
    <div ref={setNodeRef} onClick={onClick} className={`flex gap-1 p-1.5 rounded-lg transition-all ${isOver ? "bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-400" : ""}`}>
      {children}
    </div>
  );
}

// ---------- Droppable Board ----------
function DroppableBoard({ id, children, canDrop }: { id: string; children: React.ReactNode; canDrop: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canDrop });
  return (
    <div ref={setNodeRef} className={`rounded-xl p-3 transition-all ${canDrop ? "border-2 border-dashed min-h-[100px]" : ""} ${isOver ? "border-blue-400 bg-blue-50 dark:bg-blue-950" : "border-gray-300 dark:border-gray-600"}`}>
      {children}
    </div>
  );
}

// ---------- Droppable Discard ----------
function DroppableDiscard({ id, children, canDrop }: { id: string; children: React.ReactNode; canDrop: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canDrop });
  return (
    <div ref={setNodeRef} className={`text-center p-2 rounded-lg transition-all ${canDrop ? "border-2 border-dashed" : ""} ${isOver ? "border-blue-400 bg-blue-50 dark:bg-blue-950" : "border-gray-400 dark:border-gray-500"}`}>
      {children}
    </div>
  );
}

// ---------- Active card overlay ----------
function DragCard({ rank, suit, wild }: { rank: number; suit: number; wild: boolean }) {
  return <Card rank={rank} suit={suit} wild={wild} />;
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
  const [activeDragCard, setActiveDragCard] = useState<{ rank: number; suit: number } | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [timerPct, setTimerPct] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [handOrder, setHandOrder] = useState<number[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const startClientTimer = () => {
    clearTimer(); setTimerPct(100);
    const start = Date.now();
    timerRef.current = setInterval(() => { setTimerPct(Math.max(0, 100 - ((Date.now() - start) / 60000) * 100)); if (timerPct <= 0) clearTimer(); }, 100);
  };
  useEffect(() => () => clearTimer(), []);
  useEffect(() => {
    if (status === "playing" && phase !== "waiting" && phase !== "round_ended" && phase !== "finished") startClientTimer();
    else { clearTimer(); setTimerPct(100); }
  }, [status, phase, currentPlayerIndex, currentRound]);

  useEffect(() => {
    if (!token || !roomId) return;
    const client = createColyseusClient(token);
    let cancelled = false;
    let joined: Room | null = null;
    client.joinById(roomId).then((joinedRoom) => {
      if (cancelled) { joinedRoom.leave(); return; }
      joined = joinedRoom; setRoom(joinedRoom);
      const sessionId = joinedRoom.sessionId; setMySessionId(sessionId);
      const getState = () => joinedRoom.state as any;
      const updatePlayers = () => {
        if (cancelled) return;
        const state = getState();
        setStatus(state.status || "waiting"); setPhase(state.phase || "waiting"); setCurrentRound(state.currentRound ?? 0);
        setWildRank(state.wildRank ?? 0); setCurrentPlayerIndex(state.currentPlayerIndex ?? 0); setWinnerSessionId(state.winnerSessionId || "");
        const list: PlayerState[] = []; state.players?.forEach?.((p: PlayerState) => list.push(p)); setPlayers(list);
        const myHand = list.find((p) => p.sessionId === sessionId)?.hand;
        if (myHand) { setSelectedCardIndices((prev) => prev.filter((i) => i < myHand.length)); setHandOrder(myHand.map((_, i) => i)); }
        const dPile: CardData[] = []; state.drawPile?.forEach?.((c: CardData) => dPile.push(c)); setDrawPile(dPile);
        const diPile: CardData[] = []; state.discardPile?.forEach?.((c: CardData) => diPile.push(c)); setDiscardPile(diPile);
      };
      updatePlayers(); joinedRoom.onStateChange(updatePlayers);
      joinedRoom.onMessage("meld_error", (msg: { message: string }) => setMeldError(msg.message));
      cleanupRef.current = () => { joinedRoom.onStateChange.remove(updatePlayers); joined?.leave(); };
    }).catch((err) => { if (!cancelled) setError(err.message || "Failed to join room"); });
    return () => { cancelled = true; cleanupRef.current(); };
  }, [token, roomId]);

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-bold">Error</h1>
      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      <button onClick={() => navigate("/")} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">Back to Lobby</button>
    </div>
  );
  if (!room) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">Joining room...</div>;

  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayer?.sessionId === mySessionId;
  const myPlayer = players.find((p) => p.sessionId === mySessionId);
  const canDraw = phase === "draw" && isMyTurn;
  const canDiscard = phase === "discard" && isMyTurn;
  const canMeld = phase === "main_phase" && isMyTurn;
  const canDrag = !!myPlayer?.hand.length;

  const handleDrawFromDeck = () => { if (canDraw) room.send("draw", { source: "deck" }); };
  const handleDrawFromDiscard = () => { if (canDraw) room.send("draw", { source: "discard" }); };
  const handleDiscard = (cardIndex: number) => { if (canDiscard) room.send("discard", { cardIndex }); };
  const handlePassMeld = () => { if (canMeld) { room.send("pass_meld"); setSelectedCardIndices([]); } };
  const handleCancelMode = () => { setInteractionMode("none"); setAddCardIndex(null); setSwapTarget(null); setMeldChoice(null); setMeldError(null); };
  const handleEnterAddMode = () => { setInteractionMode("adding"); setAddCardIndex(null); setSwapTarget(null); setMeldError(null); };

  const handleHandClick = (cardIndex: number) => {
    if (interactionMode === "adding") { setAddCardIndex(cardIndex); return; }
    if (interactionMode === "swapping" && swapTarget && room) {
      room.send("swap_wild", { meldGroupId: swapTarget.meldGroupId, meldCardIndex: swapTarget.meldCardIndex, handCardIndex: cardIndex });
      setInteractionMode("none"); setSwapTarget(null); setMeldError(null); return;
    }
    if (interactionMode === "none") { setSelectedCardIndices((prev) => prev.includes(cardIndex) ? prev.filter((i) => i !== cardIndex) : [...prev, cardIndex]); setMeldError(null); }
  };

  const handleAddToMeld = (meldGroupId: string) => {
    if (addCardIndex === null || !room) return;
    const mCards: { rank: number; suit: number }[] = [];
    for (const p of players) for (const c of p.board) if (c.meldGroupId === meldGroupId) mCards.push(c);
    const handCard = myPlayer?.hand[addCardIndex];
    if (!handCard) { setMeldError("Card not found"); return; }
    const hasWild = mCards.some((c) => isWild(c, wildRank));
    const canAdd = canMeldCards([...mCards, handCard], wildRank);
    const canSwap = hasWild && canMeldCards(mCards.filter((c) => !isWild(c, wildRank)).concat(handCard), wildRank);
    if (canAdd && canSwap) { setMeldChoice({ cardIndex: addCardIndex, meldGroupId }); return; }
    room.send("add_to_meld", { cardIndex: addCardIndex, meldGroupId, preferSwap: !canAdd && canSwap || false });
    setInteractionMode("none"); setAddCardIndex(null); setMeldError(null);
  };

  const handleMeldChoice = (preferSwap: boolean) => {
    if (!meldChoice || !room) return;
    room.send("add_to_meld", { cardIndex: meldChoice.cardIndex, meldGroupId: meldChoice.meldGroupId, preferSwap });
    setMeldChoice(null); setInteractionMode("none"); setAddCardIndex(null); setMeldError(null);
  };

  const handleBoardCardClick = (card: CardData, ci: number) => {
    if (interactionMode === "none" && card.rank === wildRank) { setInteractionMode("swapping"); setSwapTarget({ meldGroupId: card.meldGroupId, meldCardIndex: ci }); setMeldError(null); }
  };

  // ---------- dnd-kit handlers ----------
  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith("hand-")) {
      const idx = parseInt(id.replace("hand-", ""), 10);
      const card = myPlayer?.hand[idx];
      if (card) setActiveDragCard({ rank: card.rank, suit: card.suit });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    if (!activeId.startsWith("hand-")) return;
    const origIdx = parseInt(activeId.replace("hand-", ""), 10);
    const overId = String(over.id);

    if (overId === "discard" && canDiscard) { handleDiscard(origIdx); return; }

    if (overId.startsWith("meld-group-") && canMeld) {
      const mgId = overId.replace("meld-group-", "");
      const mCards: { rank: number; suit: number }[] = [];
      for (const p of players) for (const c of p.board) if (c.meldGroupId === mgId) mCards.push(c);
      const handCard = myPlayer?.hand[origIdx];
      if (!handCard) return;
      const hasWild = mCards.some((c) => isWild(c, wildRank));
      const canAdd = canMeldCards([...mCards, handCard], wildRank);
      const canSwap = hasWild && canMeldCards(mCards.filter((c) => !isWild(c, wildRank)).concat(handCard), wildRank);
      if (canAdd && canSwap) { setMeldChoice({ cardIndex: origIdx, meldGroupId: mgId }); return; }
      room.send("add_to_meld", { cardIndex: origIdx, meldGroupId: mgId, preferSwap: !canAdd && canSwap || false });
      return;
    }

    if (overId === "board" && canMeld) { room.send("meld", { cardIndices: [origIdx] }); return; }

    if (overId.startsWith("hand-")) {
      const overOrigIdx = parseInt(overId.replace("hand-", ""), 10);
      const oldIdx = handOrder.indexOf(origIdx);
      const newIdx = handOrder.indexOf(overOrigIdx);
      if (oldIdx !== -1 && newIdx !== -1) setHandOrder(arrayMove(handOrder, oldIdx, newIdx));
      return;
    }
  };

  const myBoard = players.find((p) => p.sessionId === mySessionId)?.board ?? [];
  const hasMelds = myBoard.length > 0;
  const wildRankNames = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const wildName = wildRankNames[wildRank] || String(wildRank);
  const roundScores = players.map((p) => ({ ...p, roundScore: p.hand.reduce((s, c) => s + (c.rank === wildRank ? 25 : c.rank), 0) }));
  const timerColor = timerPct > 30 ? "bg-green-500" : timerPct > 10 ? "bg-orange-500" : "bg-red-500";

  const handIds = handOrder.map((i) => `hand-${i}`);

  return (
    <div className="min-h-screen px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">Gin 13</h1>
        {!status.startsWith("finished") && (
          <button onClick={() => { cleanupRef.current(); navigate("/"); }} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition">Leave</button>
        )}
      </div>

      {/* Status bar: round, wild, turn, timer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-gray-600 dark:text-gray-400">
        {status === "waiting" && <span>Room: {roomId}</span>}
        {status === "playing" && <span>Round <strong className="text-gray-900 dark:text-gray-100">{currentRound + 1}</strong></span>}
        {status === "playing" && <span>Wild: <strong className="text-gray-900 dark:text-gray-100">{wildName}</strong></span>}
        {status === "playing" && phase !== "waiting" && (
          <span className={isMyTurn ? "text-blue-600 dark:text-blue-400 font-medium" : ""}>
            {isMyTurn ? "Your turn" : `${players[currentPlayerIndex]?.name ?? "..."}'s turn`}
          </span>
        )}
        {isMyTurn && phase !== "waiting" && phase !== "round_ended" && phase !== "finished" && (
          <div className="flex-1 max-w-[200px] h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-100 ${timerColor}`} style={{ width: `${timerPct}%` }} />
          </div>
        )}
      </div>

      {/* Start Game */}
      {status === "waiting" && players.length >= 3 && (
        <button onClick={() => room.send("start_game")} className="w-full mb-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition">Start Game</button>
      )}

      {/* Score summary */}
      <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-2 py-1.5 font-medium text-gray-500 dark:text-gray-400">Player</th>
              <th className="text-center px-2 py-1.5 font-medium text-gray-500 dark:text-gray-400">Score</th>
              <th className="text-center px-2 py-1.5 font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }, (_, i) => {
              const p = players[i]; const isWinner = status === "finished" && winnerSessionId && p?.sessionId === winnerSessionId;
              return (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  <td className={`px-2 py-1.5 ${isWinner ? "font-bold" : ""} ${p?.sessionId === mySessionId ? "text-blue-600 dark:text-blue-400" : ""}`}>
                    {p?.name ?? <span className="text-gray-400 italic text-[11px]">Empty</span>}{isWinner && " 👑"}
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{p?.score ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center">{p?.disconnected ? <span className="text-red-500">✕</span> : p ? <span className="text-green-600 dark:text-green-400">●</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Game board */}
      {status === "playing" && phase !== "waiting" && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="relative">
            {/* Opponents positioned around the table */}
            {(() => {
              const opps = players.filter((p) => p.sessionId !== mySessionId);
              const positions = [
                "col-span-3 flex justify-center",      // top
                "flex items-start justify-center",       // left
                "flex items-start justify-center",       // right
              ];
              const rotations = ["", "rotate-[-90]", "rotate-[90]"];
              return opps.map((opponent, idx) => {
                const pos = idx < positions.length ? positions[idx]! : positions[0]!;
                const rot = idx < rotations.length ? rotations[idx]! : "";
                const mg = new Map<string, CardData[]>();
                for (const c of opponent.board) { if (!c.meldGroupId) continue; const g = mg.get(c.meldGroupId); if (g) g.push(c); else mg.set(c.meldGroupId, [c]); }
                for (const [, group] of mg) { const nw = group.filter((c) => !isWild(c, wildRank)); const w = group.filter((c) => isWild(c, wildRank)); if (nw.length >= 2 && new Set(nw.map((c) => c.rank)).size > 1) group.sort((a, b) => a.rank - b.rank); else { group.length = 0; group.push(...nw, ...w); } }
                const isActive = opponent.sessionId === currentPlayer?.sessionId;
                return (
                  <div key={opponent.sessionId}
                    className={`${pos} mb-3 ${rot}`}
                    style={idx === 1 || idx === 2 ? { writingMode: "vertical-rl", textOrientation: "mixed" } : {}}
                  >
                    <div className={`rounded-lg border p-2 inline-flex flex-col ${isActive ? "border-blue-400 dark:border-blue-500 ring-1 ring-blue-300" : "border-gray-200 dark:border-gray-700"}`}>
                      <p className={`text-xs font-semibold mb-1 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`}
                        style={idx === 1 || idx === 2 ? { writingMode: "horizontal-tb" } : {}}
                      >{opponent.name}</p>
                      <div className="flex gap-1 mb-1" style={idx === 1 || idx === 2 ? { flexDirection: "column" } : {}}>
                        {opponent.hand.length > 0 && <Card faceDown small />}
                        {opponent.hand.length > 1 && <span className="text-[10px] text-gray-400">×{opponent.hand.length}</span>}
                      </div>
                      {[...mg.entries()].map(([gid, group]) => (
                        <DroppableMeldGroup key={gid} id={`meld-group-${gid}`} canDrop={canMeld}>
                          {group.map((card, ci) => <Card key={ci} rank={card.rank} suit={card.suit} wild={card.rank === wildRank} />)}
                        </DroppableMeldGroup>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Center: deck + discard */}
            <div className="flex justify-center gap-8 mb-3">
              <div className="text-center">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Draw</p>
                <Card faceDown onClick={handleDrawFromDeck} disabled={!canDraw} />
                <p className="text-[10px] text-gray-400 mt-0.5">{drawPile.length}</p>
              </div>
              <DroppableDiscard id="discard" canDrop={canDiscard}>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Discard</p>
                {discardPile.length > 0 ? (
                  <Card rank={discardPile[discardPile.length - 1].rank} suit={discardPile[discardPile.length - 1].suit} wild={discardPile[discardPile.length - 1].rank === wildRank} onClick={handleDrawFromDiscard} disabled={!canDraw} />
                ) : (
                  <div className="w-10 h-14 rounded-lg border border-dashed border-gray-300 dark:border-gray-600" />
                )}
              </DroppableDiscard>
            </div>

            {/* Your melds */}
            {myBoard.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your Melds</p>
                <DroppableBoard id="board" canDrop={canMeld}>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const mg = new Map<string, CardData[]>();
                      for (const c of myBoard) { if (!c.meldGroupId) continue; const g = mg.get(c.meldGroupId); if (g) g.push(c); else mg.set(c.meldGroupId, [c]); }
                      for (const [, group] of mg) { const nw = group.filter((c) => !isWild(c, wildRank)); const w = group.filter((c) => isWild(c, wildRank)); if (nw.length >= 2 && new Set(nw.map((c) => c.rank)).size > 1) group.sort((a, b) => a.rank - b.rank); else { group.length = 0; group.push(...nw, ...w); } }
                      return [...mg.entries()].map(([gid, group]) => (
                      <DroppableMeldGroup key={gid} id={`meld-group-${gid}`} canDrop={canMeld}>
                          {group.map((card, ci) => (
                            <Card key={ci} rank={card.rank} suit={card.suit} wild={card.rank === wildRank}
                              onClick={canMeld && card.rank === wildRank && interactionMode === "none" ? () => handleBoardCardClick(card, ci) : undefined}
                              selected={interactionMode === "swapping" && swapTarget?.meldGroupId === gid && swapTarget?.meldCardIndex === ci}
                            />
                          ))}
                        </DroppableMeldGroup>
                      ));
                    })()}
                  </div>
                </DroppableBoard>
              </div>
            )}
            {myBoard.length === 0 && (
              <DroppableBoard id="board" canDrop={canMeld}>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">{canMeld ? "Drag cards here to meld" : "No melds yet"}</p>
              </DroppableBoard>
            )}

            {/* Your hand */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your Hand</p>
              {(() => {
                const hp = players.find((p) => p.sessionId === mySessionId)?.hand;
                if (!hp) return <p className="text-xs text-gray-400 italic">Waiting...</p>;
                if (handOrder.length !== hp.length) setHandOrder(hp.map((_, i) => i));
                return (
                  <SortableContext items={handOrder.map((i) => `hand-${i}`)} strategy={rectSortingStrategy}>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {handOrder.map((origIdx) => (
                        <SortableCard key={origIdx} card={hp[origIdx]!} origIdx={origIdx} wildRank={wildRank} canDrag={canDrag} onContextMenu={() => handleHandClick(origIdx)} />
                      ))}
                    </div>
                  </SortableContext>
                );
              })()}
            </div>
          </div>

          <DragOverlay>
            {activeDragCard ? <DragCard rank={activeDragCard.rank} suit={activeDragCard.suit} wild={activeDragCard.rank === wildRank} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Instructions & errors */}
      {canMeld && !meldChoice && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">Drag cards to the board or meld groups</p>}
      {canDiscard && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">Drag a card to the discard pile</p>}
      {meldError && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{meldError}</p>}

      {/* Add/Swap dialog */}
      {meldChoice && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <p className="text-sm mb-4 text-center">Add this card or swap the wild?</p>
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
        <div className="rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950 p-3 mb-6">
          <h2 className="text-xs font-bold mb-2">Round {currentRound + 1} — Wild: {wildName}</h2>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-orange-200 dark:border-orange-800"><th className="text-left px-2 py-1 font-medium text-orange-700 dark:text-orange-300">Player</th><th className="text-right px-2 py-1 font-medium text-orange-700 dark:text-orange-300">Round</th><th className="text-right px-2 py-1 font-medium text-orange-700 dark:text-orange-300">Total</th></tr></thead>
            <tbody>{roundScores.map((p) => (<tr key={p.sessionId} className="border-b border-orange-200 dark:border-orange-800 last:border-0"><td className="px-2 py-1">{p.name}</td><td className="px-2 py-1 text-right tabular-nums">{p.roundScore}</td><td className="px-2 py-1 text-right tabular-nums">{p.score}</td></tr>))}</tbody>
          </table>
        </div>
      )}

      {/* Match over */}
      {status === "finished" && winnerSessionId && (
        <div className="text-center mb-6">
          <h2 className="text-base font-bold mb-1">Match Over!</h2>
          <p className="text-xs mb-3">Winner: <strong>{players.find((p) => p.sessionId === winnerSessionId)?.name ?? "Unknown"}</strong> 🎉</p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-3 text-xs">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-gray-800"><th className="text-left px-2 py-1.5 font-medium text-gray-500 dark:text-gray-400">#</th><th className="text-left px-2 py-1.5 font-medium text-gray-500 dark:text-gray-400">Player</th><th className="text-right px-2 py-1.5 font-medium text-gray-500 dark:text-gray-400">Score</th></tr></thead>
              <tbody>{[...players].sort((a, b) => a.score - b.score).map((p, i) => (<tr key={p.sessionId} className="border-t border-gray-100 dark:border-gray-800"><td className="px-2 py-1.5 tabular-nums">{i + 1}</td><td className={`px-2 py-1.5 ${i === 0 ? "font-bold" : ""}`}>{p.name}</td><td className="px-2 py-1.5 text-right tabular-nums">{p.score}</td></tr>))}</tbody>
            </table>
          </div>
          <button onClick={() => { cleanupRef.current(); navigate("/"); }} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition">Back to Lobby</button>
        </div>
      )}
    </div>
  );
}
