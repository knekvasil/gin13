import { motion, AnimatePresence } from "framer-motion";
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
  badge?: string | number;
  glow?: "green" | "red";
}

function FaceDownCard({
  small,
  selected,
  onClick,
  disabled,
  isDragging,
  layoutId,
  style,
  badge,
  glow,
}: {
  small?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  isDragging: boolean;
  layoutId?: string;
  style?: React.CSSProperties;
  badge?: string | number;
  glow?: "green" | "red";
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
        onClick && "hover:ring-2 hover:ring-primary",
      )}
      style={style}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {glow && <span className={cn("absolute inset-0 rounded-md ring-2 pointer-events-none", glow === "green" ? "ring-green-500/60 animate-pulse" : "ring-red-500/60 animate-pulse")} />}
      <span className={cn("text-white font-bold", small ? "text-base" : "text-2xl")}>?</span>
      <AnimatePresence mode="popLayout">
        {badge != null && (
          <motion.span
            key={badge}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute bottom-1 right-1 rounded bg-card/80 px-0.5 text-[8px] font-semibold tabular-nums text-foreground"
          >
            {badge}
          </motion.span>
        )}
      </AnimatePresence>
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
  badge,
  glow,
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
        badge={badge}
        glow={glow}
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
        faceDown ? "" : (isClickable || isDraggable) && "hover:ring-2 hover:ring-primary",
        )}
        style={style}
        whileHover={{ y: -4 }}
        whileTap={!disabled ? { cursor: "grabbing" } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {glow && <span className={cn("absolute inset-0 rounded-md ring-2 pointer-events-none", glow === "green" ? "ring-green-500/60 animate-pulse" : "ring-red-500/60 animate-pulse")} />}
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
      <AnimatePresence mode="popLayout">
        {badge != null && (
          <motion.span
            key={badge}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute bottom-1 right-1 rounded bg-card/80 px-0.5 text-[8px] font-semibold tabular-nums text-foreground"
          >
            {badge}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
