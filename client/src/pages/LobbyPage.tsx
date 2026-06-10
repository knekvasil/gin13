import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createColyseusClient } from "../auth/colyseus";
import type { Client } from "colyseus.js";

interface RoomEntry {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: { totalRounds?: number; players?: number };
}

export default function LobbyPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [roundCount, setRoundCount] = useState(13);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!token) return;
    const c = createColyseusClient(token);
    setClient(c);

    const fetchRooms = async () => {
      try {
        const available = await c.getAvailableRooms("game_room");
        setRooms(available as RoomEntry[]);
      } catch {
        // server not ready yet
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCreate = useCallback(async () => {
    if (!client || !token) return;
    try {
      const room = await client.create("game_room", { totalRounds: roundCount });
      navigate(`/game/${room.roomId}`);
    } catch (err) {
      console.error("create room failed", err);
    }
  }, [client, token, roundCount, navigate]);

  const handleQuickPlay = useCallback(async () => {
    if (!client || !token) return;
    try {
      const room = await client.joinOrCreate("game_room", {});
      navigate(`/game/${room.roomId}`);
    } catch (err) {
      console.error("quick play failed", err);
    }
  }, [client, token, navigate]);

  const handleJoin = useCallback(
    async (roomId: string) => {
      if (!client || !token) return;
      try {
        const room = await client.joinById(roomId);
        navigate(`/game/${room.roomId}`);
      } catch (err) {
        console.error("join room failed", err);
      }
    },
    [client, token, navigate]
  );

  return (
    <div>
      <h1>Gin 13</h1>
      <p>Welcome, {user?.displayName}!</p>

      <div>
        <button onClick={() => setShowCreate(true)}>Create Room</button>
        <button onClick={handleQuickPlay}>Quick Play</button>
        <button onClick={logout}>Logout</button>
      </div>

      {showCreate && (
        <div>
          <h2>Create a Room</h2>
          <label>
            Rounds:
            <input
              type="number"
              min={1}
              max={13}
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
            />
          </label>
          <button onClick={handleCreate}>Start</button>
          <button onClick={() => setShowCreate(false)}>Cancel</button>
        </div>
      )}

      <h2>Open Rooms</h2>
      {rooms.length === 0 ? (
        <p>No open rooms. Create one or join via Quick Play!</p>
      ) : (
        <ul>
          {rooms.map((room) => (
            <li key={room.roomId}>
              <span>
                {room.metadata?.players ?? room.clients}/{room.maxClients}
              </span>
              <span> | {room.metadata?.totalRounds ?? "?"} rounds</span>
              <button onClick={() => handleJoin(room.roomId)} disabled={room.clients >= room.maxClients}>
                Join
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
