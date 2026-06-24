const SUIT_SYMBOLS = ["\u2660", "\u2665", "\u2666", "\u2663"];
const RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface ScatterCard {
  rank: number;
  suit: number;
  wild: boolean;
  faceDown: boolean;
  top: string;
  left: string;
  rotate: number;
  z: number;
}

const CARDS: ScatterCard[] = [
  { rank: 1, suit: 0, wild: true, faceDown: false, top: "2%", left: "2%", rotate: -15, z: 0 },
  { rank: 13, suit: 3, wild: false, faceDown: false, top: "6%", left: "10%", rotate: 5, z: 2 },
  { rank: 7, suit: 1, wild: false, faceDown: true, top: "10%", left: "0%", rotate: -8, z: 3 },
  { rank: 5, suit: 1, wild: true, faceDown: false, top: "1%", left: "19%", rotate: 20, z: 0 },

  { rank: 4, suit: 2, wild: false, faceDown: false, top: "16%", left: "90%", rotate: 12, z: 1 },
  { rank: 10, suit: 3, wild: false, faceDown: true, top: "8%", left: "84%", rotate: -10, z: 2 },
  { rank: 11, suit: 0, wild: true, faceDown: false, top: "22%", left: "94%", rotate: -20, z: 0 },

  { rank: 9, suit: 2, wild: false, faceDown: true, top: "40%", left: "-10px", rotate: 8, z: 1 },
  { rank: 3, suit: 3, wild: false, faceDown: false, top: "48%", left: "1%", rotate: -20, z: 2 },
  { rank: 2, suit: 1, wild: true, faceDown: false, top: "44%", left: "11%", rotate: 25, z: 0 },

  { rank: 6, suit: 1, wild: false, faceDown: false, top: "50%", left: "88%", rotate: -15, z: 2 },
  { rank: 8, suit: 2, wild: true, faceDown: false, top: "56%", left: "77%", rotate: 8, z: 0 },
  { rank: 2, suit: 2, wild: false, faceDown: true, top: "62%", left: "95%", rotate: -5, z: 1 },

  { rank: 12, suit: 1, wild: false, faceDown: false, top: "72%", left: "0%", rotate: 15, z: 1 },
  { rank: 5, suit: 0, wild: false, faceDown: true, top: "80%", left: "11%", rotate: -12, z: 3 },
  { rank: 7, suit: 2, wild: true, faceDown: false, top: "76%", left: "5%", rotate: 30, z: 0 },

  { rank: 4, suit: 3, wild: false, faceDown: false, top: "82%", left: "90%", rotate: 18, z: 1 },
  { rank: 12, suit: 2, wild: false, faceDown: true, top: "88%", left: "79%", rotate: -22, z: 2 },
  { rank: 3, suit: 0, wild: true, faceDown: false, top: "86%", left: "97%", rotate: 5, z: 0 },
];

function suitColor(suit: number) {
  return suit === 0 || suit === 3 ? "text-foreground" : "text-red-500 dark:text-red-400";
}

export default function CardScatter() {
  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {CARDS.map((card, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: card.top,
            left: card.left,
            transform: `rotate(${card.rotate}deg)`,
            zIndex: card.z,
          }}
        >
          {card.faceDown ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-blue-900 w-12 h-[68px] shadow-sm">
              <span className="text-white text-base font-bold">?</span>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center rounded-lg border-2 border-border w-12 h-[68px] shadow-sm relative ${card.wild ? "bg-amber-50 dark:bg-amber-950/30" : "bg-card"}`}>
              <span className={`${suitColor(card.suit)} text-sm font-bold leading-none`}>
                {RANK_NAMES[card.rank]}
              </span>
              <span className={`${suitColor(card.suit)} text-base leading-none`}>
                {SUIT_SYMBOLS[card.suit]}
              </span>
              {card.wild && (
                <span className="absolute -top-1 -right-1 rounded-full bg-orange-500 px-1 py-0.5 text-[6px] font-bold leading-none text-white shadow-sm">
                  W
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
