import { useDroppable } from "@dnd-kit/core";
import { isValidStraightFlush, isValidSet } from "../lib/card-utils";
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

function InsertSlot({ meldGroupId, position }: { meldGroupId: string; position: "start" | "end" }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `meld-group-${position}-${meldGroupId}`,
    data: { type: "meld-group", meldGroupId },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center transition-colors ${isOver ? "text-green-500" : "text-muted-foreground"}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
        {position === "start" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
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

  const isSet = isValidSet(cards, wildRank);
  const isStraight = !cards.every((c) => c.rank === wildRank) && isValidStraightFlush(cards, wildRank) && !isSet;

  let wildCount = 0;

  const cardElements = cards.map((card, ci) => {
    const isWild = card.rank === wildRank;
    if (isWild) wildCount++;
    const cardEl = (
      <AnimatedCard
        rank={card.rank}
        suit={card.suit}
        wild={isWild}
        small
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
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex gap-0.5 rounded-md p-1 transition-colors duration-150 ${
        isOver && !isStraight ? "bg-green-500/10 outline-2 outline-green-500" : ""
      }`}
    >
      {isStraight && isActive && <InsertSlot meldGroupId={meldGroupId} position="start" />}
      {cardElements}
      {isStraight && isActive && <InsertSlot meldGroupId={meldGroupId} position="end" />}
    </div>
  );
}
