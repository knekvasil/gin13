import { useDroppable } from "@dnd-kit/core";
import AnimatedCard from "./AnimatedCard";

interface CardData {
  rank: number;
  suit: number;
  meldGroupId: string;
}

function WildCardSlot({ meldGroupId, wildIndex, children }: { meldGroupId: string; wildIndex: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `wild-${meldGroupId}-${wildIndex}`,
    data: { type: "wild-card", meldGroupId },
  });
  return (
    <div ref={setNodeRef} className="relative">
      {children}
      {isOver && (
        <div className="pointer-events-none absolute inset-0 rounded-md border-2 border-dashed border-orange-500 bg-orange-500/15" />
      )}
    </div>
  );
}

interface MeldGroupProps {
  meldGroupId: string;
  cards: CardData[];
  wildRank: number;
  isOwn: boolean;
  isActive: boolean;
}

export default function MeldGroup({ meldGroupId, cards, wildRank, isOwn, isActive }: MeldGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `meld-group-${meldGroupId}`,
    data: { type: "meld-group", meldGroupId },
    disabled: !isActive,
  });

  const nonWild = cards.filter((c) => c.rank !== wildRank);
  const wilds = cards.filter((c) => c.rank === wildRank);
  const sorted = nonWild.length >= 2 && new Set(nonWild.map((c) => c.rank)).size > 1
    ? [...cards].sort((a, b) => a.rank - b.rank)
    : [...nonWild, ...wilds];

  let wildCount = 0;

  return (
    <div
      ref={setNodeRef}
      className={`flex gap-0.5 rounded-md p-1 transition-colors duration-150 ${
        isOver ? "bg-green-500/10 outline-2 outline-green-500" : ""
      }`}
    >
      {sorted.map((card, ci) => {
        const isWild = card.rank === wildRank;
        if (isWild) wildCount++;
        const cardEl = (
          <AnimatedCard
            rank={card.rank}
            suit={card.suit}
            wild={isWild}
            small
            layoutId={`card-${card.rank}-${card.suit}`}
          />
        );

        if (isWild && isActive) {
          return (
            <WildCardSlot key={ci} meldGroupId={meldGroupId} wildIndex={wildCount - 1}>
              {cardEl}
            </WildCardSlot>
          );
        }
        return <div key={ci}>{cardEl}</div>;
      })}
    </div>
  );
}
