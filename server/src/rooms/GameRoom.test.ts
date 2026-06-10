import { describe, it, expect } from "vitest";
import { GameState, Player, createGameState } from "./GameState";

describe("GameState", () => {
  it("starts with empty players and waiting status", () => {
    const state = createGameState();
    expect(state.status).toBe("waiting");
    expect(state.players.length).toBe(0);
  });

  it("can add a player", () => {
    const state = createGameState();
    const player = new Player();
    player.sessionId = "s1";
    player.userId = "u1";
    player.name = "Alice";
    state.players.push(player);
    expect(state.players.length).toBe(1);
    expect(state.players[0]!.name).toBe("Alice");
  });
});
