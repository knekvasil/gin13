import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { SUIT_SYMBOLS, SUIT_COLORS, RANK_NAMES } from "../lib/card-utils";

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
  const w = small ? 40 : 56;
  const h = small ? 56 : 80;
  const isClickable = !!onClick;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId ?? "",
    data: dragData,
    disabled: !dragId,
  });

  const cursor = dragId ? "grab" : isClickable ? "pointer" : "default";

  if (faceDown) {
    return (
      <motion.div
        layoutId={layoutId}
        onClick={onClick}
        style={{
          width: w,
          height: h,
          border: "2px solid #333",
          borderRadius: 6,
          background: "repeating-linear-gradient(45deg, #1a3a8a, #1a3a8a 6px, #2244aa 6px, #2244aa 12px)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isClickable ? "pointer" : "default",
          opacity: disabled ? 0.5 : isDragging ? 0 : 1,
          position: "relative",
          flexShrink: 0,
          ...(selected ? { boxShadow: "0 0 0 3px #ff0" } : {}),
          ...style,
        }}
        whileHover={isClickable && !disabled ? { boxShadow: "0 0 0 3px #4a90d9" } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <span style={{ color: "#fff", fontSize: small ? 16 : 24 }}>?</span>
      </motion.div>
    );
  }

  const suitSymbol = suit !== undefined ? SUIT_SYMBOLS[suit] ?? "?" : "?";
  const color = suit !== undefined ? SUIT_COLORS[suit] ?? "#000" : "#000";
  const rankName = rank !== undefined ? RANK_NAMES[rank] ?? "?" : "?";

  const cardStyle: React.CSSProperties = {
    width: w,
    height: h,
    border: `2px solid ${selected ? "#ff0" : "#999"}`,
    borderRadius: 6,
    background: wild ? "#ffe" : "#fff",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor,
    opacity: disabled ? 0.5 : isDragging ? 0 : 1,
    position: "relative",
    flexShrink: 0,
    ...(selected ? { boxShadow: "0 0 0 3px #ff0" } : {}),
    ...style,
  };

  return (
    <motion.div
      ref={dragId ? setNodeRef : undefined}
      {...(dragId ? { ...attributes, ...listeners } : {})}
      layoutId={layoutId}
      onClick={onClick}
      style={cardStyle}
      whileHover={
        dragId
          ? { boxShadow: "0 0 0 3px #4a90d9", y: -4 }
          : isClickable && !disabled
          ? { boxShadow: "0 0 0 3px #4a90d9", y: -4 }
          : undefined
      }
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <span style={{ color, fontSize: small ? 14 : 18, fontWeight: "bold", lineHeight: 1 }}>
        {rankName}
      </span>
      <span style={{ color, fontSize: small ? 16 : 22, lineHeight: 1 }}>
        {suitSymbol}
      </span>
      {wild && (
        <span
          style={{
            position: "absolute",
            top: small ? -4 : -6,
            right: small ? -4 : -6,
            background: "#f80",
            color: "#fff",
            borderRadius: 8,
            fontSize: small ? 8 : 10,
            padding: "1px 4px",
            fontWeight: "bold",
            lineHeight: small ? "12px" : "16px",
          }}
        >
          W
        </span>
      )}
    </motion.div>
  );
}
