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
  const hasCards = cards.length > 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Action buttons above the box */}
      {hasCards && (
        <div className="flex gap-1.5">
          {valid && (
            <button
              onClick={onPlay}
              className="cursor-pointer rounded-md bg-green-600 p-1 text-white hover:bg-green-700"
              title="Play Meld"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          )}
          <button
            onClick={onClear}
            className="text-muted-foreground cursor-pointer rounded-md border border-border bg-transparent p-1 hover:bg-muted"
            title="Clear staging"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex min-w-14 min-h-20 items-center justify-center rounded-lg border-2 px-2 text-[11px] transition-all duration-150 ${
          hasCards
            ? valid || isOver
              ? "border-green-500 bg-green-500/10 gap-1 px-2.5 py-1.5"
              : "border-border bg-muted/30 gap-1 px-2.5 py-1.5"
            : isOver
              ? "border-green-500 bg-green-500/15 border-dashed"
              : "border-dashed border-border bg-muted/30"
        }`}
      >
        {hasCards ? (
          cards.map((card, i) => (
            <AnimatedCard
              key={i}
              rank={card.rank}
              suit={card.suit}
              wild={card.rank === wildRank}
              layoutId={`card-${card.rank}-${card.suit}`}
              dragId={`staging-${i}`}
              dragData={{ type: "staging", stagingIndex: i, rank: card.rank, suit: card.suit }}
            />
          ))
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <polyline points="8 12 12 16 16 12" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
