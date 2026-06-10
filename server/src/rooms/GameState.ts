import { Schema, defineTypes, ArraySchema } from "@colyseus/schema";

export class CardSchema extends Schema {
  declare rank: number;
  declare suit: number;
  declare meldGroupId: string;
}
defineTypes(CardSchema, {
  rank: "number",
  suit: "number",
  meldGroupId: "string",
});

export function createCard(
  rank: number,
  suit: number,
  meldGroupId?: string,
): CardSchema {
  const card = new CardSchema();
  card.rank = rank;
  card.suit = suit;
  card.meldGroupId = meldGroupId ?? "";
  return card;
}

export class Player extends Schema {
  declare sessionId: string;
  declare userId: string;
  declare name: string;
  declare hand: ArraySchema<CardSchema>;
  declare board: ArraySchema<CardSchema>;
}
defineTypes(Player, {
  sessionId: "string",
  userId: "string",
  name: "string",
  hand: { array: CardSchema },
  board: { array: CardSchema },
});

export class GameState extends Schema {
  declare status: string;
  declare phase: string;
  declare currentPlayerIndex: number;
  declare totalRounds: number;
  declare currentRound: number;
  declare wildRank: number;
  declare players: ArraySchema<Player>;
  declare drawPile: ArraySchema<CardSchema>;
  declare discardPile: ArraySchema<CardSchema>;
}
defineTypes(GameState, {
  status: "string",
  phase: "string",
  currentPlayerIndex: "number",
  totalRounds: "number",
  currentRound: "number",
  wildRank: "number",
  players: { array: Player },
  drawPile: { array: CardSchema },
  discardPile: { array: CardSchema },
});

export function createGameState(totalRounds = 13): GameState {
  const state = new GameState();
  state.status = "waiting";
  state.phase = "waiting";
  state.currentPlayerIndex = 0;
  state.totalRounds = totalRounds;
  state.currentRound = 0;
  state.wildRank = 1;
  state.players = new ArraySchema<Player>();
  state.drawPile = new ArraySchema<CardSchema>();
  state.discardPile = new ArraySchema<CardSchema>();
  return state;
}
