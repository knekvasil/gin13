import {
  CardSchema,
  Player,
  GameState,
  createCard,
} from "./GameState";
import { createDeck, shuffleDeck, dealCards } from "../deck";
import type { Card } from "../types";
import { ArraySchema } from "@colyseus/schema";

function toCardSchema(card: Card, meldGroupId?: string): CardSchema {
  return createCard(card.rank, card.suit, meldGroupId);
}

function toArraySchema<T>(items: T[]): ArraySchema<T> {
  const arr = new ArraySchema<T>();
  for (const item of items) {
    arr.push(item);
  }
  return arr;
}

export function startGame(state: GameState): void {
  if (state.players.length < 2) {
    throw new Error("Need at least 2 players to start");
  }

  const deck = shuffleDeck(createDeck());
  const cardsPerPlayer = 7;
  const { hands, remainingDeck } = dealCards(
    deck,
    cardsPerPlayer,
    state.players.length,
  );

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i]!;
    player.hand = toArraySchema(hands[i].map((c) => toCardSchema(c)));
    player.board = new ArraySchema<CardSchema>();
  }

  state.drawPile = toArraySchema(
    remainingDeck.map((c) => toCardSchema(c)),
  );

  const topCard = state.drawPile.pop();
  if (topCard) {
    state.discardPile.push(topCard);
  }

  state.status = "playing";
  state.phase = "draw";
  state.currentPlayerIndex = 0;
  state.wildRank = state.currentRound + 1;
}

export function endMatch(state: GameState): void {
  let lowestScore = Infinity;
  let winnerSessionId = "";
  for (const player of state.players) {
    if (player.score < lowestScore) {
      lowestScore = player.score;
      winnerSessionId = player.sessionId;
    }
  }
  state.winnerSessionId = winnerSessionId;
  state.status = "finished";
  state.phase = "finished";
}

export function startNextRound(state: GameState): void {
  state.currentRound++;
  if (state.currentRound >= state.totalRounds) {
    endMatch(state);
    return;
  }

  const deck = shuffleDeck(createDeck());
  const cardsPerPlayer = 7;
  const { hands, remainingDeck } = dealCards(
    deck,
    cardsPerPlayer,
    state.players.length,
  );

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i]!;
    player.hand = toArraySchema(hands[i].map((c) => toCardSchema(c)));
    player.board = new ArraySchema<CardSchema>();
  }

  state.drawPile = toArraySchema(
    remainingDeck.map((c) => toCardSchema(c)),
  );
  state.discardPile = new ArraySchema<CardSchema>();

  const topCard = state.drawPile.pop();
  if (topCard) {
    state.discardPile.push(topCard);
  }

  state.wildRank = state.currentRound + 1;
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;
  state.status = "playing";
  state.phase = "draw";
}

function assertPhase(state: GameState, expected: string): void {
  if (state.phase !== expected) {
    throw new Error(
      `Expected phase "${expected}" but current phase is "${state.phase}"`,
    );
  }
}

function assertCurrentPlayer(state: GameState, sessionId: string): void {
  const player = state.players[state.currentPlayerIndex]!;
  if (player.sessionId !== sessionId) {
    throw new Error("Not your turn");
  }
}

function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex]!;
}

function reshuffleDiscardIntoDraw(state: GameState): void {
  if (state.drawPile.length > 0) return;
  if (state.discardPile.length <= 1) return;

  const topCard = state.discardPile.pop()!;

  const cards: Card[] = [];
  for (const c of state.discardPile) {
    cards.push({ rank: c.rank as Card["rank"], suit: c.suit as Card["suit"] });
  }
  state.discardPile = new ArraySchema<CardSchema>();

  const shuffled = shuffleDeck(cards);
  for (const c of shuffled) {
    state.drawPile.push(createCard(c.rank, c.suit));
  }

  state.discardPile.push(topCard);
}

export function drawFromDeck(state: GameState, sessionId: string): void {
  assertPhase(state, "draw");
  assertCurrentPlayer(state, sessionId);

  reshuffleDiscardIntoDraw(state);

  const card = state.drawPile.pop();
  if (!card) throw new Error("Draw pile is empty");

  card.meldGroupId = "";
  getCurrentPlayer(state).hand.push(card);
  state.phase = "main_phase";
}

export function drawFromDiscard(state: GameState, sessionId: string): void {
  assertPhase(state, "draw");
  assertCurrentPlayer(state, sessionId);

  const card = state.discardPile.pop();
  if (!card) throw new Error("Discard pile is empty");

  card.meldGroupId = "";
  getCurrentPlayer(state).hand.push(card);
  state.phase = "main_phase";
}

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

function isValidSet(
  cards: { rank: number; suit: number }[],
  wildRank: number,
): boolean {
  if (cards.length > 4) return false;

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

function isValidStraightFlush(
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

let meldIdCounter = 0;

function nextMeldGroupId(): string {
  meldIdCounter++;
  return `meld_${meldIdCounter}`;
}

export function meldCards(
  state: GameState,
  sessionId: string,
  cardIndices: number[],
): void {
  assertPhase(state, "main_phase");
  assertCurrentPlayer(state, sessionId);

  const player = getCurrentPlayer(state);

  const cards: CardSchema[] = [];
  const sorted = [...cardIndices].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx < 0 || idx >= player.hand.length) {
      throw new Error("Invalid card index");
    }
    cards.unshift(player.hand.splice(idx, 1)[0]);
  }

  if (!canMeld(cards, state.wildRank)) {
    for (const card of cards) {
      player.hand.push(card);
    }
    throw new Error("Invalid meld");
  }

  const groupId = nextMeldGroupId();
  for (const card of cards) {
    card.meldGroupId = groupId;
    player.board.push(card);
  }
}

function findCardsInMeld(
  state: GameState,
  meldGroupId: string,
): { cards: CardSchema[]; owner: Player } | null {
  for (const player of state.players) {
    const cards: CardSchema[] = [];
    for (const card of player.board) {
      if (card.meldGroupId === meldGroupId) {
        cards.push(card);
      }
    }
    if (cards.length > 0) {
      return { cards, owner: player };
    }
  }
  return null;
}

export function addToMeld(
  state: GameState,
  sessionId: string,
  cardIndex: number,
  meldGroupId: string,
): void {
  assertPhase(state, "main_phase");
  assertCurrentPlayer(state, sessionId);

  const player = getCurrentPlayer(state);

  if (player.board.length === 0) {
    throw new Error("Must have laid down before manipulating");
  }

  if (cardIndex < 0 || cardIndex >= player.hand.length) {
    throw new Error("Invalid card index");
  }

  const card = player.hand.splice(cardIndex, 1)[0];

  const found = findCardsInMeld(state, meldGroupId);
  if (!found) {
    player.hand.push(card);
    throw new Error("Meld not found");
  }

  const newCards = [...found.cards, card];
  if (!canMeld(newCards, state.wildRank)) {
    player.hand.push(card);
    throw new Error("Invalid manipulation");
  }

  card.meldGroupId = meldGroupId;
  found.owner.board.push(card);
}

export function swapWild(
  state: GameState,
  sessionId: string,
  meldGroupId: string,
  meldCardIndex: number,
  handCardIndex: number,
): void {
  assertPhase(state, "main_phase");
  assertCurrentPlayer(state, sessionId);

  const player = getCurrentPlayer(state);

  if (player.board.length === 0) {
    throw new Error("Must have laid down before manipulating");
  }

  const found = findCardsInMeld(state, meldGroupId);
  if (!found) throw new Error("Meld not found");

  const { cards: meldCards, owner } = found;
  if (meldCardIndex < 0 || meldCardIndex >= meldCards.length) {
    throw new Error("Invalid meld card index");
  }

  const wildCard = meldCards[meldCardIndex]!;
  if (!isWild(wildCard, state.wildRank)) {
    throw new Error("Card is not a wild");
  }

  if (handCardIndex < 0 || handCardIndex >= player.hand.length) {
    throw new Error("Invalid card index");
  }

  const replacement = player.hand.splice(handCardIndex, 1)[0];

  const newMeldCards = meldCards.filter((c) => c !== wildCard);
  newMeldCards.push(replacement);

  if (!canMeld(newMeldCards, state.wildRank)) {
    player.hand.push(replacement);
    throw new Error("Invalid manipulation");
  }

  const boardIndex = owner.board.findIndex((c) => c === wildCard);
  if (boardIndex !== -1) {
    owner.board.splice(boardIndex, 1);
  }

  replacement.meldGroupId = meldGroupId;
  owner.board.push(replacement);

  wildCard.meldGroupId = "";
  player.hand.push(wildCard);
}

export function passMeld(state: GameState, sessionId: string): void {
  assertPhase(state, "main_phase");
  assertCurrentPlayer(state, sessionId);
  state.phase = "discard";
}

export function calculateRoundScores(state: GameState): Map<string, number> {
  const scores = new Map<string, number>();
  for (const player of state.players) {
    let roundScore = 0;
    for (const card of player.hand) {
      if (isWild(card, state.wildRank)) {
        roundScore += 25;
      } else {
        roundScore += card.rank;
      }
    }
    scores.set(player.sessionId, roundScore);
  }
  return scores;
}

export function endRound(state: GameState): Map<string, number> {
  const scores = calculateRoundScores(state);
  for (const player of state.players) {
    const s = scores.get(player.sessionId);
    if (s !== undefined) {
      player.score += s;
    }
  }
  state.phase = "round_ended";
  return scores;
}

function getHighestPointCardIndex(player: Player, wildRank: number): number {
  let highestIdx = 0;
  let highestPoints = -1;
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i]!;
    const points = isWild(card, wildRank) ? 25 : card.rank;
    if (points > highestPoints) {
      highestPoints = points;
      highestIdx = i;
    }
  }
  return highestIdx;
}

export function autoPlayTurn(state: GameState): void {
  if (state.phase === "draw") {
    const card = state.drawPile.pop();
    if (card) {
      card.meldGroupId = "";
      getCurrentPlayer(state).hand.push(card);
    }
    state.phase = "main_phase";
  }

  if (state.phase === "main_phase") {
    state.phase = "discard";
  }

  if (state.phase === "discard") {
    const player = getCurrentPlayer(state);
    if (player.hand.length > 0) {
      const idx = getHighestPointCardIndex(player, state.wildRank);
      const card = player.hand.splice(idx, 1)[0];
      card.meldGroupId = "";
      state.discardPile.push(card);
    }
    if (player.hand.length === 0) {
      endRound(state);
      return;
    }
    state.currentPlayerIndex =
      (state.currentPlayerIndex + 1) % state.players.length;
    state.phase = "draw";
  }
}

export function discardCard(
  state: GameState,
  sessionId: string,
  cardIndex: number,
): void {
  assertPhase(state, "discard");
  assertCurrentPlayer(state, sessionId);

  const player = getCurrentPlayer(state);

  if (player.hand.length === 0) {
    endRound(state);
    return;
  }

  if (cardIndex < 0 || cardIndex >= player.hand.length) {
    throw new Error("Invalid card index");
  }

  const card = player.hand.splice(cardIndex, 1)[0];
  card.meldGroupId = "";
  state.discardPile.push(card);

  state.phase = "end_turn";

  if (player.hand.length === 0) {
    endRound(state);
  } else {
    state.currentPlayerIndex =
      (state.currentPlayerIndex + 1) % state.players.length;
    state.phase = "draw";
  }
}
