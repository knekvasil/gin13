import { useDroppable } from "@dnd-kit/core";
import AnimatedCard from "./AnimatedCard";

interface CardData {
  rank: number;
  suit: number;
  meldGroupId: string;
}

interface DiscardZoneProps {
  discardPile: CardData[];
  wildRank: number;
  isActive: boolean;
}

export default function DiscardZone({ discardPile, wildRank, isActive }: DiscardZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "discard-pile",
    data: { type: "discard" },
    disabled: !isActive,
  });

  const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

  return (
    <div
      style={{ textAlign: "center", position: "relative" }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#555" }}>
        Discard
      </p>
      <div
        ref={setNodeRef}
        style={{
          minWidth: 56,
          minHeight: 80,
          border: "2px solid",
          borderColor: isOver ? "#f44336" : "#999",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isOver ? "rgba(244, 67, 54, 0.12)" : "rgba(0,0,0,0.03)",
          transition: "background 0.15s, border-color 0.15s",
          opacity: isActive ? 1 : 0.4,
        }}
      >
        {isActive && discardPile.length === 0 && !isOver && (
          <span style={{ fontSize: 11, color: "#888" }}>Drop to discard</span>
        )}
        {topCard && (
          <AnimatedCard
            rank={topCard.rank}
            suit={topCard.suit}
            wild={topCard.rank === wildRank}
            layoutId={`card-${topCard.rank}-${topCard.suit}`}
          />
        )}
      </div>
      {discardPile.length > 1 && (
        <p style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
          +{discardPile.length - 1} more
        </p>
      )}
    </div>
  );
}
