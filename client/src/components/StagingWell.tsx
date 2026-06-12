import { useDroppable } from "@dnd-kit/core";
import AnimatedCard from "./AnimatedCard";
import { canMeldCards } from "../lib/card-utils";

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
        className={`flex min-w-14 min-h-20 items-center justify-center rounded-lg border-2 border-dashed px-2 text-[11px] text-muted-foreground transition-all duration-150 ${
          isOver ? "border-green-500 bg-green-500/15" : "border-border bg-muted/30"
        }`}
      >
        Drop cards here to meld
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1 rounded-lg border-2 px-2.5 py-1.5 transition-all duration-150 ${
        valid || isOver
          ? "border-green-500 bg-green-500/10"
          : "border-border bg-muted/30"
      }`}
    >
      {cards.map((card, i) => (
        <AnimatedCard
          key={i}
          rank={card.rank}
          suit={card.suit}
          wild={card.rank === wildRank}
          layoutId={`card-${card.rank}-${card.suit}`}
          dragId={`staging-${i}`}
          dragData={{ type: "staging", stagingIndex: i, rank: card.rank, suit: card.suit }}
        />
      ))}
      {valid && (
        <button
          onClick={onPlay}
          className="ml-2 cursor-pointer rounded-md bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white whitespace-nowrap hover:bg-green-700"
        >
          Play Meld
        </button>
      )}
      <button
        onClick={onClear}
        className="text-muted-foreground ml-1 cursor-pointer rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs hover:bg-muted"
        title="Clear staging"
      >
        ✕
      </button>
    </div>
  );
}
