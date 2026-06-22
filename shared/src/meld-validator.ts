export function isWild(card: { rank: number; suit?: number }, wildRank: number): boolean {
  return card.rank === wildRank;
}

export function canMeld(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): boolean {
  if (cards.length < 3) return false;
  return isValidSet(cards, wildRank) || isValidStraightFlush(cards, wildRank);
}

export function isValidSet(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): boolean {
  if (cards.length > 4) return false;
  if (cards.length < 3) return false;

  const allWilds = cards.every((c) => isWild(c, wildRank));
  if (allWilds) return true;

  let setRank: number | null = null;
  const suits = new Set<number>();
  let wildCount = 0;

  for (const card of cards) {
    if (isWild(card, wildRank)) {
      wildCount++;
      continue;
    }
    if (setRank === null) {
      setRank = card.rank;
    } else if (card.rank !== setRank) {
      return false;
    }
    if (suits.has(card.suit)) return false;
    suits.add(card.suit);
  }

  if (setRank === null) return false;

  const uniqueSuitsNeeded = cards.length - wildCount;
  return suits.size === uniqueSuitsNeeded;
}

export function isValidStraightFlush(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): boolean {
  if (cards.length < 4) return false;

  let suit: number | null = null;
  const nonWildRanks: number[] = [];
  let wildCount = 0;

  for (const card of cards) {
    if (isWild(card, wildRank)) {
      wildCount++;
      continue;
    }
    if (suit === null) {
      suit = card.suit;
    } else if (card.suit !== suit) {
      return false;
    }
    nonWildRanks.push(card.rank);
  }

  if (suit === null) return false;

  if (nonWildRanks.length === 0) return true;

  const uniqueRanks = new Set(nonWildRanks);
  if (uniqueRanks.size !== nonWildRanks.length) return false;

  nonWildRanks.sort((a, b) => a - b);
  const min = nonWildRanks[0]!;
  const max = nonWildRanks[nonWildRanks.length - 1]!;

  if (max - min >= 12) return false;

  const needed = max - min + 1 - nonWildRanks.length;
  return needed <= wildCount;
}

export function isOrderedStraightFlush(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): boolean {
  if (cards.length < 4) return false;
  let suit: number | null = null;
  let firstNonWildIdx = -1;
  let firstNonWildRank = 0;
  for (let i = 0; i < cards.length; i++) {
    if (isWild(cards[i]!, wildRank)) continue;
    if (suit === null) suit = cards[i]!.suit;
    else if (cards[i]!.suit !== suit) {
      return false;
    }
    if (firstNonWildIdx === -1) {
      firstNonWildIdx = i;
      firstNonWildRank = cards[i]!.rank;
    }
    const expected = firstNonWildRank + (i - firstNonWildIdx);
    if (cards[i]!.rank !== expected) {
      return false;
    }
  }
  if (suit === null) return false;
  const startRank = firstNonWildRank - firstNonWildIdx;
  const endRank = startRank + cards.length - 1;
  if (startRank < 1) return false;
  if (endRank > 13) return false;
  return true;
}

export function arrangeStraight(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): { rank: number; suit: number }[] {
  const nonWild = cards.filter((c) => !isWild(c, wildRank)).sort((a, b) => a.rank - b.rank);
  const wilds = cards.filter((c) => isWild(c, wildRank));
  const result: { rank: number; suit: number }[] = [];
  let wi = 0;

  let gapWilds = 0;
  for (let i = 1; i < nonWild.length; i++) {
    gapWilds += nonWild[i]!.rank - nonWild[i - 1]!.rank - 1;
  }
  const extraWilds = wilds.length - gapWilds;
  const headWilds = Math.max(0, Math.min(extraWilds, nonWild[0]!.rank - 1));

  for (let i = 0; i < headWilds; i++) {
    result.push(wilds[wi++]!);
  }

  let nextRank = nonWild[0]!.rank;
  for (const nw of nonWild) {
    while (nextRank < nw.rank && wi < wilds.length) {
      result.push(wilds[wi++]!);
      nextRank++;
    }
    result.push(nw);
    nextRank = nw.rank + 1;
  }
  while (wi < wilds.length) {
    result.push(wilds[wi++]!);
  }
  return result;
}

let meldIdCounter = 0;

export function nextMeldGroupId(): string {
  meldIdCounter++;
  return `meld_${meldIdCounter}`;
}

export function resetMeldIdCounter(): void {
  meldIdCounter = 0;
}
