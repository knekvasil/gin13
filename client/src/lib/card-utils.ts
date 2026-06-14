export const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
export const SUIT_COLORS = ["#000", "#d00", "#d00", "#000"];
export const RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function isWild(card: { rank: number }, wildRank: number): boolean {
  return card.rank === wildRank;
}

export function isValidSet(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length > 4 || cards.length < 3) return false;
  if (cards.every((c) => isWild(c, wildRank))) return true;
  let setRank: number | null = null;
  const suits = new Set<number>();
  for (const c of cards) {
    if (isWild(c, wildRank)) continue;
    if (setRank === null) setRank = c.rank;
    else if (c.rank !== setRank) return false;
    if (suits.has(c.suit)) return false;
    suits.add(c.suit);
  }
  if (setRank === null) return false;
  const wildCount = cards.filter((c) => isWild(c, wildRank)).length;
  return suits.size === cards.length - wildCount;
}

export function isValidStraightFlush(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length < 4) return false;
  let suit: number | null = null;
  const nonWild: number[] = [];
  let wildCount = 0;
  for (const c of cards) {
    if (isWild(c, wildRank)) { wildCount++; continue; }
    if (suit === null) suit = c.suit;
    else if (c.suit !== suit) return false;
    nonWild.push(c.rank);
  }
  if (suit === null) return false;
  const unique = new Set(nonWild);
  if (unique.size !== nonWild.length) return false;
  nonWild.sort((a, b) => a - b);
  const min = nonWild[0]!, max = nonWild[nonWild.length - 1]!;
  if (max - min >= 12) return false;
  return max - min + 1 - nonWild.length <= wildCount;
}

export function canMeldCards(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length < 3) return false;
  return isValidSet(cards, wildRank) || isValidStraightFlush(cards, wildRank);
}

export function isValidOrderedStraightFlush(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length < 4) return false;

  let suit: number | null = null;
  let firstNonWildIdx = -1;
  let firstNonWildRank = 0;

  for (let i = 0; i < cards.length; i++) {
    if (isWild(cards[i], wildRank)) continue;
    if (suit === null) suit = cards[i].suit;
    else if (cards[i].suit !== suit) return false;
    if (firstNonWildIdx === -1) {
      firstNonWildIdx = i;
      firstNonWildRank = cards[i].rank;
    }
    const expected = firstNonWildRank + (i - firstNonWildIdx);
    if (cards[i].rank !== expected) return false;
  }

  if (suit === null) return false;
  if (firstNonWildRank - firstNonWildIdx < 1) return false;
  return true;
}

export function canMeldCardsOrdered(cards: { rank: number; suit: number }[], wildRank: number): boolean {
  if (cards.length < 3) return false;
  if (isValidSet(cards, wildRank)) return true;
  return isValidOrderedStraightFlush(cards, wildRank);
}

export function cardId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
