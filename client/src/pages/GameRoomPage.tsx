import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Room } from "colyseus.js";

interface PlayerState {
  sessionId: string;
  userId: string;
  name: string;
}

export default function GameRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [status, setStatus] = useState("waiting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !roomId) return;

    const client = createColyseusClient(token);
    let joined: Room | null = null;

    client.joinById(roomId).then((joinedRoom) => {
      joined = joinedRoom;
      setRoom(joinedRoom);

      const getState = () => joinedRoom.state as any;

      const updatePlayers = () => {
        const state = getState();
        setStatus(state.status || "waiting");
        const list: PlayerState[] = [];
        state.players?.forEach?.((p: PlayerState) => list.push(p));
        setPlayers(list);
      };

      updatePlayers();
      joinedRoom.onStateChange(() => updatePlayers());

      const state = getState();
      state.players?.onAdd?.((_p: any, _i: number) => updatePlayers());
      state.players?.onRemove?.(() => updatePlayers());
    }).catch((err) => {
      setError(err.message || "Failed to join room");
    });

    return () => {
      joined?.leave();
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

  return (
    <div>
      <h1>Game Room</h1>
      <p>Room: {roomId}</p>
      <p>Status: {status === "waiting" ? "Waiting for players..." : status}</p>

      <h2>Players ({players.length}/4)</h2>
      <ul>
        {players.map((p) => (
          <li key={p.sessionId}>{p.name}</li>
        ))}
      </ul>

      {status === "waiting" && players.length < 3 && (
        <p>Waiting for players... ({players.length}/3 minimum)</p>
      )}

      {status === "waiting" && players.length >= 3 && (
        <button>Start Game</button>
      )}

      <button onClick={() => { room?.leave(); navigate("/"); }}>Leave Room</button>
    </div>
  );
}
