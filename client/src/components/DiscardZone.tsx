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
  onClick?: () => void;
  activeGlow?: "green" | "red";
}

export default function DiscardZone({ discardPile, wildRank, isActive, onClick, activeGlow }: DiscardZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "discard-pile",
    data: { type: "discard" },
    disabled: !isActive,
  });

  const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

  return (
    <div className="relative text-center">
      <p className="text-muted-foreground mb-1 text-xs font-semibold">Discard</p>
      <div className="relative inline-flex">
        <div
          ref={setNodeRef}
          onClick={onClick}
          className={`flex min-w-14 min-h-20 items-center justify-center rounded-lg border-2 transition-all duration-150 ${
            isActive ? "opacity-100" : "opacity-40"
          } ${
            isActive && onClick ? "cursor-pointer" : ""
          } ${
            discardPile.length === 0 && !isOver
              ? "border-dashed border-border bg-muted/30"
              : isOver
                ? "border-red-500 bg-red-500/10"
                : "border-border bg-muted/30"
          }`}
        >
        {isActive && discardPile.length === 0 && !isOver && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        )}
        {topCard && (
          <AnimatedCard
            rank={topCard.rank}
            suit={topCard.suit}
            wild={topCard.rank === wildRank}
            layoutId={`card-${topCard.rank}-${topCard.suit}`}
            glow={activeGlow}
          />
        )}
      </div>
      </div>
    </div>
  );
}
