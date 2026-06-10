import { Schema, defineTypes, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  declare sessionId: string;
  declare userId: string;
  declare name: string;
}
defineTypes(Player, {
  sessionId: "string",
  userId: "string",
  name: "string",
});

export class GameState extends Schema {
  declare status: string;
  declare totalRounds: number;
  declare players: ArraySchema<Player>;
}
defineTypes(GameState, {
  status: "string",
  totalRounds: "number",
  players: { array: Player },
});

export function createGameState(totalRounds = 13): GameState {
  const state = new GameState();
  state.status = "waiting";
  state.totalRounds = totalRounds;
  state.players = new ArraySchema<Player>();
  return state;
}
