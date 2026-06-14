import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, X } from "lucide-react";
import AnimatedCard from "../components/AnimatedCard";
import MeldGroup from "../components/MeldGroup";
import { canMeldCardsOrdered, RANK_NAMES } from "../lib/card-utils";

interface TutorialCard {
  rank: number;
  suit: number;
}

interface Step {
  desc: string;
  cards?: TutorialCard[];
  meldCards?: { rank: number; suit: number; meldGroupId: string }[];
  wildRank?: number;
  valid?: boolean | null;
  showRoundTable?: boolean;
  showScoring?: { label: string; score: number | string }[];
}

function CardFan({ cards, wildRank, small = true }: { cards: TutorialCard[]; wildRank?: number; small?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <AnimatePresence mode="popLayout">
        {cards.map((c, i) => (
          <motion.div
            key={`${c.rank}-${c.suit}`}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.05 }}
          >
            <AnimatedCard
              rank={c.rank}
              suit={c.suit}
              wild={wildRank != null && c.rank === wildRank}
              small={small}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ValidationBadge({ valid }: { valid: boolean }) {
  if (valid) {
    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-500"
      >
        <Check className="size-3" />
        Valid
      </motion.span>
    );
  }
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-500"
    >
      <X className="size-3" />
      Invalid
    </motion.span>
  );
}

function TutorialSection({ title, steps, id }: { title: string; steps: Step[]; id: string }) {
  const [step, setStep] = useState(0);
  const s = steps[step]!;

  let validationResult: boolean | null = null;
  if (s.cards && s.cards.length > 0 && s.valid !== undefined) {
    if (s.cards.length >= 3) {
      validationResult = canMeldCardsOrdered(s.cards, s.wildRank ?? 1);
    } else {
      validationResult = null;
    }
  }

  return (
    <section id={id} className="scroll-mt-20 rounded-lg border p-4 sm:p-6">
      <h2 className="text-foreground mb-2 text-lg font-semibold">{title}</h2>

      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="text-muted-foreground mb-4 text-sm leading-relaxed"
        >
          {s.desc}
        </motion.p>
      </AnimatePresence>

      {s.cards && s.cards.length > 0 && (
        <div className="mb-3">
          <CardFan cards={s.cards} wildRank={s.wildRank} />
          {s.valid !== undefined && (
            <div className="mt-2 flex justify-center">
              <ValidationBadge valid={validationResult ?? false} />
            </div>
          )}
        </div>
      )}

      {s.meldCards && (
        <div className="mb-3 flex justify-center">
          <MeldGroup
            meldGroupId="demo"
            cards={s.meldCards}
            wildRank={s.wildRank ?? 1}
            isOwn={false}
            isActive={false}
          />
        </div>
      )}

      {s.showRoundTable && (
        <div className="mb-3 overflow-x-auto">
          <table className="mx-auto border-collapse text-xs">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-1 text-left font-medium">Round</th>
                {Array.from({ length: 13 }, (_, i) => (
                  <th key={i} className="px-1.5 py-1 text-center font-medium tabular-nums">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-border/50 border-b">
                <td className="px-2 py-1 font-medium">Wild</td>
                {Array.from({ length: 13 }, (_, i) => (
                  <td key={i} className="px-1.5 py-1 text-center tabular-nums">{RANK_NAMES[(i % 13) + 1]}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {s.showScoring && (
        <div className="mb-3 overflow-x-auto">
          <table className="mx-auto border-collapse text-xs">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-1 text-left font-medium">Card</th>
                <th className="px-2 py-1 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {s.showScoring.map((row, i) => (
                <tr key={i} className="border-border/50 border-b">
                  <td className="px-2 py-1">{row.label}</td>
                  <td className="px-2 py-1 text-right font-bold tabular-nums">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          Step {step + 1} of {steps.length}
        </span>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="hover:bg-accent inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <ChevronLeft className="size-3" />
              Back
            </button>
          )}
          {step < steps.length - 1 && (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Next
              <ChevronRight className="size-3" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const SECTIONS: { title: string; id: string; steps: Step[] }[] = [
  {
    title: "The Goal",
    id: "goal",
    steps: [
      {
        desc: "Gin 13 is played over 13 rounds. Your goal is to have the lowest cumulative score at the end. Each round, one player \"goes out\" by emptying their hand and scores 0. Everyone else scores the sum of cards remaining in their hand.",
      },
      {
        desc: "After 13 rounds, the player with the lowest total score wins. A new wild rank is introduced each round, changing which cards are wild.",
      },
    ],
  },
  {
    title: "Card Values",
    id: "card-values",
    steps: [
      {
        desc: "Each non-wild card is worth its rank value. Wild cards are worth 25 points — they're expensive to hold!",
        showScoring: [
          { label: "A", score: 10 },
          { label: "2 – 10", score: "rank value (2–10)" },
          { label: "J, Q, K", score: 10 },
          { label: "Wild", score: 25 },
        ],
      },
      {
        desc: "For example, if a player goes out and you have these cards in hand:",
        cards: [
          { rank: 5, suit: 0 },
          { rank: 7, suit: 1 },
          { rank: 10, suit: 2 },
        ],
        wildRank: 1,
      },
      {
        desc: "Your hand score is 5 + 7 + 10 = 22 points added to your cumulative total.",
      },
      {
        desc: "If you hold wild cards, they cost 25 points each. These three wilds would add 75 points to your score!",
        cards: [
          { rank: 1, suit: 0 },
          { rank: 1, suit: 1 },
          { rank: 1, suit: 2 },
        ],
        wildRank: 1,
      },
    ],
  },
  {
    title: "Wild Progression",
    id: "wilds",
    steps: [
      {
        desc: "Each round has a designated wild rank. Across the 13 rounds, the wild rank ascends sequentially: round 1 = A, round 2 = 2, ..., round 13 = K.",
        showRoundTable: true,
      },
      {
        desc: "A wild card can substitute for any card in a meld. For example, in round 1 (Aces are wild), this A can represent any rank:",
        cards: [
          { rank: 1, suit: 0 },
          { rank: 5, suit: 1 },
          { rank: 5, suit: 2 },
        ],
        wildRank: 1,
        valid: true,
      },
    ],
  },
  {
    title: "Sets",
    id: "sets",
    steps: [
      {
        desc: "A set is 3 or 4 cards of the same rank, each in a different suit. This is a valid set of 5s:",
        cards: [
          { rank: 5, suit: 0 },
          { rank: 5, suit: 1 },
          { rank: 5, suit: 2 },
        ],
        wildRank: 1,
        valid: true,
      },
      {
        desc: "You can also create a 4-of-a-kind using all four suits:",
        cards: [
          { rank: 7, suit: 0 },
          { rank: 7, suit: 1 },
          { rank: 7, suit: 2 },
          { rank: 7, suit: 3 },
        ],
        wildRank: 1,
        valid: true,
      },
      {
        desc: "Wild cards can substitute for missing suits. Here a wild Ace fills in for the fourth suit:",
        cards: [
          { rank: 7, suit: 0 },
          { rank: 7, suit: 1 },
          { rank: 7, suit: 2 },
          { rank: 1, suit: 3 },
        ],
        wildRank: 1,
        valid: true,
      },
      {
        desc: "This is NOT a valid set — mixed ranks can't form a set:",
        cards: [
          { rank: 5, suit: 0 },
          { rank: 5, suit: 1 },
          { rank: 6, suit: 2 },
        ],
        wildRank: 1,
        valid: false,
      },
    ],
  },
  {
    title: "Straight Flushes",
    id: "straights",
    steps: [
      {
        desc: "A straight flush is 4 or more cards of the same suit in consecutive rank order. A is low (A, 2, 3, ...). Wrapping (Q, K, A, 2) is illegal.",
        cards: [
          { rank: 5, suit: 0 },
          { rank: 6, suit: 0 },
          { rank: 7, suit: 0 },
          { rank: 8, suit: 0 },
        ],
        wildRank: 1,
        valid: true,
      },
      {
        desc: "Wild cards can fill gaps. In round 1 (Aces wild), this Ace fills the gap between 8 and 10:",
        cards: [
          { rank: 8, suit: 0 },
          { rank: 9, suit: 0 },
          { rank: 1, suit: 0 },
          { rank: 11, suit: 0 },
        ],
        wildRank: 1,
        valid: true,
      },
      {
        desc: "Wilds must be in the correct position. The order determines what rank the wild represents. This wild at the wrong position breaks the sequence:",
        cards: [
          { rank: 11, suit: 0 },
          { rank: 8, suit: 0 },
          { rank: 9, suit: 0 },
          { rank: 1, suit: 0 },
        ],
        wildRank: 1,
        valid: false,
      },
      {
        desc: "Mixed suits are not a straight flush — all cards must share the same suit:",
        cards: [
          { rank: 5, suit: 0 },
          { rank: 6, suit: 1 },
          { rank: 7, suit: 0 },
          { rank: 8, suit: 2 },
        ],
        wildRank: 1,
        valid: false,
      },
    ],
  },
  {
    title: "Lay Down & Manipulate",
    id: "lay-down",
    steps: [
      {
        desc: "On your turn, you must play at least one meld from your hand onto the table before you can manipulate existing melds. This is called Laying Down.",
      },
      {
        desc: "Once you've laid down, you can Manipulate on subsequent turns: add cards from your hand to any existing meld, or swap a wild card out of a meld by replacing it with a card from your hand. The freed wild returns to your hand.",
      },
      {
        desc: "Example: adding a card to the end of a straight flush. The 9 extends this straight:",
        meldCards: [
          { rank: 5, suit: 0, meldGroupId: "demo" },
          { rank: 6, suit: 0, meldGroupId: "demo" },
          { rank: 7, suit: 0, meldGroupId: "demo" },
          { rank: 8, suit: 0, meldGroupId: "demo" },
          { rank: 9, suit: 0, meldGroupId: "demo" },
        ],
        wildRank: 1,
      },
    ],
  },
  {
    title: "Turn Flow",
    id: "turn",
    steps: [
      {
        desc: "Each turn follows the same sequence: Draw → Meld / Manipulate → Pass / Discard.",
      },
      {
        desc: "1. Draw: Take the top card from the draw deck or the discard pile. If the draw deck is empty, the discard pile (except its top card) is shuffled to form a new draw deck.",
      },
      {
        desc: "2. Meld / Manipulate: Play a new meld from your hand onto the table (Lay Down), or add cards to existing melds (Manipulate). You may also swap a wild from a meld with a card from your hand.",
      },
      {
        desc: "3. Pass or Discard: You may pass (skip melding) or discard one card from your hand to the discard pile. Your turn ends when you discard. If your hand is empty after discarding, you Go Out.",
      },
    ],
  },
  {
    title: "Going Out",
    id: "going-out",
    steps: [
      {
        desc: "When you empty your hand by melding and then discarding your last card, you Go Out. You score 0 for that round. All other players score the sum of cards remaining in their hands.",
      },
      {
        desc: "You can go out by laying down a fresh meld and discarding your last card, or by adding your last cards to existing melds and then discarding.",
      },
      {
        desc: "The player who goes out scores 0. Everyone else adds their hand score to their cumulative total. Example: Player A goes out (0), Player B has these cards worth 12 points:",
        cards: [
          { rank: 3, suit: 0 },
          { rank: 4, suit: 1 },
          { rank: 5, suit: 2 },
        ],
        wildRank: 1,
      },
    ],
  },
  {
    title: "Scoring",
    id: "scoring",
    steps: [
      {
        desc: "At round end, each player except the one who went out scores the sum of their remaining hand cards. Non-wild cards are worth their rank (A=10, 2-10=face value, J/Q/K=10). Wild cards are worth 25.",
      },
      {
        desc: "After 13 rounds, the player with the lowest cumulative total wins. The game rewards emptying your hand efficiently and minimizing the points you leave unmelded.",
      },
    ],
  },
];

export default function HowToPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          How to Play Gin 13
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A multi-round card game for 3–4 players. Draw, meld, and discard to
          minimize your hand score across 13 rounds.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="hover:bg-accent rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <TutorialSection key={s.id} title={s.title} steps={s.steps} id={s.id} />
        ))}
      </div>
    </div>
  );
}
