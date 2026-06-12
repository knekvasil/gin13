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
    <div ref={setNodeRef} style={{ position: "relative" }}>
      {children}
      {isOver && (
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 6,
            border: "2px dashed #f80",
            background: "rgba(255, 136, 0, 0.15)",
            pointerEvents: "none",
          }}
        />
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
      style={{
        display: "flex",
        gap: 2,
        padding: 4,
        borderRadius: 6,
        outline: isOver ? "2px solid #4caf50" : undefined,
        background: isOver ? "rgba(76, 175, 80, 0.1)" : undefined,
        transition: "background 0.15s",
      }}
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
