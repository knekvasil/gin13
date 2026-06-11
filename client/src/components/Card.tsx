interface CardProps {
  rank?: number;
  suit?: number;
  faceDown?: boolean;
  selected?: boolean;
  wild?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  disabled?: boolean;
  small?: boolean;
  draggable?: boolean;
  count?: number;
}

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
const RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function isRed(suit: number): boolean {
  return suit === 1 || suit === 2;
}

export default function Card({ rank, suit, faceDown, selected, wild, onClick, onDragStart, disabled, small, draggable, count }: CardProps) {
  const isClickable = !!onClick;
  const w = small ? 40 : 56;
  const h = small ? 60 : 80;

  if (faceDown) {
    return (
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onClick={onClick}
        className={`
          inline-flex items-center justify-center rounded-lg select-none relative
          transition-all duration-150
          ${disabled ? "opacity-50" : ""}
          ${isClickable && !disabled ? "cursor-pointer hover:shadow-lg hover:-translate-y-1" : "cursor-default"}
          ${selected ? "ring-3 ring-yellow-400" : ""}
          bg-gradient-to-br from-blue-700 to-blue-900
          dark:from-blue-800 dark:to-blue-950
        `}
        style={{ width: w, height: h }}
      >
        <span className="text-white text-xl font-bold">?</span>
        {count !== undefined && (
          <span className="absolute bottom-0.5 right-1 text-[10px] text-blue-300 dark:text-blue-400 font-medium leading-none">
            {count}
          </span>
        )}
      </div>
    );
  }

  const suitSymbol = suit !== undefined ? SUIT_SYMBOLS[suit] ?? "?" : "?";
  const rankName = rank !== undefined ? RANK_NAMES[rank] ?? "?" : "?";
  const red = suit !== undefined && isRed(suit);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`
        inline-flex flex-col items-center justify-center rounded-lg select-none relative
        transition-all duration-150
        ${disabled ? "opacity-50" : ""}
        ${isClickable && !disabled ? "cursor-pointer hover:shadow-lg hover:-translate-y-1" : "cursor-default"}
        ${selected ? "ring-3 ring-yellow-400" : "shadow-sm"}
        ${wild
          ? "bg-amber-50 dark:bg-amber-950 border-2 border-amber-400"
          : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
        }
      `}
      style={{ width: w, height: h }}
    >
      <span className={`text-lg font-bold leading-none ${red ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
        {rankName}
      </span>
      <span className={`text-xl leading-none mt-0.5 ${red ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
        {suitSymbol}
      </span>
      {wild && (
        <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          W
        </span>
      )}
    </div>
  );
}
