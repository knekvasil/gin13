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
            isOver
              ? "border-red-500 bg-red-500/10"
              : "border-border bg-muted/30"
          }`}
        >
        {isActive && discardPile.length === 0 && !isOver && (
          <span className="text-muted-foreground text-[11px]">Drop to discard</span>
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
