interface CardProps {
  rank?: number;
  suit?: number;
  faceDown?: boolean;
  selected?: boolean;
  wild?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
const SUIT_COLORS = ["#000", "#d00", "#d00", "#000"];
const RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export default function Card({ rank, suit, faceDown, selected, wild, onClick, disabled }: CardProps) {
  const isClickable = !!onClick;
  const handleClick = () => {
    if (disabled) return;
    onClick?.();
  };

  if (faceDown) {
    return (
      <div
        onClick={handleClick}
        style={{
          width: 56,
          height: 80,
          border: "2px solid #333",
          borderRadius: 6,
          background: "repeating-linear-gradient(45deg, #1a3a8a, #1a3a8a 6px, #2244aa 6px, #2244aa 12px)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isClickable ? "pointer" : "default",
          opacity: disabled ? 0.5 : 1,
          transition: "opacity 0.2s, box-shadow 0.2s",
          ...(selected ? { boxShadow: "0 0 0 3px #ff0" } : {}),
        }}
        onMouseEnter={(e) => {
          if (isClickable && !disabled) {
            e.currentTarget.style.boxShadow = "0 0 0 3px #4a90d9";
          }
        }}
        onMouseLeave={(e) => {
          if (isClickable && !disabled) {
            e.currentTarget.style.boxShadow = selected ? "0 0 0 3px #ff0" : "none";
          }
        }}
      >
        <span style={{ color: "#fff", fontSize: 24 }}>?</span>
      </div>
    );
  }

  const suitSymbol = suit !== undefined ? SUIT_SYMBOLS[suit] ?? "?" : "?";
  const color = suit !== undefined ? SUIT_COLORS[suit] ?? "#000" : "#000";
  const rankName = rank !== undefined ? RANK_NAMES[rank] ?? "?" : "?";

  return (
    <div
      onClick={handleClick}
      style={{
        width: 56,
        height: 80,
        border: `2px solid ${selected ? "#ff0" : "#999"}`,
        borderRadius: 6,
        background: wild ? "#ffe" : "#fff",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: isClickable ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
        position: "relative",
        transition: "opacity 0.2s, box-shadow 0.2s, transform 0.15s",
        ...(selected ? { boxShadow: "0 0 0 3px #ff0" } : {}),
      }}
      onMouseEnter={(e) => {
        if (isClickable && !disabled) {
          e.currentTarget.style.boxShadow = "0 0 0 3px #4a90d9";
          e.currentTarget.style.transform = "translateY(-4px)";
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable && !disabled) {
          e.currentTarget.style.boxShadow = selected ? "0 0 0 3px #ff0" : "none";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      <span style={{ color, fontSize: 18, fontWeight: "bold", lineHeight: 1 }}>
        {rankName}
      </span>
      <span style={{ color, fontSize: 22, lineHeight: 1 }}>
        {suitSymbol}
      </span>
      {wild && (
        <span
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            background: "#f80",
            color: "#fff",
            borderRadius: 8,
            fontSize: 10,
            padding: "1px 5px",
            fontWeight: "bold",
            lineHeight: "16px",
          }}
        >
          W
        </span>
      )}
    </div>
  );
}
