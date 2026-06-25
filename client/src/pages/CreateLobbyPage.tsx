import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createColyseusClient } from "../auth/colyseus";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { X, Plus, Bot, User, Minus } from "lucide-react";

const BOT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta",
  "Echo", "Foxtrot", "Golf", "Hotel",
  "India", "Juliett", "Kilo", "Lima",
  "Mike", "November", "Oscar", "Papa",
  "Quebec", "Romeo", "Sierra", "Tango",
  "Uniform", "Victor", "Whiskey", "X-ray",
];

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 3;

interface Slot {
  type: "empty" | "you" | "bot";
  botId?: string;
  name?: string;
}

function randomBot(exclude: Set<string>): string {
  const available = BOT_NAMES.filter((_, i) => !exclude.has(`bot_${i}`));
  if (available.length === 0) return "";
  const pick = available[Math.floor(Math.random() * available.length)]!;
  return `bot_${BOT_NAMES.indexOf(pick)}`;
}

export default function CreateLobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState(13);
  const [slots, setSlots] = useState<Slot[]>(() => {
    const s: Slot[] = [{ type: "you", name: user?.displayName ?? "You" }];
    for (let i = 1; i < MAX_PLAYERS; i++) s.push({ type: "empty" });
    return s;
  });

  const filledCount = slots.filter((s) => s.type !== "empty").length;
  const canStart = filledCount >= MIN_PLAYERS;
  const usedBotIds = new Set(
    slots.filter((s) => s.type === "bot").map((s) => s.botId!).filter(Boolean),
  );

  const addBot = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      const existingBots = new Set(
        next.filter((s) => s.type === "bot").map((s) => s.botId!).filter(Boolean),
      );
      const botId = randomBot(existingBots);
      if (!botId) return prev;
      const botIndex = Number(botId.replace("bot_", ""));
      next[index] = { type: "bot", botId, name: BOT_NAMES[botIndex] ?? botId };
      return next;
    });
  }, []);

  const removeSlot = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { type: "empty" };
      return next;
    });
  }, []);

  const handleStart = useCallback(async () => {
    const token = localStorage.getItem("jwt");
    if (!token || !canStart) return;

    const takenBotIds = slots
      .filter((s) => s.type === "bot")
      .map((s) => s.botId!)
      .filter(Boolean);

    try {
      const client = createColyseusClient(token);
      const room = await client.create("game_room", {
        totalRounds: rounds,
        botIds: takenBotIds,
      });
      navigate(`/game/${room.roomId}`);
      room.leave();
    } catch (err) {
      console.error("create lobby failed", err);
    }
  }, [rounds, slots, canStart, navigate]);

  const decrementRounds = () => setRounds((r) => Math.max(1, r - 1));
  const incrementRounds = () => setRounds((r) => Math.min(13, r + 1));

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Create Lobby</h1>
        <Button variant="outline" size="sm" onClick={() => navigate("/lobby")}>
          Back to Lobby
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs font-medium">Rounds</Label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-7" onClick={decrementRounds} disabled={rounds <= 1}>
            <Minus className="size-3" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{rounds}</span>
          <Button variant="outline" size="icon" className="size-7" onClick={incrementRounds} disabled={rounds >= 13}>
            <Plus className="size-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {slots.map((slot, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-muted-foreground text-xs font-medium w-12 shrink-0">
                {i === 0 ? "Host" : `Slot ${i + 1}`}
              </span>
              {slot.type === "you" && (
                <span className="flex items-center gap-2 font-medium">
                  <User className="size-4 text-primary" />
                  {slot.name}
                </span>
              )}
              {slot.type === "bot" && (
                <span className="flex items-center gap-2 font-medium">
                  <Bot className="size-4 text-orange-500" />
                  {slot.name}
                </span>
              )}
              {slot.type === "empty" && (
                <span className="text-muted-foreground italic">Waiting for players to join...</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {slot.type === "bot" && (
                <Button variant="ghost" size="icon" className="size-7" onClick={() => removeSlot(i)}>
                  <X className="size-3.5" />
                </Button>
              )}
              {slot.type === "empty" && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => addBot(i)}>
                  <Plus className="size-3" />
                  Bot
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full" size="lg" disabled={!canStart} onClick={handleStart}>
        {canStart ? "Start Game" : `Need ${MIN_PLAYERS - filledCount} more player(s)`}
      </Button>
    </div>
  );
}
