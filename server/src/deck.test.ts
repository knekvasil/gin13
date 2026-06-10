import { describe, it, expect } from "vitest";
import { createDeck, shuffleDeck, dealCards } from "./deck";
import type { Card, Suit, Rank } from "./types";

function cardSet(deck: Card[]): Set<string> {
  return new Set(deck.map((c) => `${c.rank}-${c.suit}`));
}

describe("createDeck", () => {
  it("returns 52 unique cards", () => {
    const deck = createDeck();

    expect(deck).toHaveLength(52);

    const seen = new Set<string>();
    for (const card of deck) {
      const key = `${card.rank}-${card.suit}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("contains every suit and rank combination", () => {
    const deck = createDeck();
    const keySet = new Set(deck.map((c) => `${c.rank}-${c.suit}`));

    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        expect(keySet.has(`${rank}-${suit}`)).toBe(true);
      }
    }
  });
});

describe("shuffleDeck", () => {
  it("returns 52 cards", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
  });

  it("preserves the card set", () => {
    const deck = createDeck();
    const original = cardSet(deck);
    const shuffled = shuffleDeck(deck);
    const shuffledSet = cardSet(shuffled);

    expect(shuffledSet.size).toBe(52);
    for (const key of original) {
      expect(shuffledSet.has(key)).toBe(true);
    }
  });

  it("does not mutate the input deck", () => {
    const deck = createDeck();
    const snapshot = deck.map((c) => ({ ...c }));
    shuffleDeck(deck);

    expect(deck).toEqual(snapshot);
  });
});

describe("dealCards", () => {
  it("deals the correct number of hands", () => {
    const deck = createDeck();
    const { hands } = dealCards(deck, 7, 4);
    expect(hands).toHaveLength(4);
  });

  it("gives each hand the correct card count", () => {
    const deck = createDeck();
    const { hands } = dealCards(deck, 7, 4);
    for (const hand of hands) {
      expect(hand).toHaveLength(7);
    }
  });

  it("returns the remaining cards as the draw pile", () => {
    const deck = createDeck();
    const { hands, remainingDeck } = dealCards(deck, 7, 4);
    expect(remainingDeck).toHaveLength(52 - 28);
    for (const hand of hands) {
      for (const card of hand) {
        expect(remainingDeck).not.toContainEqual(card);
      }
    }
  });

  it("throws when deck has insufficient cards", () => {
    const smallDeck = createDeck().slice(0, 10);
    expect(() => dealCards(smallDeck, 5, 3)).toThrow("Insufficient cards");
  });
});
