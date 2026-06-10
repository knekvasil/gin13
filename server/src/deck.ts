import type { Card, Suit, Rank } from "./types";

const SUITS: Suit[] = [0, 1, 2, 3];
const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(
  deck: Card[],
  cardsPerPlayer: number,
  playerCount: number,
): { hands: Card[][]; remainingDeck: Card[] } {
  const total = cardsPerPlayer * playerCount;
  if (deck.length < total) {
    throw new Error("Insufficient cards");
  }

  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < total; i++) {
    hands[i % playerCount].push(deck[i]);
  }
  const remainingDeck = deck.slice(total);

  return { hands, remainingDeck };
}
