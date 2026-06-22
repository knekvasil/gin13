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
  const p1 = getCurrentPlayer(state);
  if (!p1) throw new Error("No current player");
  p1.hand.push(card);
  state.phase = "main_phase";
}

export function drawFromDiscard(state: GameState, sessionId: string): void {
  assertPhase(state, "draw");
  assertCurrentPlayer(state, sessionId);

  const card = state.discardPile.pop();
  if (!card) throw new Error("Discard pile is empty");

  const p2 = getCurrentPlayer(state);
  if (!p2) throw new Error("No current player");
  p2.hand.push(card);
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
  for (const idx of cardIndices) {
    if (idx < 0 || idx >= player.hand.length) {
      throw new Error("Invalid card index");
    }
    cards.push(player.hand[idx]!);
  }

  if (!canMeld(cards, state.wildRank)) {
    throw new Error("Invalid meld");
  }

  // Check board for existing set of same rank
  if (isValidSet(cards, state.wildRank) && !isValidStraightFlush(cards, state.wildRank)) {
    checkSetConflict(state, cards, "", state.wildRank);
  }

  // For straight flushes, verify cards can form a valid ordered sequence
  const straightFlush = isValidStraightFlush(cards, state.wildRank) && !isValidSet(cards, state.wildRank);
  if (straightFlush && !isOrderedStraightFlush(arrangeStraight(cards, state.wildRank), state.wildRank)) {
    throw new Error("Invalid meld");
  }

  const removeOrder = [...cardIndices].sort((a, b) => b - a);
  for (const idx of removeOrder) {
    player.hand.splice(idx, 1);
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

function isStraightMeld(cards: CardSchema[], wildRank: number): boolean {
  if (cards.every((c) => isWild(c, wildRank))) return false;
  return isValidStraightFlush(cards, wildRank) && !isValidSet(cards, wildRank);
}

function isOrderedStraightFlush(cards: CardSchema[], wildRank: number): boolean {
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

function checkBoardConflict(
  state: GameState,
  cards: CardSchema[],
  meldGroupId: string,
  wildRank: number,
): void {
  let suit: number | null = null;
  let firstNonWildIdx = -1;
  let firstNonWildRank = 0;
  for (let i = 0; i < cards.length; i++) {
    if (isWild(cards[i]!, wildRank)) continue;
    if (suit === null) suit = cards[i]!.suit;
    if (firstNonWildIdx === -1) {
      firstNonWildIdx = i;
      firstNonWildRank = cards[i]!.rank;
    }
  }
  if (suit === null) return;
  const startRank = firstNonWildRank - firstNonWildIdx;

  for (const player of state.players) {
    for (const card of player.board) {
      if (card.meldGroupId === meldGroupId) continue;
      if (card.suit !== suit) continue;
      if (isWild(card, wildRank)) continue;
      for (let pos = 0; pos < cards.length; pos++) {
        if (isWild(cards[pos]!, wildRank)) continue;
        if (startRank + pos === card.rank) {
          throw new Error("Card of that rank and suit already on the board");
        }
      }
    }
  }
}

function checkSetConflict(
  state: GameState,
  cards: CardSchema[],
  meldGroupId: string,
  wildRank: number,
): void {
  const proposedRank = cards.find((c) => !isWild(c, wildRank))?.rank ?? wildRank;
  const occupied = new Set<number>();
  for (const player of state.players) {
    const perMeld = new Map<string, CardSchema[]>();
    for (const card of player.board) {
      if (card.meldGroupId === "" || card.meldGroupId === meldGroupId) continue;
      const arr = perMeld.get(card.meldGroupId) ?? [];
      arr.push(card);
      perMeld.set(card.meldGroupId, arr);
    }
    for (const [, arr] of perMeld) {
      if (!isValidSet(arr, wildRank)) continue;
      const setRank = arr.find((c) => !isWild(c, wildRank))?.rank ?? wildRank;
      occupied.add(setRank);
    }
  }
  if (occupied.has(proposedRank)) {
    throw new Error("A set of that rank already exists on the board");
  }
}

export function addToMeld(
  state: GameState,
  sessionId: string,
  cardIndex: number,
  meldGroupId: string,
  preferSwap?: boolean,
  position?: "start" | "end",
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

  const card = player.hand[cardIndex]!;

  const found = findCardsInMeld(state, meldGroupId);
  if (!found) {
    throw new Error("Meld not found");
  }

  const wildInMeld = found.cards.find((c) => isWild(c, state.wildRank));

  if (preferSwap === true && wildInMeld && isWild(card, state.wildRank)) {
    throw new Error("Cannot swap a wild with another wild");
  }

  const straight = isStraightMeld(found.cards, state.wildRank);

  const canAdd = canMeld([...found.cards, card], state.wildRank);
  const canSwap = wildInMeld
    ? canMeld(
        found.cards.filter((c) => c !== wildInMeld).concat(card),
        state.wildRank,
      )
    : false;

  const proposedAddArr = position === "start" ? [card, ...found.cards] : [...found.cards, card];

  const orderOkAdd =
    !straight ||
    (position === "start"
      ? isOrderedStraightFlush(proposedAddArr, state.wildRank)
      : isOrderedStraightFlush(proposedAddArr, state.wildRank));

  const orderOkSwap =
    !straight ||
    !wildInMeld ||
    (() => {
      const wildIdx = found.cards.indexOf(wildInMeld);
      const ordered = [...found.cards];
      ordered.splice(wildIdx, 1, card);
      return isOrderedStraightFlush(ordered, state.wildRank);
    })();

  // Board-level conflict check: proposed straight must not overlap existing cards
  if (straight) {
    const proposedAdd = (position === "start" ? [card, ...found.cards] : [...found.cards, card]);
    const proposedSwap = wildInMeld
      ? (() => { const tmp = [...found.cards]; const wi = found.cards.indexOf(wildInMeld); tmp.splice(wi, 1, card); return tmp; })()
      : null;
    if (canAdd && orderOkAdd) checkBoardConflict(state, proposedAdd, meldGroupId, state.wildRank);
    if (canSwap && orderOkSwap && proposedSwap) checkBoardConflict(state, proposedSwap, meldGroupId, state.wildRank);
  } else if (!straight) {
    // Set meld: check for existing set of same rank on board
    if (canAdd) checkSetConflict(state, [...found.cards, card], meldGroupId, state.wildRank);
    if (canSwap && wildInMeld) {
      const tmp = found.cards.filter((c) => c !== wildInMeld).concat(card);
      checkSetConflict(state, tmp, meldGroupId, state.wildRank);
    }
  }


  if (canAdd && orderOkAdd && canSwap && orderOkSwap && preferSwap === undefined) {
    player.hand.splice(cardIndex, 1)[0];
    card.meldGroupId = meldGroupId;
    if (straight && position === "start") {
      found.owner.board.unshift(card);
    } else {
      found.owner.board.push(card);
    }
    return;
  }

  if (canSwap && orderOkSwap && preferSwap === true) {
    player.hand.splice(cardIndex, 1)[0];
    card.meldGroupId = meldGroupId;
    if (straight && wildInMeld) {
      const wildIdx = found.owner.board.findIndex((c) => c === wildInMeld);
      const arr: CardSchema[] = [];
      for (const c of found.owner.board) arr.push(c);
      arr[wildIdx] = card;
      for (let i = 0; i < arr.length; i++) {
        found.owner.board[i] = arr[i]!;
      }
    } else {
      found.owner.board.push(card);
      const boardIdx = found.owner.board.findIndex((c) => c === wildInMeld);
      if (boardIdx !== -1) found.owner.board.splice(boardIdx, 1);
    }
    wildInMeld!.meldGroupId = "";
    player.hand.push(wildInMeld!);
    return;
  }

  // preferSwap=true but swap failed — fall through to add if possible
  if (preferSwap === true && canAdd && orderOkAdd) {
    player.hand.splice(cardIndex, 1)[0];
    card.meldGroupId = meldGroupId;
    if (straight && position === "start") {
      found.owner.board.unshift(card);
    } else {
      found.owner.board.push(card);
    }
    return;
  }

  if (preferSwap !== true && canAdd && orderOkAdd) {
    player.hand.splice(cardIndex, 1)[0];
    card.meldGroupId = meldGroupId;
    if (straight && position === "start") {
      found.owner.board.unshift(card);
    } else {
      found.owner.board.push(card);
    }
    return;
  }

  // Fallback: preferSwap=undefined, only one is valid ordered
  if (preferSwap === undefined) {
    if (canSwap && orderOkSwap) {
      player.hand.splice(cardIndex, 1)[0];
      card.meldGroupId = meldGroupId;
      if (straight && wildInMeld) {
        const wildIdx = found.owner.board.findIndex((c) => c === wildInMeld);
        const arr: CardSchema[] = [];
        for (const c of found.owner.board) arr.push(c);
        arr[wildIdx] = card;
        for (let i = 0; i < arr.length; i++) {
          found.owner.board[i] = arr[i]!;
        }
      } else {
        found.owner.board.push(card);
        const boardIdx = found.owner.board.findIndex((c) => c === wildInMeld);
        if (boardIdx !== -1) found.owner.board.splice(boardIdx, 1);
      }
      wildInMeld!.meldGroupId = "";
      player.hand.push(wildInMeld!);
      return;
    }
    if (canAdd && orderOkAdd) {
      player.hand.splice(cardIndex, 1)[0];
      card.meldGroupId = meldGroupId;
      if (straight && position === "start") {
        found.owner.board.unshift(card);
      } else {
        found.owner.board.push(card);
      }
      return;
    }
  }

  throw new Error("Invalid manipulation");
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

  if (isWild(replacement, state.wildRank)) {
    player.hand.push(replacement);
    throw new Error("Cannot swap a wild with another wild");
  }

  const newMeldCards = meldCards.filter((c) => c !== wildCard);
  newMeldCards.push(replacement);

  if (!canMeld(newMeldCards, state.wildRank)) {
    player.hand.push(replacement);
    throw new Error("Invalid manipulation");
  }

  // For straights, the replacement must preserve the ordered sequence
  const isStraightM = isValidStraightFlush(meldCards, state.wildRank) && !isValidSet(meldCards, state.wildRank);
  let ordered: CardSchema[] | undefined;
  if (isStraightM) {
    ordered = [...meldCards];
    ordered[meldCardIndex] = replacement;
    if (!isOrderedStraightFlush(ordered, state.wildRank)) {
      player.hand.push(replacement);
      throw new Error("Invalid manipulation");
    }
  }

  const boardIdx = owner.board.findIndex((c) => c === wildCard);
  if (boardIdx === -1) {
    player.hand.push(replacement);
    throw new Error("Wild card not found on board");
  }

  try {
    if (isStraightM) {
      checkBoardConflict(state, ordered!, meldGroupId, state.wildRank);
    } else {
      checkSetConflict(state, newMeldCards, meldGroupId, state.wildRank);
    }
  } catch (e) {
    player.hand.push(replacement);
    throw e;
  }

  const straight = isStraightM;
  replacement.meldGroupId = meldGroupId;
  if (straight) {
    const arr: CardSchema[] = [];
    for (const c of owner.board) arr.push(c);
    arr[boardIdx] = replacement;
    for (let i = 0; i < arr.length; i++) {
      owner.board[i] = arr[i]!;
    }
  } else {
    owner.board.splice(boardIdx, 1);
    owner.board.push(replacement);
  }

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

function getSubsets(arr: number[], size: number): number[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = getSubsets(rest, size - 1).map((s) => [first!, ...s]);
  const withoutFirst = getSubsets(rest, size);
  return [...withFirst, ...withoutFirst];
}

function cardPoints(card: CardSchema, wildRank: number): number {
  return card.rank === wildRank ? 25 : Math.max(card.rank, 10);
}

function arrangeStraight(cards: CardSchema[], wildRank: number): CardSchema[] {
  const nonWild = cards.filter((c) => !isWild(c, wildRank)).sort((a, b) => a.rank - b.rank);
  const wilds = cards.filter((c) => isWild(c, wildRank));
  const result: CardSchema[] = [];
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

function bestMeld(
  hand: CardSchema[],
  wildRank: number,
  existingMelds: CardSchema[][],
  meldGroupIds: string[],
  wildRankVal: number,
): { meld: CardSchema[]; groupId: string | null; swapFromGroup: string | null; swapCard: CardSchema | null } | null {
  let best: { meld: CardSchema[]; groupId: string | null; swapFromGroup: string | null; swapCard: CardSchema | null } | null = null;
  let bestScore = -1;

  // 1. Try creating a new meld from hand
  const indices = hand.map((_, i) => i);
  for (let size = 7; size >= 3; size--) {
    for (const subset of getSubsets(indices, size)) {
      const cards = subset.map((i) => hand[i]!);
      if (!canMeld(cards, wildRank)) continue;
      const arranged = (isValidStraightFlush(cards, wildRank) && !isValidSet(cards, wildRank))
        ? arrangeStraight(cards, wildRank)
        : cards;
      if (isValidStraightFlush(cards, wildRank) && !isValidSet(cards, wildRank) && !isOrderedStraightFlush(arranged, wildRank)) continue;
      const score = cards.reduce((s, c) => s + cardPoints(c, wildRank), 0);
      if (score > bestScore) {
        bestScore = score;
        best = { meld: arranged, groupId: null, swapFromGroup: null, swapCard: null };
      }
    }
  }

  // 2. Try adding to existing melds
  for (let hi = 0; hi < hand.length; hi++) {
    for (let mi = 0; mi < existingMelds.length; mi++) {
      const meld = existingMelds[mi]!;
      const card = hand[hi]!;
      if (canMeld([...meld, card], wildRank)) {
        const score = cardPoints(card, wildRank);
        if (score > bestScore) {
          bestScore = score;
          best = { meld: [card], groupId: meldGroupIds[mi]!, swapFromGroup: null, swapCard: null };
        }
      }
      // 3. Try swapping wilds
      const wildInMeld = meld.find((c) => isWild(c, wildRank));
      if (wildInMeld && !isWild(card, wildRank)) {
        const replaced = meld.filter((c) => c !== wildInMeld).concat(card);
        if (canMeld(replaced, wildRank)) {
          const score = cardPoints(card, wildRank);
          if (score > bestScore) {
            bestScore = score;
            best = { meld: [card], groupId: meldGroupIds[mi]!, swapFromGroup: meldGroupIds[mi]!, swapCard: wildInMeld };
          }
        }
      }
    }
  }
  return best;
}

export function botPlayTurn(state: GameState): void {
  const player = getCurrentPlayer(state);
  const wr = state.wildRank;

  // 1. Draw from deck
  if (state.phase === "draw") {
    const card = state.drawPile.pop();
    if (card) {
      card.meldGroupId = "";
      player.hand.push(card);
    }
    state.phase = "main_phase";
  }

  // 2. Collect existing melds on the board (own + other players)
  const existingMelds: CardSchema[][] = [];
  const meldGroupIds: string[] = [];
  const seenGroups = new Set<string>();
  for (const p of state.players) {
    for (const card of p.board) {
      if (card.meldGroupId && !seenGroups.has(card.meldGroupId)) {
        seenGroups.add(card.meldGroupId);
        const group: CardSchema[] = [];
        for (const c of p.board) {
          if (c.meldGroupId === card.meldGroupId) group.push(c);
        }
        existingMelds.push(group);
        meldGroupIds.push(card.meldGroupId);
      }
    }
  }

  // 3. Find and play the best move (loop to meld multiple times)
  if (state.phase === "main_phase") {
    for (let attempt = 0; attempt < 20; attempt++) {
      const best = bestMeld(
        player.hand.map((c) => c),
        wr,
        existingMelds,
        meldGroupIds,
        wr,
      );

      if (!best) break;

      let ok = false;
      if (best.groupId === null && !best.swapFromGroup) {
        const indices = best.meld.map((c) => player.hand.findIndex((h) => h === c));
        if (indices.every((i) => i >= 0)) {
          try { meldCards(state, player.sessionId, indices); ok = true; } catch {}
        }
      } else if (best.groupId && !best.swapFromGroup) {
        const hi = player.hand.findIndex((h) => h === best.meld[0]);
        if (hi >= 0) {
          try { addToMeld(state, player.sessionId, hi, best.groupId, false, "end"); ok = true; } catch {}
        }
      } else if (best.groupId && best.swapFromGroup && best.swapCard) {
        const hi = player.hand.findIndex((h) => h === best.meld[0]);
        const meldCardsList = existingMelds[meldGroupIds.indexOf(best.groupId)]!;
        const wildIdx = meldCardsList.indexOf(best.swapCard);
        if (hi >= 0 && wildIdx >= 0) {
          try { swapWild(state, player.sessionId, best.groupId, wildIdx, hi); ok = true; } catch {}
        }
      }

      if (!ok) break;

      // After an action, update existingMelds since board changed
      existingMelds.length = 0;
      meldGroupIds.length = 0;
      seenGroups.clear();
      for (const p of state.players) {
        for (const card of p.board) {
          if (card.meldGroupId && !seenGroups.has(card.meldGroupId)) {
            seenGroups.add(card.meldGroupId);
            const group: CardSchema[] = [];
            for (const c of p.board) {
              if (c.meldGroupId === card.meldGroupId) group.push(c);
            }
            existingMelds.push(group);
            meldGroupIds.push(card.meldGroupId);
          }
        }
      }
    }

    state.phase = "discard";
  }

  // 4. Discard highest-point card
  if (state.phase === "discard") {
    if (player.hand.length > 0) {
      const idx = getHighestPointCardIndex(player, wr);
      const card = player.hand.splice(idx, 1)[0];
      card.meldGroupId = "";
      state.discardPile.push(card);
    }
    if (player.hand.length === 0) {
      endRound(state);
      return;
    }
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    state.phase = "draw";
  }
}

export function autoPlayTurn(state: GameState): void {
  const idx = state.currentPlayerIndex;
  if (idx < 0 || idx >= state.players.length) return;
  const player = state.players[idx]!;

  if (state.phase === "draw") {
    const card = state.drawPile.pop();
    if (card) {
      card.meldGroupId = "";
      player.hand.push(card);
    }
    state.phase = "main_phase";
  }

  if (state.phase === "main_phase") {
    state.phase = "discard";
  }

  if (state.phase === "discard") {
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
  if (state.phase === "draw") {
    throw new Error("Must draw before discarding");
  }
  if (state.phase !== "discard" && state.phase !== "main_phase") {
    throw new Error(`Cannot discard during "${state.phase}" phase`);
  }
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
