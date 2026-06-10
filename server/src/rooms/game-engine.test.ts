import { describe, it, expect } from "vitest";
import { ArraySchema } from "@colyseus/schema";
import { GameState, Player, createGameState, CardSchema, createCard } from "./GameState";
import { startGame, drawFromDeck, drawFromDiscard, meldCards, passMeld, discardCard } from "./game-engine";

function twoPlayerState(): GameState {
  const state = createGameState();
  const p1 = new Player();
  p1.sessionId = "s1";
  p1.name = "Alice";
  const p2 = new Player();
  p2.sessionId = "s2";
  p2.name = "Bob";
  state.players.push(p1, p2);
  startGame(state);
  return state;
}

function addCardsToHand(player: Player, cards: { rank: number; suit: number }[]) {
  for (const c of cards) {
    player.hand.push(createCard(c.rank, c.suit));
  }
}

describe("startGame", () => {
  it("deals 7 cards to each player, sets up draw pile and discard pile", () => {
    const state = twoPlayerState();

    expect(state.status).toBe("playing");
    expect(state.phase).toBe("draw");
    expect(state.currentPlayerIndex).toBe(0);

    for (const player of state.players) {
      expect(player.hand.length).toBe(7);
    }

    expect(state.drawPile.length).toBe(52 - 2 * 7 - 1);
    expect(state.discardPile.length).toBe(1);
  });
});

describe("drawFromDeck", () => {
  it("draws from draw pile and advances to main_phase", () => {
    const state = twoPlayerState();
    const drawPileBefore = state.drawPile.length;

    drawFromDeck(state, "s1");

    expect(state.players[0]!.hand.length).toBe(8);
    expect(state.drawPile.length).toBe(drawPileBefore - 1);
    expect(state.phase).toBe("main_phase");
  });
});

describe("drawFromDiscard", () => {
  it("draws from discard pile and advances to main_phase", () => {
    const state = twoPlayerState();
    const discardPileBefore = state.discardPile.length;

    drawFromDiscard(state, "s1");

    expect(state.players[0]!.hand.length).toBe(8);
    expect(state.discardPile.length).toBe(discardPileBefore - 1);
    expect(state.phase).toBe("main_phase");
  });
});

describe("passMeld", () => {
  it("moves from main_phase to discard phase", () => {
    const state = createGameState();
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [{ rank: 5, suit: 0 }]);
    state.players.push(p1);

    passMeld(state, "s1");

    expect(state.phase).toBe("discard");
  });
});

describe("discardCard", () => {
  it("moves a card from hand to discard pile and advances turn", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "discard";
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 7, suit: 1 },
    ]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);

    state.players.push(p1, p2);

    discardCard(state, "s1", 0);

    expect(p1.hand.length).toBe(1);
    expect(state.discardPile.length).toBe(1);
    expect(state.phase).toBe("draw");
    expect(state.currentPlayerIndex).toBe(1);
  });
});

describe("FSM enforcement", () => {
  it("cannot meld before drawing (wrong phase)", () => {
    const state = twoPlayerState();
    expect(state.phase).toBe("draw");
    expect(() => meldCards(state, "s1", [0, 1, 2])).toThrow(
      "Expected phase \"main_phase\"",
    );
  });

  it("cannot discard before drawing (wrong phase)", () => {
    const state = twoPlayerState();
    expect(() => discardCard(state, "s1", 0)).toThrow(
      "Expected phase \"discard\"",
    );
  });
});

describe("full turn flow", () => {
  it("draw -> meld -> pass -> discard -> next turn", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "draw";
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 9, suit: 0 },
      { rank: 10, suit: 1 },
      { rank: 11, suit: 2 },
      { rank: 13, suit: 3 },
    ]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    addCardsToHand(p2, [
      { rank: 3, suit: 0 },
      { rank: 3, suit: 1 },
      { rank: 10, suit: 2 },
    ]);

    state.players.push(p1, p2);

    state.drawPile.push(createCard(8, 0));
    state.discardPile.push(createCard(2, 0));

    drawFromDiscard(state, "s1");
    expect(state.phase).toBe("main_phase");
    expect(p1.hand.length).toBe(8);

    meldCards(state, "s1", [0, 1, 2]);
    expect(p1.board.length).toBe(3);
    expect(p1.hand.length).toBe(5);
    expect(state.phase).toBe("main_phase");

    passMeld(state, "s1");
    expect(state.phase).toBe("discard");

    discardCard(state, "s1", 0);
    expect(p1.hand.length).toBe(4);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("draw");
  });
});

describe("going out", () => {
  it("ends round when hand is empty after discard", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "discard";
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [{ rank: 5, suit: 0 }]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);

    state.players.push(p1, p2);

    discardCard(state, "s1", 0);

    expect(p1.hand.length).toBe(0);
    expect(state.discardPile.length).toBe(1);
    expect(state.status).toBe("finished");
    expect(state.phase).toBe("finished");
  });
});

describe("invalid meld", () => {
  it("rejects a meld with cards of different ranks", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 7, suit: 1 },
      { rank: 5, suit: 2 },
    ]);
    state.players.push(p1);

    expect(() => meldCards(state, "s1", [0, 1, 2])).toThrow("Invalid meld");
    expect(p1.hand.length).toBe(3);
    expect(p1.board.length).toBe(0);
  });

  it("rejects a meld with duplicate suits", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 0 },
      { rank: 5, suit: 2 },
    ]);
    state.players.push(p1);

    expect(() => meldCards(state, "s1", [0, 1, 2])).toThrow("Invalid meld");
    expect(p1.hand.length).toBe(3);
    expect(p1.board.length).toBe(0);
  });
});

describe("meldCards", () => {
  it("lays down a valid 3-of-a-kind from hand to board", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 7, suit: 0 },
      { rank: 9, suit: 1 },
    ]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    addCardsToHand(p2, [
      { rank: 3, suit: 0 },
      { rank: 3, suit: 1 },
      { rank: 10, suit: 2 },
    ]);

    state.players.push(p1, p2);

    meldCards(state, "s1", [0, 1, 2]);

    expect(p1.hand.length).toBe(2);
    expect(p1.board.length).toBe(3);
    const meldGroupId = p1.board[0]!.meldGroupId;
    expect(meldGroupId).not.toBe("");
    for (const card of p1.board) {
      expect(card.meldGroupId).toBe(meldGroupId);
    }
    expect(state.phase).toBe("main_phase");
  });
});
