import {
  DndContext, DragOverlay, closestCorners,
  useDroppable,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import AnimatedCard from "../components/AnimatedCard";

interface CardData { rank: number; suit: number; meldGroupId: string; }

const WILD_RANK = 13;
const RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface Player {
  name: string;
  score: number;
  hand: CardData[];
  board: CardData[];
  disconnected: boolean;
}

const MOCK_PLAYERS: Player[] = [
  {
    name: "Alice",
    score: 42,
    hand: [
      { rank: 1, suit: 0, meldGroupId: "" },
      { rank: 5, suit: 1, meldGroupId: "" },
      { rank: 2, suit: 2, meldGroupId: "" },
      { rank: 7, suit: 3, meldGroupId: "" },
    ],
    board: [
      { rank: 9, suit: 1, meldGroupId: "meld_a" },
      { rank: 10, suit: 1, meldGroupId: "meld_a" },
      { rank: 11, suit: 1, meldGroupId: "meld_a" },
      { rank: 12, suit: 1, meldGroupId: "meld_a" },
      { rank: 13, suit: 0, meldGroupId: "meld_b" },
      { rank: 13, suit: 1, meldGroupId: "meld_b" },
      { rank: 13, suit: 2, meldGroupId: "meld_b" },
    ],
    disconnected: false,
  },
  {
    name: "Bob",
    score: 15,
    hand: [
      { rank: 10, suit: 0, meldGroupId: "" },
      { rank: 11, suit: 3, meldGroupId: "" },
      { rank: 6, suit: 2, meldGroupId: "" },
    ],
    board: [
      { rank: 7, suit: 0, meldGroupId: "meld_c" },
      { rank: 7, suit: 1, meldGroupId: "meld_c" },
      { rank: 7, suit: 2, meldGroupId: "meld_c" },
      { rank: 2, suit: 3, meldGroupId: "meld_d" },
      { rank: 3, suit: 3, meldGroupId: "meld_d" },
      { rank: 4, suit: 3, meldGroupId: "meld_d" },
      { rank: 5, suit: 3, meldGroupId: "meld_d" },
    ],
    disconnected: false,
  },
  {
    name: "Charlie",
    score: 30,
    hand: [
      { rank: 3, suit: 3, meldGroupId: "" },
      { rank: 6, suit: 1, meldGroupId: "" },
      { rank: 8, suit: 1, meldGroupId: "" },
      { rank: 9, suit: 0, meldGroupId: "" },
      { rank: 12, suit: 2, meldGroupId: "" },
    ],
    board: [
      { rank: 10, suit: 0, meldGroupId: "meld_e" },
      { rank: 10, suit: 2, meldGroupId: "meld_e" },
      { rank: 10, suit: 3, meldGroupId: "meld_e" },
    ],
    disconnected: true,
  },
  {
    name: "Diana",
    score: 27,
    hand: [
      { rank: 8, suit: 0, meldGroupId: "" },
      { rank: 11, suit: 0, meldGroupId: "" },
      { rank: 5, suit: 3, meldGroupId: "" },
    ],
    board: [
      { rank: 1, suit: 0, meldGroupId: "meld_f" },
      { rank: 2, suit: 0, meldGroupId: "meld_f" },
      { rank: 3, suit: 0, meldGroupId: "meld_f" },
      { rank: 4, suit: 0, meldGroupId: "meld_f" },
    ],
    disconnected: false,
  },
];

function DroppableMeldGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: true });
  return (
    <div ref={setNodeRef}
      style={{
        display: "flex", gap: 2, padding: 4,
        borderRadius: 6,
        outline: isOver ? "2px solid #4a90d9" : undefined,
        background: isOver ? "rgba(74,144,217,0.1)" : undefined,
      }}>
      {children}
    </div>
  );
}

function OpponentRow({ player, isLeft }: { player: Player; isLeft: boolean }) {
  const mg = new Map<string, CardData[]>();
  for (const c of player.board) {
    if (!c.meldGroupId) continue;
    const g = mg.get(c.meldGroupId);
    if (g) g.push(c); else mg.set(c.meldGroupId, [c]);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", flexDirection: isLeft ? "row" : "row-reverse" }}>
      <div style={{
        display: "flex", flexDirection: "column", gap: 6, padding: 8,
        borderRadius: 8, border: "1px solid #ccc", flexShrink: 0, background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: isLeft ? "#3b82f6" : "#a855f7",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: "bold",
          }}>
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{player.name}</p>
            <p style={{ fontSize: 10, color: "#888", margin: 0 }}>{player.score}</p>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: player.disconnected ? "#f00" : "#0f0",
          }} />
        </div>
      </div>
      <div style={{ position: "relative", width: 300, height: 300, overflow: "visible", flexShrink: 0 }}>
        <div style={{
          position: "absolute",
          left: "50%", top: "50%",
          transform: `translate(${isLeft ? "-65%" : "-17.5%"}, -50%) ${isLeft ? "rotate(90deg)" : "rotate(-90deg)"}`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          {[...mg.entries()].map(([gid, group]) => (
            <DroppableMeldGroup key={gid} id={`meld-group-${gid}`}>
              {group.map((card, ci) => <AnimatedCard key={ci} rank={card.rank} suit={card.suit} wild={card.rank === WILD_RANK} small />)}
            </DroppableMeldGroup>
          ))}
          <div style={{ display: "flex", gap: 2 }}>
            {player.hand.map((_, i) => <AnimatedCard key={i} faceDown small />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopOpponent({ player }: { player: Player }) {
  const mg = new Map<string, CardData[]>();
  for (const c of player.board) {
    if (!c.meldGroupId) continue;
    const g = mg.get(c.meldGroupId);
    if (g) g.push(c); else mg.set(c.meldGroupId, [c]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        display: "flex", flexDirection: "column", gap: 6, padding: "6px 12px", marginBottom: 4,
        borderRadius: 8, border: "1px solid #ccc", background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "#f97316",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: "bold",
          }}>
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{player.name}</p>
            <p style={{ fontSize: 10, color: "#888", margin: 0 }}>{player.score}</p>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: player.disconnected ? "#f00" : "#0f0",
          }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", gap: 2 }}>
          {player.hand.map((_, i) => <AnimatedCard key={i} faceDown small />)}
        </div>
        {[...mg.entries()].map(([gid, group]) => (
          <DroppableMeldGroup key={gid} id={`meld-group-${gid}`}>
            {group.map((card, ci) => <AnimatedCard key={ci} rank={card.rank} suit={card.suit} wild={card.rank === WILD_RANK} small />)}
          </DroppableMeldGroup>
        ))}
      </div>
    </div>
  );
}

export default function TestBoardPage() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  const opps = MOCK_PLAYERS.slice(1);
  const me = MOCK_PLAYERS[0]!;

  const myBoardMg = new Map<string, CardData[]>();
  for (const c of me.board) {
    if (!c.meldGroupId) continue;
    const g = myBoardMg.get(c.meldGroupId);
    if (g) g.push(c); else myBoardMg.set(c.meldGroupId, [c]);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", padding: "8px 16px", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 4 }}>Gin 13 — Test Board</h1>
        <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
          Wild: <strong>{RANK_NAMES[WILD_RANK]}</strong> | Round 1
        </p>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 8 }}>
          {opps[2] && (
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
              <TopOpponent player={opps[2]} />
            </div>
          )}

          <div style={{ flex: 1, position: "relative" }}>
            {opps[0] && (
              <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                <OpponentRow player={opps[0]} isLeft />
              </div>
            )}
            {opps[1] && (
              <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>
                <OpponentRow player={opps[1]} isLeft={false} />
              </div>
            )}

            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 500, color: "#888", marginBottom: 4 }}>Draw</p>
                  <AnimatedCard faceDown small />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 500, color: "#888", marginBottom: 4 }}>Discard</p>
                  <AnimatedCard rank={8} suit={3} wild={false} small />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 8 }}>
            {myBoardMg.size > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                {[...myBoardMg.entries()].map(([gid, group]) => (
                  <DroppableMeldGroup key={gid} id={`meld-group-${gid}`}>
                    {group.map((card, ci) => (
                      <AnimatedCard key={ci} rank={card.rank} suit={card.suit} wild={card.rank === WILD_RANK} small />
                    ))}
                  </DroppableMeldGroup>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {me.hand.map((card, i) => (
                <AnimatedCard key={i} rank={card.rank} suit={card.suit} wild={card.rank === WILD_RANK} small />
              ))}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", borderRadius: 8, border: "1px solid #ccc",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#16a34a",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 12, fontWeight: "bold",
              }}>
                {me.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{me.name}</p>
                <p style={{ fontSize: 10, color: "#888", margin: 0 }}>{me.score}</p>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0f0" }} />
            </div>
          </div>
        </div>
      </div>

      <DragOverlay />
    </DndContext>
  );
}
