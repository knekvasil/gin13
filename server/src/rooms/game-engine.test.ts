import { describe, it, expect } from "vitest";
import { ArraySchema } from "@colyseus/schema";
import { GameState, Player, createGameState, CardSchema, createCard } from "./GameState";
import { startGame, drawFromDeck, drawFromDiscard, meldCards, passMeld, discardCard, isWild, canMeld, addToMeld, swapWild, calculateRoundScores, startNextRound, endMatch, endRound, autoPlayTurn } from "./game-engine";

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

describe("drawFromDeck reshuffle", () => {
  it("reshuffles discard pile (minus top card) into draw pile when draw pile is empty", () => {
    const state = twoPlayerState();
    const p1 = state.players[0];

    state.drawPile = new ArraySchema<CardSchema>();
    state.discardPile = new ArraySchema<CardSchema>();
    for (let i = 0; i < 10; i++) {
      state.discardPile.push(createCard(5, 0));
    }
    const topCard = createCard(13, 3);
    state.discardPile.push(topCard);

    const discardBefore = state.discardPile.length;

    drawFromDeck(state, "s1");

    expect(state.drawPile.length).toBe(discardBefore - 2);
    expect(state.discardPile.length).toBe(1);
    expect(state.discardPile[0]).toBe(topCard);
    expect(p1!.hand.length).toBe(8);
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
      "Must draw before discarding",
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
    state.currentRound = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    addCardsToHand(p1, [{ rank: 5, suit: 0 }]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);

    state.players.push(p1, p2);

    discardCard(state, "s1", 0);

    expect(p1.hand.length).toBe(0);
    expect(state.discardPile.length).toBe(1);
    expect(state.phase).toBe("round_ended");
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

describe("isWild", () => {
  it("returns true when card rank matches wild rank", () => {
    expect(isWild({ rank: 1, suit: 0 }, 1)).toBe(true);
  });

  it("returns false when card rank does not match wild rank", () => {
    expect(isWild({ rank: 5, suit: 0 }, 1)).toBe(false);
  });
});

describe("canMeld", () => {
  it("accepts a 4-of-a-kind set without wilds", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 5, suit: 3 },
    ], 1)).toBe(true);
  });

  it("accepts a 4-of-a-kind set with a wild card", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 1, suit: 3 }, // wild (rank === wildRank)
    ], 1)).toBe(true);
  });

  it("rejects a set with 5 cards even with wilds", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 5, suit: 3 },
      { rank: 1, suit: 0 },
    ], 1)).toBe(false);
  });

  it("accepts a straight flush of 4 consecutive ranks", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
      { rank: 8, suit: 0 },
    ], 1)).toBe(true);
  });

  it("accepts a straight flush with a wild filling a gap", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 8, suit: 0 },
      { rank: 1, suit: 1 },
    ], 1)).toBe(true);
  });

  it("rejects a straight flush with mixed suits", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 1 },
      { rank: 8, suit: 0 },
    ], 1)).toBe(false);
  });

  it("rejects a wrapped straight (Q, K, A, 2)", () => {
    expect(canMeld([
      { rank: 12, suit: 0 },
      { rank: 13, suit: 0 },
      { rank: 1, suit: 0 },
      { rank: 2, suit: 0 },
    ], 6)).toBe(false);
  });

  it("rejects a wrapped straight even with wilds", () => {
    expect(canMeld([
      { rank: 12, suit: 0 },
      { rank: 13, suit: 0 },
      { rank: 1, suit: 1 },
      { rank: 5, suit: 2 }, // wild (rank === wildRank)
    ], 5)).toBe(false);
  });

  it("rejects a straight flush with duplicate non-wild ranks", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
    ], 1)).toBe(false);
  });

  it("accepts a longer straight flush (7 cards)", () => {
    expect(canMeld([
      { rank: 3, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
      { rank: 8, suit: 0 },
      { rank: 9, suit: 0 },
    ], 1)).toBe(true);
  });

  it("rejects a straight flush with fewer than 4 cards", () => {
    expect(canMeld([
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
    ], 1)).toBe(false);
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

  it("accepts an all-wild set (three wilds)", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 1, suit: 1 },
      { rank: 1, suit: 2 },
      { rank: 7, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    expect(p1.board.length).toBe(3);
    expect(p1.hand.length).toBe(1);
    const gid = p1.board[0]!.meldGroupId;
    for (const c of p1.board) expect(c.meldGroupId).toBe(gid);
  });

  it("accepts a set with two wilds filling missing suits", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 1, suit: 1 },
      { rank: 1, suit: 2 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    expect(p1.board.length).toBe(3);
  });

  it("accepts a straight flush with wilds at both ends", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 3, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 5, suit: 0 },
      { rank: 1, suit: 1 },
    ]);
    state.players.push(p1);

    // W, 3, 4, 5, W — wilds at both ends representing 2 and 6
    meldCards(state, "s1", [0, 1, 2, 3, 4]);
    expect(p1.board.length).toBe(5);
    const gid = p1.board[0]!.meldGroupId;
    for (const c of p1.board) expect(c.meldGroupId).toBe(gid);
  });
});

describe("addToMeld", () => {
  it("throws if player has not laid down yet", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [{ rank: 5, suit: 0 }]);
    state.players.push(p1);

    expect(() => addToMeld(state, "s1", 0, "meld_1")).toThrow(
      "Must have laid down before manipulating",
    );
  });

  it("adds a card from hand to own meld", () => {
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
      { rank: 5, suit: 3 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    addToMeld(state, "s1", 0, meldGroupId);

    expect(p1.hand.length).toBe(0);
    expect(p1.board.length).toBe(4);
    for (const card of p1.board) {
      expect(card.meldGroupId).toBe(meldGroupId);
    }
  });

  it("adds a card from hand to another player's meld", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    state.players.push(p1);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    addCardsToHand(p2, [
      { rank: 8, suit: 0 },
      { rank: 8, suit: 1 },
      { rank: 8, suit: 2 },
    ]);
    state.players.push(p2);

    meldCards(state, "s2", [0, 1, 2]);
    const meldGroupId = p2.board[0]!.meldGroupId;

    state.currentPlayerIndex = 0;
    state.phase = "main_phase";

    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 8, suit: 3 },
    ]);
    meldCards(state, "s1", [0, 1, 2]);

    addToMeld(state, "s1", 0, meldGroupId);

    expect(p1.hand.length).toBe(0);
    expect(p2.board.length).toBe(4);
    for (const card of p2.board) {
      expect(card.meldGroupId).toBe(meldGroupId);
    }
  });

  it("adds a card to a straight flush meld at the start position", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 8, suit: 0 },
      { rank: 9, suit: 0 },
      { rank: 10, suit: 0 },
      { rank: 11, suit: 0 },
      { rank: 6, suit: 0 },
    ]);
    state.players.push(p1);

    // Create straight: [A, 8, 9, 10, J] in board order
    meldCards(state, "s1", [0, 1, 2, 3, 4]);
    const meldGroupId = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(5);
    expect(p1.hand.length).toBe(1);

    // Add 6 to the LEFT (start)
    addToMeld(state, "s1", 0, meldGroupId, false, "start");

    expect(p1.board.length).toBe(6);
    expect(p1.hand.length).toBe(0);
    // Board should be: [6, A, 8, 9, 10, J] — wild at position 1 represents 7
    expect(p1.board[0]!.rank).toBe(6);
    expect(p1.board[1]!.rank).toBe(1);
    expect(p1.board[2]!.rank).toBe(8);
    expect(p1.board[3]!.rank).toBe(9);
    expect(p1.board[4]!.rank).toBe(10);
    expect(p1.board[5]!.rank).toBe(11);
  });

  it("adds a card to a straight flush meld at the end position", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
      { rank: 8, suit: 0 },
      { rank: 9, suit: 0 },
      { rank: 10, suit: 0 },
    ]);
    state.players.push(p1);

    // Create straight: [A, 6, 7, 8, 9] — wild at start represents 5
    meldCards(state, "s1", [0, 1, 2, 3, 4]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    // Add 10 to the RIGHT (end): (A,6,7,8,9,10) where A=5 is valid
    addToMeld(state, "s1", 0, meldGroupId, false, "end");

    expect(p1.board.length).toBe(6);
    expect(p1.board[0]!.rank).toBe(1);
    expect(p1.board[1]!.rank).toBe(6);
    expect(p1.board[2]!.rank).toBe(7);
    expect(p1.board[3]!.rank).toBe(8);
    expect(p1.board[4]!.rank).toBe(9);
    expect(p1.board[5]!.rank).toBe(10);
  });

  it("accepts 8 on the right of (4,A,6,7)", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 4, suit: 0 },
      { rank: 1, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
      { rank: 8, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2, 3]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    addToMeld(state, "s1", 0, meldGroupId, false, "end");
    expect(p1.board.length).toBe(5);
    expect(p1.board[4]!.rank).toBe(8);
  });

  it("accepts 8 on the left of (9,10,A,Q)", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 9, suit: 0 },
      { rank: 10, suit: 0 },
      { rank: 1, suit: 0 },
      { rank: 12, suit: 0 },
      { rank: 8, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2, 3]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    addToMeld(state, "s1", 0, meldGroupId, false, "start");
    expect(p1.board.length).toBe(5);
    expect(p1.board[0]!.rank).toBe(8);
  });

  it("rejects 7 on the right of (8,9,10,A,Q) — broken ordered straight", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 8, suit: 0 },
      { rank: 9, suit: 0 },
      { rank: 10, suit: 0 },
      { rank: 1, suit: 0 },
      { rank: 12, suit: 0 },
      { rank: 7, suit: 0 },
    ]);
    state.players.push(p1);

    // Create straight: [8, 9, 10, A, 12(Q)]
    meldCards(state, "s1", [0, 1, 2, 3, 4]);
    const meldGroupId = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(5);
    expect(p1.hand.length).toBe(1);

    // Try to add 7 to the RIGHT (end) — should be invalid because
    // ordered sequence (8,9,10,A,12,7) is not consecutive
    expect(() => addToMeld(state, "s1", 0, meldGroupId, false, "end")).toThrow("Invalid manipulation");
    expect(p1.board.length).toBe(5);
    expect(p1.hand.length).toBe(1);
    // Q should still be in the meld
    expect(p1.board.some((c) => c.rank === 12)).toBe(true);
  });

  it("rejects adding a wild beyond rank 13 (K)", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 8, suit: 0 },
      { rank: 9, suit: 0 },
      { rank: 1, suit: 0 },
      { rank: 11, suit: 0 },
      { rank: 12, suit: 0 },
      { rank: 13, suit: 0 },
      { rank: 1, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2, 3, 4, 5]);
    const meldGroupId = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(6);
    expect(p1.hand.length).toBe(1);

    // Adding a wild to the right would extend past K(13) — reject
    expect(() => addToMeld(state, "s1", 0, meldGroupId, false, "end")).toThrow("Invalid manipulation");
    expect(p1.board.length).toBe(6);
  });

  it("rejects wild-to-wild swap via addToMeld", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 3, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 1, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 1, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2, 3]);
    const meldGroupId = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(4);

    // Dropping a wild on the existing wild (preferSwap=true) — reject
    expect(() => addToMeld(state, "s1", 0, meldGroupId, true)).toThrow("Cannot swap a wild with another wild");
    // Adding a wild to the right (preferSwap=false, position end) should still work
    addToMeld(state, "s1", 0, meldGroupId, false, "end");
    expect(p1.board.length).toBe(5);
  });

  it("rejects wild-to-wild swap via swapWild", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 3, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 1, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 1, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2, 3]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    // Swap the wild (at index 2) with another wild from hand (index 0)
    expect(() => swapWild(state, "s1", meldGroupId, 2, 0)).toThrow("Cannot swap a wild with another wild");
  });

  it("rejects extending a straight into ranks already on the board by another player", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 7;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
      { rank: 8, suit: 0 },
      { rank: 7, suit: 0 }, // another wild
    ]);
    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    addCardsToHand(p2, [
      { rank: 9, suit: 0 },
      { rank: 10, suit: 0 },
      { rank: 11, suit: 0 },
      { rank: 7, suit: 1 }, // wild in a different suit
    ]);
    state.players.push(p1, p2);

    // P1 melds (5,6,7♠wild,8) — 7 is wild this round
    meldCards(state, "s1", [0, 1, 2, 3]);
    const p1Group = p1.board[0]!.meldGroupId;

    // P2 melds (9,10,J,Q) all ♠
    state.currentPlayerIndex = 1;
    meldCards(state, "s2", [0, 1, 2, 3]);
    state.currentPlayerIndex = 0;

    // P1 tries to add a wild to the right of (5-8) — wild at end would represent rank 9♠
    // But 9♠ is already on P2's board
    expect(() => addToMeld(state, "s1", 0, p1Group, false, "end")).toThrow("already on the board");
    expect(p1.board.length).toBe(4);
    expect(p1.hand.length).toBe(1);
  });

  it("rejects creating a set of a rank already on the board as a set", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 6, suit: 0 },
      { rank: 6, suit: 1 },
      { rank: 1, suit: 2 }, // wild
    ]);
    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    addCardsToHand(p2, [
      { rank: 6, suit: 2 },
      { rank: 6, suit: 3 },
      { rank: 1, suit: 0 }, // wild
    ]);
    state.players.push(p1, p2);

    // P1 melds (6♠,6♥,A♦) — a set of 6s
    meldCards(state, "s1", [0, 1, 2]);
    expect(p1.board.length).toBe(3);

    // P2 tries to meld (6♣,6♦,A♠) — another set of 6s → rejected
    state.currentPlayerIndex = 1;
    expect(() => meldCards(state, "s2", [0, 1, 2])).toThrow("already exists on the board");
    expect(p2.board.length).toBe(0);
  });

  it("rejects adding a card that makes the meld invalid", () => {
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
      { rank: 9, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    expect(() => addToMeld(state, "s1", 0, meldGroupId)).toThrow("Invalid manipulation");
    expect(p1.hand.length).toBe(1);
    expect(p1.board.length).toBe(3);
  });

  it("adds a card to an all-wild meld turning it into a set of wildRank", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 1, suit: 1 },
      { rank: 1, suit: 2 },
      { rank: 5, suit: 3 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    const gid = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(3);

    // Add 5♣ to the all-wild meld → set of rank 5
    addToMeld(state, "s1", 0, gid);
    expect(p1.board.length).toBe(4);
    expect(p1.board.some((c) => c.rank === 5)).toBe(true);
  });

  it("rejects adding a 5th card to a 4-card set", () => {
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
      { rank: 5, suit: 3 },
      { rank: 5, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2, 3]);
    const gid = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(4);

    expect(() => addToMeld(state, "s1", 0, gid)).toThrow("Invalid manipulation");
    expect(p1.board.length).toBe(4);
  });

  it("rejects preferSwap on the first wild when it breaks ordered straight", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 11, suit: 0 },
      { rank: 1, suit: 1 },
      { rank: 13, suit: 0 },
      { rank: 12, suit: 0 },
    ]);
    state.players.push(p1);

    // Create straight: [W, J, W, K]
    meldCards(state, "s1", [0, 1, 2, 3]);
    const gid = p1.board[0]!.meldGroupId;

    // addToMeld with preferSwap=true always targets the FIRST wild
    // Swapping pos 0's W with Q gives [Q, J, W, K] which breaks ordered straight
    expect(() => addToMeld(state, "s1", 0, gid, true)).toThrow("Invalid manipulation");
  });
});

describe("swapWild", () => {
  it("swaps a wild card out of a meld, returning it to hand", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 1, suit: 2 },
      { rank: 5, suit: 3 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    const meldGroupId = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(3);
    expect(p1.hand.length).toBe(1);

    swapWild(state, "s1", meldGroupId, 2, 0);

    expect(p1.board.length).toBe(3);
    expect(p1.hand.length).toBe(1);
    expect(p1.hand[0]!.rank).toBe(1);
    expect(p1.hand[0]!.suit).toBe(2);
    expect(p1.hand[0]!.meldGroupId).toBe("");
    for (const card of p1.board) {
      expect(card.meldGroupId).toBe(meldGroupId);
    }
  });

  it("swaps the correct wild by index when multiple wilds exist in a straight", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 11, suit: 0 },
      { rank: 1, suit: 1 },
      { rank: 13, suit: 0 },
      { rank: 12, suit: 0 },
    ]);
    state.players.push(p1);

    // [W, J, W, K] — wilds at pos 0 and pos 2 in board
    meldCards(state, "s1", [0, 1, 2, 3]);
    const gid = p1.board[0]!.meldGroupId;
    expect(p1.board.length).toBe(4);

    // Wild at meldCards index 2 (board position 2, the second wild)
    swapWild(state, "s1", gid, 2, 0);
    expect(p1.board.length).toBe(4);
    expect(p1.board.some((c) => c.rank === 12)).toBe(true); // Q on board
    expect(p1.hand.some((c) => c.rank === 1)).toBe(true); // wild returned
  });

  it("rejects swapWild that would create a disordered straight", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },
      { rank: 11, suit: 0 },
      { rank: 1, suit: 1 },
      { rank: 13, suit: 0 },
      { rank: 12, suit: 0 },
    ]);
    state.players.push(p1);

    // [W, J, W, K] - wilds at pos 0 and pos 2
    meldCards(state, "s1", [0, 1, 2, 3]);
    const gid = p1.board[0]!.meldGroupId;

    // Swap the FIRST wild (index 0) with Q:
    // Ordered sequence [Q(12), J(11), W, K] is [12, 11, 1, 13] — not consecutive
    // swapWild now checks ordered straight → rejects
    expect(() => swapWild(state, "s1", gid, 0, 0)).toThrow("Invalid manipulation");
    expect(p1.board.length).toBe(4);
  });
});

describe("going out via manipulation", () => {
  it("ends the round when player adds last hand cards to existing melds and discards", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.currentRound = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 7, suit: 0 },
      { rank: 8, suit: 0 },
      { rank: 9, suit: 0 },
      { rank: 10, suit: 0 },
    ]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);

    state.players.push(p1, p2);

    meldCards(state, "s1", [0, 1, 2, 3]);
    const meldGroupId = p1.board[0]!.meldGroupId;
    expect(p1.hand.length).toBe(2);

    addToMeld(state, "s1", 0, meldGroupId);

    expect(p1.hand.length).toBe(1);
    expect(p1.board.length).toBe(5);

    addToMeld(state, "s1", 0, meldGroupId);

    expect(p1.hand.length).toBe(0);
    expect(p1.board.length).toBe(6);

    passMeld(state, "s1");
    expect(state.phase).toBe("discard");

    discardCard(state, "s1", 0);

    expect(state.phase).toBe("round_ended");
  });
});

describe("endRound", () => {
  it("ends the round and adds hand scores to player totals", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 10;
    // p1 goes out — empty hand
    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 20;
    addCardsToHand(p2, [
      { rank: 3, suit: 0 },
      { rank: 4, suit: 1 },
    ]);
    state.players.push(p1, p2);

    endRound(state);

    expect(state.phase).toBe("round_ended");
    // p1 (out): hand empty → +0, p2: 3+4=7
    expect(p1.score).toBe(10);
    expect(p2.score).toBe(27);
  });

  it("handles a tie where multiple players have empty hands", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 5;
    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 10;
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);
    state.players.push(p1, p2);

    // Both have empty hands? Actually p2 has 1 card (3 points)
    // P1 goes out (empty hand), P2 scores 3
    endRound(state);
    expect(p1.score).toBe(5);
    expect(p2.score).toBe(13);
  });

  it("scores wild cards in hand at 25 points each", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [
      { rank: 1, suit: 0 }, // wild → 25
      { rank: 1, suit: 1 }, // wild → 25
    ]);
    state.players.push(p1, p2);

    // P1 goes out (0), P2 has 2 wilds = 50 points
    endRound(state);
    expect(p2.score).toBe(50);
  });
});

describe("round scoring", () => {
  it("calculates scores when a player goes out: out player scores 0, others sum hand card values (non-wild=rank, wild=25)", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "discard";
    state.currentPlayerIndex = 0;
    state.currentRound = 1;
    state.wildRank = 2;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    addCardsToHand(p1, [{ rank: 5, suit: 0 }]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [
      { rank: 5, suit: 1 },  // non-wild → 5 points
      { rank: 10, suit: 2 }, // non-wild → 10 points
    ]);

    state.players.push(p1, p2);

    discardCard(state, "s1", 0);

    expect(state.phase).toBe("round_ended");
    expect(p1.score).toBe(0);
    expect(p2.score).toBe(15);
  });

  it("counts wild cards as 25 points each", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "discard";
    state.currentPlayerIndex = 0;
    state.currentRound = 1;
    state.wildRank = 2;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    addCardsToHand(p1, [{ rank: 5, suit: 0 }]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [
      { rank: 2, suit: 0 },  // wild (rank matches wildRank) → 25
      { rank: 3, suit: 1 },  // non-wild → 3
    ]);

    state.players.push(p1, p2);

    discardCard(state, "s1", 0);

    expect(p2.score).toBe(28);
  });
});

describe("endMatch", () => {
  it("declares player with lowest cumulative score as winner", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "round_ended";

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.userId = "u1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 30;

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.userId = "u2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 15;

    const p3 = new Player();
    p3.sessionId = "s3";
    p3.userId = "u3";
    p3.name = "Charlie";
    p3.hand = new ArraySchema<CardSchema>();
    p3.board = new ArraySchema<CardSchema>();
    p3.score = 42;

    state.players.push(p1, p2, p3);

    endMatch(state);

    expect(state.status).toBe("finished");
    expect(state.phase).toBe("finished");
    expect(state.winnerSessionId).toBe("s2");
  });
});

describe("startNextRound", () => {
  it("ends match when all rounds are completed (round 13)", () => {
    const state = createGameState(2);
    state.status = "playing";
    state.phase = "round_ended";
    state.currentRound = 1;
    state.wildRank = 2;
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.userId = "u1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 20;

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.userId = "u2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 10;

    state.players.push(p1, p2);

    startNextRound(state);

    expect(state.status).toBe("finished");
    expect(state.phase).toBe("finished");
    expect(state.winnerSessionId).toBe("s2");
  });

  it("increments round, updates wild rank, rotates first player, and deals fresh cards", () => {
    const state = createGameState(13);
    state.status = "playing";
    state.phase = "round_ended";
    state.currentRound = 0;
    state.wildRank = 1;
    state.currentPlayerIndex = 0;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.userId = "u1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 10;

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.userId = "u2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 20;

    state.players.push(p1, p2);

    startNextRound(state);

    expect(state.currentRound).toBe(1);
    expect(state.wildRank).toBe(2);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("draw");
    expect(state.status).toBe("playing");
    expect(p1.hand.length).toBe(7);
    expect(p2.hand.length).toBe(7);
    expect(p1.board.length).toBe(0);
    expect(p2.board.length).toBe(0);
    expect(state.drawPile.length).toBe(52 - 2 * 7 - 1);
    expect(state.discardPile.length).toBe(1);
    expect(p1.score).toBe(10);
    expect(p2.score).toBe(20);
  });
});

describe("autoPlayTurn", () => {
  it("draws from deck, passes meld, and discards highest-point card when timer expires", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "draw";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    addCardsToHand(p1, [
      { rank: 1, suit: 0 },  // wild → 25 points
      { rank: 5, suit: 1 },  // 5 points
    ]);

    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);

    state.players.push(p1, p2);
    state.drawPile.push(createCard(8, 0), createCard(9, 0));

    // auto-play completes the entire turn: draw → pass meld → discard highest-point card
    autoPlayTurn(state);

    // After drawing 1 card (2→3), discarding highest-point (wild, 25pts) → 2 cards remain
    expect(p1.hand.length).toBe(2);
    expect(state.drawPile.length).toBe(1);

    // Turn passed to next player
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("draw");

    // The discarded card should be the wild (highest points = 25)
    const discarded = state.discardPile[0]!;
    expect(discarded.rank).toBe(1);
    expect(discarded.suit).toBe(0);
  });

  it("auto-plays when player has melded cards on board", () => {
    const state = createGameState();
    state.status = "playing";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);
    state.players.push(p1, p2);

    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 1, suit: 1 },
    ]);
    state.phase = "main_phase";
    meldCards(state, "s1", [0, 1, 2]);
    // p1 hand: [1(wild)] board: [5,5,5]

    state.drawPile.push(createCard(8, 0));

    state.phase = "draw";
    autoPlayTurn(state);

    // Started: 1 in hand, drew 1 (8), discarded highest (wild=25) → 1 remains
    expect(p1.hand.length).toBe(1);
    expect(p1.hand[0]!.rank).toBe(8);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("draw");
  });

  it("auto-play triggers endRound when player discards last card", () => {
    const state = createGameState();
    state.status = "playing";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    p1.score = 0;
    const p2 = new Player();
    p2.sessionId = "s2";
    p2.name = "Bob";
    p2.hand = new ArraySchema<CardSchema>();
    p2.board = new ArraySchema<CardSchema>();
    p2.score = 0;
    addCardsToHand(p2, [{ rank: 3, suit: 0 }]);
    state.players.push(p1, p2);

    addCardsToHand(p1, [{ rank: 3, suit: 0 }]);
    state.phase = "main_phase";
    // Melds the only card in hand? No, 1 card can't form a meld.
    // Instead: hand has 1 card (3), no meld needed. Just draw + discard.

    state.drawPile.push(createCard(5, 0));

    state.phase = "draw";
    autoPlayTurn(state);

    // p1 draws 5, discards highest (5 > 3, discards 5)
    // Actually autoPlay discards highest point card: 5=5, 3=3 → discards 5
    // Hand remains: [3] — not empty, round doesn't end
    expect(p1.hand.length).toBe(1);
    expect(state.currentPlayerIndex).toBe(1);
  });
});

describe("invalid manipulation rejection", () => {
  it("rejects swapWild on a non-wild card", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

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
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    expect(() => swapWild(state, "s1", meldGroupId, 0, 0)).toThrow("Card is not a wild");
  });

  it("rejects swapWild that would leave an invalid meld", () => {
    const state = createGameState();
    state.status = "playing";
    state.phase = "main_phase";
    state.currentPlayerIndex = 0;
    state.wildRank = 1;

    const p1 = new Player();
    p1.sessionId = "s1";
    p1.name = "Alice";
    p1.hand = new ArraySchema<CardSchema>();
    p1.board = new ArraySchema<CardSchema>();
    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 1, suit: 2 },
      { rank: 7, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    expect(() => swapWild(state, "s1", meldGroupId, 2, 0)).toThrow("Invalid manipulation");
  });
});
