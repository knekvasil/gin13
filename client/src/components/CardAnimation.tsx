import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedCard from "./AnimatedCard";

interface CardDef {
  rank: number;
  suit: number;
}

interface MeldScene {
  cards: CardDef[];
}

const SCENES: MeldScene[] = [
  { cards: [
    { rank: 5, suit: 0 },
    { rank: 5, suit: 1 },
    { rank: 5, suit: 2 },
  ]},
  { cards: [
    { rank: 8, suit: 0 },
    { rank: 8, suit: 1 },
    { rank: 8, suit: 2 },
    { rank: 8, suit: 3 },
  ]},
  { cards: [
    { rank: 6, suit: 0 },
    { rank: 7, suit: 0 },
    { rank: 8, suit: 0 },
    { rank: 9, suit: 0 },
  ]},
  { cards: [
    { rank: 3, suit: 0 },
    { rank: 4, suit: 0 },
    { rank: 1, suit: 1 },
    { rank: 6, suit: 0 },
  ]},
  { cards: [
    { rank: 10, suit: 2 },
    { rank: 11, suit: 2 },
    { rank: 12, suit: 2 },
    { rank: 13, suit: 2 },
  ]},
];

export default function CardAnimation() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [phase, setPhase] = useState<"show" | "exit">("show");

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase("exit");
      setTimeout(() => {
        setSceneIdx((prev) => (prev + 1) % SCENES.length);
        setPhase("show");
      }, 400);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const scene = SCENES[sceneIdx]!;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center h-28">
        <AnimatePresence mode="popLayout">
          {phase === "show" && scene.cards.map((card, i) => (
            <motion.div
              key={`${card.rank}-${card.suit}`}
              initial={{ opacity: 0, y: -30, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.6 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
                delay: i * 0.08,
              }}
              className="absolute"
              style={{
                left: `calc(50% + ${(i - scene.cards.length / 2) * 56}px)`,
              }}
            >
              <AnimatedCard
                rank={card.rank}
                suit={card.suit}
                wild={card.rank === 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
