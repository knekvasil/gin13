import { useState, useEffect, useCallback, useRef } from "react";
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
  const [creating, setCreating] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    const c = createColyseusClient(token);
    clientRef.current = c;

    const fetchRooms = async () => {
      try {
        const available = await c.getAvailableRooms("game_room");
        setRooms(available as RoomEntry[]);
      } catch {
        // server not ready yet
      }
    };

    fetchRooms();
    intervalRef.current = setInterval(fetchRooms, 3000);

    return () => {
      clearInterval(intervalRef.current!);
    };
  }, [token]);

  const refreshRooms = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    try {
      const available = await c.getAvailableRooms("game_room");
      setRooms(available as RoomEntry[]);
    } catch {
      // server not ready yet
    }
  }, []);

  const handleCreate = useCallback(async () => {
    const c = clientRef.current;
    if (!c || !token || creating) return;
    setCreating(true);
    try {
      const room = await c.create("game_room", { totalRounds: roundCount });
      navigate(`/game/${room.roomId}`);
      room.leave();
    } catch (err) {
      console.error("create room failed", err);
      setCreating(false);
    }
  }, [token, roundCount, navigate, creating]);

  const handleQuickPlay = useCallback(async () => {
    const c = clientRef.current;
    if (!c || !token) return;
    try {
      const room = await c.joinOrCreate("game_room", {});
      navigate(`/game/${room.roomId}`);
      room.leave();
    } catch (err) {
      console.error("quick play failed", err);
    }
  }, [token, navigate]);

  const handleJoin = useCallback(
    async (roomId: string) => {
      const c = clientRef.current;
      if (!c || !token) return;
      try {
        const room = await c.joinById(roomId);
        navigate(`/game/${room.roomId}`);
        room.leave();
      } catch {
        refreshRooms();
      }
    },
    [token, navigate, refreshRooms],
  );

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Gin 13</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Welcome, {user?.displayName}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/leaderboard")}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Leaderboard
          </button>
          <button
            onClick={() => navigate("/matches")}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            History
          </button>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setShowCreate(true)}
          disabled={creating}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Room"}
        </button>
        <button
          onClick={handleQuickPlay}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition"
        >
          Quick Play
        </button>
      </div>

      {showCreate && (
        <div className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-base font-semibold mb-4">Create a Room</h2>
          <label className="block text-sm font-medium mb-1.5">Number of Rounds</label>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              min={1}
              max={13}
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
              className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition"
            >
              Start
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Open Rooms</h2>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No open rooms. Create one or join via Quick Play!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <div
              key={room.roomId}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium tabular-nums">
                  {room.clients}/{room.maxClients}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {room.metadata?.totalRounds ?? "?"} rounds
                </span>
              </div>
              <button
                onClick={() => handleJoin(room.roomId)}
                disabled={room.clients >= room.maxClients}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                {room.clients >= room.maxClients ? "Full" : "Join"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
