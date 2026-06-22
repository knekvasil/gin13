import {
  isWild as sharedIsWild,
  isValidSet,
  isValidStraightFlush,
  isOrderedStraightFlush,
  canMeld,
} from "@gin13/shared";

export const SUIT_SYMBOLS = ["\u2660", "\u2665", "\u2666", "\u2663"];
export const SUIT_COLORS = ["#000", "#d00", "#d00", "#000"];
export const RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const isWild = sharedIsWild;
export { isValidSet, isValidStraightFlush };
export const isValidOrderedStraightFlush = isOrderedStraightFlush;

export function canMeldCards(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): boolean {
  return canMeld(cards, wildRank);
}

export function canMeldCardsOrdered(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): boolean {
  if (cards.length < 3) return false;
  if (isValidSet(cards, wildRank)) return true;
  return isOrderedStraightFlush(cards, wildRank);
}

export function cardId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
