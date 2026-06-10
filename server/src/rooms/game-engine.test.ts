import { describe, it, expect } from "vitest";
import { ArraySchema } from "@colyseus/schema";
import { GameState, Player, createGameState, CardSchema, createCard } from "./GameState";
import { startGame, drawFromDeck, drawFromDiscard, meldCards, passMeld, discardCard, isWild, canMeld, addToMeld, swapWild, rearrangeMelds } from "./game-engine";

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
});

describe("rearrangeMelds", () => {
  type CardRef = { source: string; index: number };

  it("dissolves two 3-of-a-kind melds and reforms as two 4-of-a-kind with hand cards", () => {
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
    state.players.push(p1);

    addCardsToHand(p1, [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 8, suit: 0 },
      { rank: 8, suit: 1 },
      { rank: 8, suit: 2 },
    ]);
    meldCards(state, "s1", [0, 1, 2]);
    const meldAId = p1.board[0]!.meldGroupId;
    meldCards(state, "s1", [0, 1, 2]); // next 3 cards (indices shifted after first meld)
    const meldBId = p1.board[3]!.meldGroupId;
    expect(p1.board.length).toBe(6);
    expect(p1.hand.length).toBe(0);

    addCardsToHand(p1, [
      { rank: 5, suit: 3 },
      { rank: 8, suit: 3 },
    ]);

    const newMelds: CardRef[][] = [
      [
        { source: meldAId, index: 0 },
        { source: meldAId, index: 1 },
        { source: meldAId, index: 2 },
        { source: "hand", index: 0 },
      ],
      [
        { source: meldBId, index: 0 },
        { source: meldBId, index: 1 },
        { source: meldBId, index: 2 },
        { source: "hand", index: 1 },
      ],
    ];

    rearrangeMelds(state, "s1", newMelds);

    expect(p1.board.length).toBe(8);
    expect(p1.hand.length).toBe(0);

    const meldIds = new Set(p1.board.map((c) => c.meldGroupId));
    expect(meldIds.size).toBe(2);
    for (const meldId of meldIds) {
      const cards = p1.board.filter((c) => c.meldGroupId === meldId);
      expect(cards.length).toBe(4);
      expect(canMeld(cards, state.wildRank)).toBe(true);
    }
  });
});

describe("going out via manipulation", () => {
  it("ends the game when player adds last hand cards to existing melds and discards", () => {
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

    expect(state.status).toBe("finished");
    expect(state.phase).toBe("finished");
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

  it("rejects rearrangeMelds that creates invalid melds", () => {
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
      { rank: 7, suit: 0 },
    ]);
    state.players.push(p1);

    meldCards(state, "s1", [0, 1, 2]);
    const meldGroupId = p1.board[0]!.meldGroupId;

    expect(() => rearrangeMelds(state, "s1", [
      [{ source: meldGroupId, index: 0 }, { source: "hand", index: 0 }],
    ])).toThrow("Invalid manipulation");
  });
});
