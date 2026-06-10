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

export function drawFromDeck(state: GameState, sessionId: string): void {
  assertPhase(state, "draw");
  assertCurrentPlayer(state, sessionId);

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

export function canMeld(cards: { rank: number; suit: number }[]): boolean {
  if (cards.length < 3) return false;
  const rank = cards[0].rank;
  const suits = new Set<number>();
  for (const card of cards) {
    if (card.rank !== rank) return false;
    if (suits.has(card.suit)) return false;
    suits.add(card.suit);
  }
  return true;
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

  if (!canMeld(cards)) {
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

export function passMeld(state: GameState, sessionId: string): void {
  assertPhase(state, "main_phase");
  assertCurrentPlayer(state, sessionId);
  state.phase = "discard";
}

export function discardCard(
  state: GameState,
  sessionId: string,
  cardIndex: number,
): void {
  assertPhase(state, "discard");
  assertCurrentPlayer(state, sessionId);

  const player = getCurrentPlayer(state);
  if (cardIndex < 0 || cardIndex >= player.hand.length) {
    throw new Error("Invalid card index");
  }

  const card = player.hand.splice(cardIndex, 1)[0];
  card.meldGroupId = "";
  state.discardPile.push(card);

  state.phase = "end_turn";

  if (player.hand.length === 0) {
    state.status = "finished";
    state.phase = "finished";
  } else {
    state.currentPlayerIndex =
      (state.currentPlayerIndex + 1) % state.players.length;
    state.phase = "draw";
  }
}
