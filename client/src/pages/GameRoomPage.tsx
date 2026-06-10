import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Room } from "colyseus.js";
import Card from "../components/Card";

type InteractionMode = "none" | "adding" | "swapping" | "rearranging";

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
  const [rearrangeNewMelds, setRearrangeNewMelds] = useState<{ source: string; index: number }[][] | null>(null);
  const [rearrangeSelected, setRearrangeSelected] = useState<{ source: string; index: number } | null>(null);
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
    setRearrangeNewMelds(null);
    setRearrangeSelected(null);
    setMeldError(null);
  };

  const handleEnterAddMode = () => {
    setInteractionMode("adding");
    setAddCardIndex(null);
    setSwapTarget(null);
    setRearrangeNewMelds(null);
    setMeldError(null);
  };

  const handleEnterRearrangeMode = () => {
    const meldGroups = new Map<string, CardData[]>();
    for (const card of myBoard) {
      if (!card.meldGroupId) continue;
      const group = meldGroups.get(card.meldGroupId);
      if (group) group.push(card);
      else meldGroups.set(card.meldGroupId, [card]);
    }
    const newMelds: { source: string; index: number }[][] = [];
    for (const [groupId, group] of meldGroups) {
      newMelds.push(group.map((_, idx) => ({ source: groupId, index: idx })));
    }
    setRearrangeNewMelds(newMelds);
    setInteractionMode("rearranging");
    setMeldError(null);
  };

  const handleDoneRearrange = () => {
    if (!room || !rearrangeNewMelds) return;
    room.send("rearrange_melds", { newMelds: rearrangeNewMelds });
    setInteractionMode("none");
    setRearrangeNewMelds(null);
    setRearrangeSelected(null);
    setMeldError(null);
  };

  const handleRearrangeCardClick = (source: string, index: number) => {
    if (rearrangeSelected && rearrangeSelected.source === source && rearrangeSelected.index === index) {
      setRearrangeSelected(null);
      return;
    }
    setRearrangeSelected({ source, index });
  };

  const handleRearrangeMoveToGroup = (targetGroupIdx: number) => {
    if (!rearrangeSelected || !rearrangeNewMelds) return;
    const newMelds = rearrangeNewMelds.map((group) => [...group]);
    let cardRef: { source: string; index: number } | null = null;
    let sourceGroupIdx = -1;
    for (let gi = 0; gi < newMelds.length; gi++) {
      const foundIdx = newMelds[gi].findIndex(
        (ref) => ref.source === rearrangeSelected.source && ref.index === rearrangeSelected.index,
      );
      if (foundIdx !== -1) {
        cardRef = newMelds[gi][foundIdx];
        newMelds[gi] = newMelds[gi].filter((_, i) => i !== foundIdx);
        sourceGroupIdx = gi;
        break;
      }
    }
    if (!cardRef || sourceGroupIdx === -1) return;
    const filtered = newMelds.filter((g) => g.length > 0);
    const adjustedTarget = targetGroupIdx <= sourceGroupIdx ? targetGroupIdx : targetGroupIdx;
    filtered[adjustedTarget] = [...filtered[adjustedTarget], cardRef];
    setRearrangeNewMelds(filtered);
    setRearrangeSelected(null);
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
    room.send("add_to_meld", { cardIndex: addCardIndex, meldGroupId });
    setInteractionMode("none");
    setAddCardIndex(null);
    setMeldError(null);
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

            <div style={{ textAlign: "center" }}>
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
                  const isOwn = player.sessionId === mySessionId;
                  const groupEntries = [...meldGroups.entries()];
                  return (
                    <div key={player.sessionId} style={{ marginBottom: 12 }}>
                      <p style={{ fontWeight: "bold", fontSize: 14 }}>{player.name}</p>
                      {groupEntries.map(([meldGroupId, group], gi) => {
                        const isTarget = interactionMode === "rearranging" && !!rearrangeSelected;
                        const isRearrangeDropTarget = isTarget && isOwn;
                        return (
                          <div
                            key={meldGroupId}
                            data-testid={`meld-group-${meldGroupId}`}
                            onClick={
                              interactionMode === "adding" && isOwn
                                ? () => handleAddToMeld(meldGroupId)
                                : interactionMode === "rearranging" && isOwn && rearrangeSelected
                                  ? () => handleRearrangeMoveToGroup(gi)
                                  : undefined
                            }
                            style={{
                              display: "flex",
                              gap: 4,
                              marginBottom: 6,
                              ...(interactionMode === "adding" && isOwn ? {
                                outline: "2px dashed #4caf50",
                                borderRadius: 6,
                                padding: 4,
                                cursor: "pointer",
                                background: "#f0faf0",
                              } : {}),
                              ...(isRearrangeDropTarget ? {
                                outline: "2px dashed #2196f3",
                                borderRadius: 6,
                                padding: 4,
                                cursor: "pointer",
                                background: "#e3f2fd",
                              } : {}),
                            }}
                          >
                            {group.map((card, ci) => {
                              const isSelectedForSwap = interactionMode === "swapping" && swapTarget?.meldGroupId === meldGroupId && swapTarget?.meldCardIndex === ci;
                              const isSelectedForRearrange = interactionMode === "rearranging" && rearrangeSelected?.source === meldGroupId && rearrangeSelected?.index === ci;
                              return (
                                <Card
                                  key={ci}
                                  rank={card.rank}
                                  suit={card.suit}
                                  wild={card.rank === wildRank}
                                  onClick={
                                    isOwn && canMeld && card.rank === wildRank && interactionMode === "none"
                                      ? () => handleBoardCardClick(card, ci)
                                      : isOwn && interactionMode === "rearranging"
                                        ? () => handleRearrangeCardClick(meldGroupId, ci)
                                        : undefined
                                  }
                                  selected={isSelectedForSwap || isSelectedForRearrange}
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
                    />
                  );
                })}
            </div>
            {!players.find((p) => p.sessionId === mySessionId) && (
              <p style={{ fontSize: 12, color: "#888" }}>Waiting for game to start...</p>
            )}
            {canMeld && (
              <div style={{ marginTop: 8 }}>
                {interactionMode !== "none" && (
                  <p style={{ fontSize: 13, fontStyle: "italic", marginBottom: 4 }}>
                    {interactionMode === "adding" && (addCardIndex === null
                      ? "Adding to meld — select a card from your hand"
                      : "Adding to meld — click a meld group")}
                    {interactionMode === "swapping" && "Swapping wild — click a hand card to swap"}
                    {interactionMode === "rearranging" && "Rearranging — click cards to move between meld groups"}
                  </p>
                )}
                {interactionMode === "rearranging" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={handleDoneRearrange}>Done</button>
                    <button onClick={handleCancelMode}>Cancel</button>
                    {meldError && <span style={{ color: "red", fontSize: 13 }}>{meldError}</span>}
                  </div>
                ) : interactionMode !== "none" ? (
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
                    {hasMelds && <button onClick={handleEnterRearrangeMode}>Rearrange</button>}
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
