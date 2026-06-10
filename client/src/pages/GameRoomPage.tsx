import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Room } from "colyseus.js";
import Card from "../components/Card";

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
  const cleanupRef = useRef<() => void>(() => {});

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
      setMySessionId(joinedRoom.sessionId);

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

        const dPile: CardData[] = [];
        state.drawPile?.forEach?.((c: CardData) => dPile.push(c));
        setDrawPile(dPile);

        const diPile: CardData[] = [];
        state.discardPile?.forEach?.((c: CardData) => diPile.push(c));
        setDiscardPile(diPile);
      };

      updatePlayers();
      joinedRoom.onStateChange(updatePlayers);

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

  const wildRankNames = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const wildName = wildRankNames[wildRank] || String(wildRank);

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

      {status === "waiting" && players.length >= 3 && (
        <button>Start Game</button>
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
              <Card faceDown />
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
                  return (
                    <div key={player.sessionId} style={{ marginBottom: 12 }}>
                      <p style={{ fontWeight: "bold", fontSize: 14 }}>{player.name}</p>
                      {[...meldGroups.values()].map((group, gi) => (
                        <div
                          key={gi}
                          style={{ display: "flex", gap: 4, marginBottom: 6 }}
                        >
                          {group.map((card, ci) => (
                            <Card
                              key={ci}
                              rank={card.rank}
                              suit={card.suit}
                              wild={card.rank === wildRank}
                            />
                          ))}
                        </div>
                      ))}
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
                ?.hand.map((card, i) => (
                  <Card
                    key={i}
                    rank={card.rank}
                    suit={card.suit}
                    wild={card.rank === wildRank}
                  />
                ))}
            </div>
            {!players.find((p) => p.sessionId === mySessionId) && (
              <p style={{ fontSize: 12, color: "#888" }}>Waiting for game to start...</p>
            )}
          </div>
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
