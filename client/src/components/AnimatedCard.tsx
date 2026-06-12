import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { SUIT_SYMBOLS, RANK_NAMES } from "../lib/card-utils";
import { cn } from "../lib/utils";

interface AnimatedCardProps {
  rank?: number;
  suit?: number;
  faceDown?: boolean;
  small?: boolean;
  wild?: boolean;
  layoutId?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  dragId?: string;
  dragData?: Record<string, unknown>;
  style?: React.CSSProperties;
}

function FaceDownCard({
  small,
  selected,
  onClick,
  disabled,
  isDragging,
  layoutId,
  style,
}: {
  small?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  isDragging: boolean;
  layoutId?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      layoutId={layoutId}
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-md border-2 border-border",
        small ? "w-10 h-14" : "w-14 h-20",
        "bg-blue-900",
        disabled ? "opacity-50" : isDragging ? "opacity-0" : "opacity-100",
        selected && "ring-2 ring-yellow-400",
        onClick && "cursor-pointer",
        onClick && !disabled && "hover:ring-2 hover:ring-primary",
      )}
      style={style}
      whileHover={onClick && !disabled ? { y: -4 } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <span className={cn("text-white font-bold", small ? "text-base" : "text-2xl")}>?</span>
    </motion.div>
  );
}

const suitTextColor = (suit: number | undefined) => {
  if (suit === undefined) return "";
  return suit === 0 || suit === 3 ? "text-foreground" : "text-red-500 dark:text-red-400";
};

export default function AnimatedCard({
  rank,
  suit,
  faceDown,
  small,
  wild,
  layoutId,
  onClick,
  disabled,
  selected,
  dragId,
  dragData,
  style,
}: AnimatedCardProps) {
  const isClickable = !!onClick;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId ?? "",
    data: dragData,
    disabled: !dragId,
  });

  if (faceDown) {
    return (
      <FaceDownCard
        small={small}
        selected={selected}
        onClick={onClick}
        disabled={disabled}
        isDragging={isDragging}
        layoutId={layoutId}
        style={style}
      />
    );
  }

  const suitSymbol = suit !== undefined ? SUIT_SYMBOLS[suit] ?? "?" : "?";
  const rankName = rank !== undefined ? RANK_NAMES[rank] ?? "?" : "?";

  const isDraggable = !!dragId;

  return (
    <motion.div
      ref={isDraggable ? setNodeRef : undefined}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      layoutId={layoutId}
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 flex-col items-center justify-center rounded-md border-2",
        small ? "w-10 h-14" : "w-14 h-20",
        wild ? "bg-amber-50 dark:bg-amber-950/30" : "bg-card",
        selected
          ? "border-yellow-400 ring-2 ring-yellow-400"
          : "border-border",
        disabled ? "opacity-50" : isDragging ? "opacity-0" : "opacity-100",
        (isClickable || isDraggable) && "cursor-grab active:cursor-grabbing",
        (isClickable || isDraggable) && !disabled && "hover:ring-2 hover:ring-primary",
      )}
      style={style}
      whileHover={!disabled ? { y: -4 } : undefined}
      whileTap={!disabled ? { cursor: "grabbing" } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <span className={cn("font-bold leading-none", suitTextColor(suit), small ? "text-sm" : "text-lg")}>
        {rankName}
      </span>
      <span className={cn("leading-none", suitTextColor(suit), small ? "text-base" : "text-xl")}>
        {suitSymbol}
      </span>
      {wild && (
        <span className="absolute -top-1 -right-1 rounded-full bg-orange-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white">
          W
        </span>
      )}
    </motion.div>
  );
}
