import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GameRoomPage from "./GameRoomPage";

const mockNavigate = vi.fn();
const mockRoomSend = vi.fn();
const mockRoomLeave = vi.fn();
const mockOnStateChangeRemove = vi.fn();

let mockRoom: any;
let onStateChangeCallback: Function;
let messageHandlers: Map<string, Function>;

vi.mock("react-router-dom", () => ({
  useParams: () => ({ roomId: "test-room" }),
  useNavigate: () => mockNavigate,
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

const mockJoinById = vi.fn();
vi.mock("../auth/colyseus", () => ({
  createColyseusClient: () => ({
    joinById: mockJoinById,
  }),
}));

function getHandCardElements(): HTMLElement[] {
  const handHeading = screen.queryByText("Your Hand");
  if (!handHeading) return [];
  const section = handHeading.closest("div")!;
  const suitEls = section.querySelectorAll('[style*="width: 56"]');
  return Array.from(suitEls) as HTMLElement[];
}

beforeEach(() => {
  vi.clearAllMocks();
  onStateChangeCallback = vi.fn();
  messageHandlers = new Map();

  mockRoom = {
    sessionId: "my-session",
    state: {
      status: "playing",
      phase: "main_phase",
      currentRound: 0,
      wildRank: 13,
      currentPlayerIndex: 0,
      winnerSessionId: "",
      players: [
        {
          sessionId: "my-session",
          userId: "user1",
          name: "Player 1",
          score: 0,
          disconnected: false,
          hand: [
            { rank: 1, suit: 0, meldGroupId: "" },
            { rank: 2, suit: 0, meldGroupId: "" },
            { rank: 3, suit: 0, meldGroupId: "" },
          ],
          board: [],
        },
        {
          sessionId: "other-session",
          userId: "user2",
          name: "Player 2",
          score: 0,
          disconnected: false,
          hand: [],
          board: [],
        },
      ],
      drawPile: [{ rank: 10, suit: 2, meldGroupId: "" }],
      discardPile: [{ rank: 8, suit: 3, meldGroupId: "" }],
    },
    send: mockRoomSend,
    onStateChange: Object.assign(
      (cb: Function) => {
        onStateChangeCallback = cb;
      },
      { remove: mockOnStateChangeRemove },
    ),
    onMessage: vi.fn((channel: string, cb: Function) => {
      messageHandlers.set(channel, cb);
    }),
    leave: mockRoomLeave,
    id: "test-room",
  };

  mockJoinById.mockResolvedValue(mockRoom);
});

describe("GameRoomPage meld phase", () => {
  it("toggles card selection when clicking hand cards", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const cards = getHandCardElements();
    expect(cards.length).toBeGreaterThanOrEqual(1);

    const firstCard = cards[0];

    await userEvent.click(firstCard);

    await waitFor(() => {
      expect(firstCard.style.border).toBe("2px solid rgb(255, 255, 0)");
    });

    await userEvent.click(firstCard);

    await waitFor(() => {
      expect(firstCard.style.border).toBe("2px solid rgb(153, 153, 153)");
    });
  });

  it("shows Meld button with count and sends cardIndices on click", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const meldBtn = screen.getByRole("button", { name: /^meld/i });
    expect(meldBtn).toBeInTheDocument();
    expect(meldBtn).toBeDisabled();
    expect(meldBtn).toHaveTextContent("Meld (0)");

    const cards = getHandCardElements();
    await userEvent.click(cards[0]);

    await waitFor(() => {
      expect(meldBtn).toHaveTextContent("Meld (1)");
    });

    await userEvent.click(cards[1]);

    await waitFor(() => {
      expect(meldBtn).toHaveTextContent("Meld (2)");
    });

    await userEvent.click(meldBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("meld", { cardIndices: [0, 1] });

    await waitFor(() => {
      expect(meldBtn).toHaveTextContent("Meld (0)");
    });
  });

  it("shows error message when meld_error is received", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const errorHandler = messageHandlers.get("meld_error");
    expect(errorHandler).toBeDefined();

    errorHandler!({ message: "Invalid meld" });

    await waitFor(() => {
      expect(screen.getByText("Invalid meld")).toBeInTheDocument();
    });
  });

  it("clears meld error when toggling card selection", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const errorHandler = messageHandlers.get("meld_error");
    errorHandler!({ message: "Invalid meld" });

    await waitFor(() => {
      expect(screen.getByText("Invalid meld")).toBeInTheDocument();
    });

    const cards = getHandCardElements();
    await userEvent.click(cards[0]);

      await waitFor(() => {
        expect(screen.queryByText("Invalid meld")).not.toBeInTheDocument();
      });
  });

  it("sends pass_meld and transitions to discard phase", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const passBtn = screen.getByRole("button", { name: /pass meld/i });
    expect(passBtn).toBeInTheDocument();

    await userEvent.click(passBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("pass_meld");

    mockRoom.state.phase = "discard";
    onStateChangeCallback();

    await waitFor(() => {
      expect(screen.getByText(/Phase:.*discard/)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /^meld/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pass meld/i })).not.toBeInTheDocument();
  });

  it("updates board with new meld and stays in meld phase after valid meld", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    expect(screen.getByText("No melds yet")).toBeInTheDocument();

    const cards = getHandCardElements();
    await userEvent.click(cards[0]);
    await userEvent.click(cards[1]);

    const meldBtn = screen.getByRole("button", { name: /^meld/i });
    await userEvent.click(meldBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("meld", { cardIndices: [0, 1] });

    const player = mockRoom.state.players[0];
    const meldedCards = [player.hand[0], player.hand[1]];
    player.hand = [player.hand[2]];
    const groupId = "meld-1";
    for (const card of meldedCards) {
      card.meldGroupId = groupId;
      player.board.push(card);
    }
    onStateChangeCallback();

    await waitFor(() => {
      expect(screen.queryByText("No melds yet")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      const handCards = getHandCardElements();
      expect(handCards.length).toBe(1);
    });

    expect(screen.getByRole("button", { name: /^meld/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pass meld/i })).toBeInTheDocument();

    expect(mockRoom.state.phase).toBe("main_phase");
  });

  it("sends add_to_meld when clicking hand card then meld group", async () => {
    mockRoom.state.players[0].board = [
      { rank: 4, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add to meld/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/adding to meld/i)).toBeInTheDocument();
    });

    const cards = getHandCardElements();
    await userEvent.click(cards[0]);

    const meldGroup = screen.getByTestId("meld-group-meld-1");
    await userEvent.click(meldGroup);

    expect(mockRoomSend).toHaveBeenCalledWith("add_to_meld", {
      cardIndex: 0,
      meldGroupId: "meld-1",
    });
  });

  it("sends swap_wild when clicking wild on board then hand card", async () => {
    mockRoom.state.players[0].board = [
      { rank: 13, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const meldGroup = screen.getByTestId("meld-group-meld-1");
    const wildBadge = within(meldGroup).getByText("W");
    await userEvent.click(wildBadge);

    await waitFor(() => {
      expect(screen.getByText(/swapping wild/i)).toBeInTheDocument();
    });

    const cards = getHandCardElements();
    await userEvent.click(cards[0]);

    expect(mockRoomSend).toHaveBeenCalledWith("swap_wild", {
      meldGroupId: "meld-1",
      meldCardIndex: 0,
      handCardIndex: 0,
    });
  });

  it("sends rearrange_melds when clicking rearrange then Done", async () => {
    mockRoom.state.players[0].board = [
      { rank: 4, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const rearrangeBtn = screen.getByRole("button", { name: /rearrange/i });
    await userEvent.click(rearrangeBtn);

    await waitFor(() => {
      expect(screen.getByText(/rearranging/i)).toBeInTheDocument();
    });

    const doneBtn = screen.getByRole("button", { name: /done/i });
    await userEvent.click(doneBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("rearrange_melds", {
      newMelds: [
        [
          { source: "meld-1", index: 0 },
          { source: "meld-1", index: 1 },
          { source: "meld-1", index: 2 },
        ],
      ],
    });
  });

  it("updates board meld visually after add_to_meld state change", async () => {
    mockRoom.state.players[0].board = [
      { rank: 4, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add to meld/i });
    await userEvent.click(addBtn);

    const cards = getHandCardElements();
    expect(cards.length).toBe(3);
    await userEvent.click(cards[0]);

    const meldGroup = screen.getByTestId("meld-group-meld-1");
    await userEvent.click(meldGroup);

    const player = mockRoom.state.players[0];
    const addedCard = player.hand.splice(0, 1)[0];
    addedCard.meldGroupId = "meld-1";
    player.board.push(addedCard);
    onStateChangeCallback();

    await waitFor(() => {
      const handCards = getHandCardElements();
      expect(handCards.length).toBe(2);
    });

    const updatedGroup = screen.getByTestId("meld-group-meld-1");
    const groupCards = updatedGroup.querySelectorAll('[style*="width: 56"]');
    expect(groupCards.length).toBe(4);
  });

  it("updates board and hand visually after swap_wild state change", async () => {
    mockRoom.state.players[0].board = [
      { rank: 13, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const meldGroup = screen.getByTestId("meld-group-meld-1");
    const wildBadge = within(meldGroup).getByText("W");
    await userEvent.click(wildBadge);

    await waitFor(() => {
      expect(screen.getByText(/swapping wild/i)).toBeInTheDocument();
    });

    const handCards = getHandCardElements();
    await userEvent.click(handCards[0]);

    const player = mockRoom.state.players[0];
    const wildCard = player.board.splice(0, 1)[0];
    const usedHandCard = player.hand.splice(0, 1)[0];
    usedHandCard.meldGroupId = "meld-1";
    player.board.push(usedHandCard);
    player.hand.push(wildCard);
    wildCard.meldGroupId = "";
    onStateChangeCallback();

    await waitFor(() => {
      const updatedHand = getHandCardElements();
      expect(updatedHand.length).toBe(3);
    });

    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("click-to-move card between meld groups in rearrange mode", async () => {
    mockRoom.state.players[0].board = [
      { rank: 4, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 7, suit: 0, meldGroupId: "meld-2" },
      { rank: 8, suit: 0, meldGroupId: "meld-2" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const rearrangeBtn = screen.getByRole("button", { name: /rearrange/i });
    await userEvent.click(rearrangeBtn);

    await waitFor(() => {
      expect(screen.getByText(/rearranging/i)).toBeInTheDocument();
    });

    const meldGroup2 = screen.getByTestId("meld-group-meld-2");
    const group2Cards = meldGroup2.querySelectorAll('[style*="width: 56"]');
    await userEvent.click(group2Cards[0]);

    const meldGroup1 = screen.getByTestId("meld-group-meld-1");
    await userEvent.click(meldGroup1);

    const doneBtn = screen.getByRole("button", { name: /done/i });
    await userEvent.click(doneBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("rearrange_melds", {
      newMelds: [
        [
          { source: "meld-1", index: 0 },
          { source: "meld-1", index: 1 },
          { source: "meld-2", index: 0 },
        ],
        [
          { source: "meld-2", index: 1 },
        ],
      ],
    });
  });

  it("cancel button clears interaction mode", async () => {
    mockRoom.state.players[0].board = [
      { rank: 4, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add to meld/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/adding to meld/i)).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText(/adding to meld/i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /add to meld/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^meld/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pass meld/i })).toBeInTheDocument();
  });
});

describe("GameRoomPage waiting state", () => {
  it("shows round summary overlay with round scores when phase is round_ended", async () => {
    mockRoom.state.status = "playing";
    mockRoom.state.phase = "round_ended";
    mockRoom.state.currentRound = 2;
    mockRoom.state.wildRank = 3;
    mockRoom.state.players = [
      { sessionId: "s1", userId: "u1", name: "Alice", score: 25, disconnected: false, hand: [], board: [] },
      {
        sessionId: "s2", userId: "u2", name: "Bob", score: 15, disconnected: false,
        hand: [{ rank: 5, suit: 0, meldGroupId: "" }, { rank: 10, suit: 1, meldGroupId: "" }],
        board: [],
      },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Round 3 Summary")).toBeInTheDocument();
    });

    const roundSummary = screen.getByText("Round 3 Summary").closest("div")!;
    expect(within(roundSummary).getByText("Wild: 3")).toBeInTheDocument();

    expect(within(roundSummary).getByText("Alice")).toBeInTheDocument();
    expect(within(roundSummary).getByText("Bob")).toBeInTheDocument();

    expect(within(roundSummary).getByText("0")).toBeInTheDocument();
    expect(within(roundSummary).getAllByText("15")).toHaveLength(2);
  });

  it("shows turn timer bar when it is your turn", async () => {
    mockRoom.state.phase = "draw";
    mockRoom.state.currentPlayerIndex = 0;
    mockRoom.state.players = [
      { sessionId: "my-session", userId: "u1", name: "Alice", score: 0, disconnected: false, hand: [{ rank: 5, suit: 0, meldGroupId: "" }], board: [] },
      { sessionId: "s2", userId: "u2", name: "Bob", score: 0, disconnected: false, hand: [], board: [] },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByTestId("turn-timer")).toBeInTheDocument();
    });
  });

  it("shows waiting message when it is not your turn", async () => {
    mockRoom.state.phase = "draw";
    mockRoom.state.currentPlayerIndex = 1;
    mockRoom.state.players = [
      { sessionId: "my-session", userId: "u1", name: "Alice", score: 0, disconnected: false, hand: [], board: [] },
      { sessionId: "s2", userId: "u2", name: "Bob", score: 0, disconnected: false, hand: [{ rank: 5, suit: 0, meldGroupId: "" }], board: [] },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Waiting for Bob/)).toBeInTheDocument();
    });
  });

  it("shows disconnected badge for disconnected player", async () => {
    mockRoom.state.status = "playing";
    mockRoom.state.phase = "main_phase";
    mockRoom.state.players = [
      { sessionId: "my-session", userId: "u1", name: "Alice", score: 0, disconnected: false, hand: [], board: [] },
      { sessionId: "s2", userId: "u2", name: "Bob", score: 0, disconnected: true, hand: [], board: [] },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Game Board")).toBeInTheDocument();
    });

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows match end screen with winner and sorted scores", async () => {
    mockRoom.state.status = "finished";
    mockRoom.state.phase = "finished";
    mockRoom.state.winnerSessionId = "s2";
    mockRoom.state.players = [
      { sessionId: "s1", userId: "u1", name: "Alice", score: 30, disconnected: false, hand: [], board: [] },
      { sessionId: "s2", userId: "u2", name: "Bob", score: 15, disconnected: false, hand: [], board: [] },
      { sessionId: "s3", userId: "u3", name: "Charlie", score: 42, disconnected: false, hand: [], board: [] },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Match Over!")).toBeInTheDocument();
    });

    expect(screen.getByText(/Winner:.*Bob/)).toBeInTheDocument();

    const scores = screen.getAllByRole("listitem");
    expect(scores[0]).toHaveTextContent(/Bob/);
    expect(scores[1]).toHaveTextContent(/Alice/);
    expect(scores[2]).toHaveTextContent(/Charlie/);

    expect(screen.getByRole("button", { name: /back to lobby/i })).toBeInTheDocument();
  });

  it("renders Start Game button when 3+ players and sends start_game on click", async () => {
    mockRoom.state.status = "waiting";
    mockRoom.state.phase = "waiting";
    mockRoom.state.players = [
      { sessionId: "s1", userId: "u1", name: "Alice", score: 0, disconnected: false, hand: [], board: [] },
      { sessionId: "s2", userId: "u2", name: "Bob", score: 0, disconnected: false, hand: [], board: [] },
      { sessionId: "s3", userId: "u3", name: "Charlie", score: 0, disconnected: false, hand: [], board: [] },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Room:/)).toBeInTheDocument();
    });

    const startBtn = screen.getByRole("button", { name: /start game/i });
    expect(startBtn).toBeInTheDocument();

    await userEvent.click(startBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("start_game");
  });
});
