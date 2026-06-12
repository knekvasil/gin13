import { useDroppable } from "@dnd-kit/core";
import AnimatedCard from "./AnimatedCard";
import { canMeldCards, RANK_NAMES } from "../lib/card-utils";

interface CardData {
  rank: number;
  suit: number;
  meldGroupId: string;
}

interface StagingWellProps {
  cards: CardData[];
  wildRank: number;
  onPlay: () => void;
  onClear: () => void;
  isActive: boolean;
}

export default function StagingWell({ cards, wildRank, onPlay, onClear, isActive }: StagingWellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "staging-well",
    data: { type: "staging" },
    disabled: !isActive,
  });

  const valid = cards.length >= 3 && canMeldCards(cards, wildRank);

  if (cards.length === 0 && !isOver) {
    if (!isActive) return null;
    return (
      <div
        ref={setNodeRef}
        style={{
          minWidth: 56,
          minHeight: 80,
          border: "2px dashed #999",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isOver ? "rgba(76, 175, 80, 0.15)" : "rgba(0,0,0,0.03)",
          transition: "background 0.15s",
          fontSize: 11,
          color: "#888",
          padding: "0 8px",
        }}
      >
        Drop cards here to meld
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 10px",
        borderRadius: 8,
        border: `2px solid ${valid ? "#4caf50" : isOver ? "#4caf50" : "#ccc"}`,
        background: isOver ? "rgba(76, 175, 80, 0.12)" : valid ? "rgba(76, 175, 80, 0.06)" : "rgba(0,0,0,0.03)",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {cards.map((card, i) => (
        <AnimatedCard
          key={i}
          rank={card.rank}
          suit={card.suit}
          wild={card.rank === wildRank}
          layoutId={`card-${card.rank}-${card.suit}`}
        />
      ))}
      {valid && (
        <button
          onClick={onPlay}
          style={{
            marginLeft: 8,
            padding: "6px 14px",
            background: "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: "bold",
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Play Meld
        </button>
      )}
      <button
        onClick={onClear}
        style={{
          marginLeft: 4,
          padding: "6px 10px",
          background: "transparent",
          color: "#888",
          border: "1px solid #ccc",
          borderRadius: 6,
          fontSize: 12,
          cursor: "pointer",
        }}
        title="Clear staging"
      >
        ✕
      </button>
    </div>
  );
}
