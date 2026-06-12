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
  const container = document.body.querySelector('[style*="flex-wrap: wrap"][style*="justify-content: center"]');
  if (!container) return [];
  return Array.from(container.querySelectorAll('[style*="width: 56px"][style*="height: 80px"]')) as HTMLElement[];
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
  it("displays hand cards and Pass Meld button", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phase:/)).toBeInTheDocument();
    });

    const cards = getHandCardElements();
    expect(cards.length).toBe(3);

    expect(screen.getByRole("button", { name: /pass meld/i })).toBeInTheDocument();
  });

  it("staging well is visible when in main_phase", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Drop cards here to meld/i)).toBeInTheDocument();
    });
  });

  it("shows error message when meld_error is received", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phase:/)).toBeInTheDocument();
    });

    const errorHandler = messageHandlers.get("meld_error");
    expect(errorHandler).toBeDefined();

    errorHandler!({ message: "Invalid meld" });

    await waitFor(() => {
      expect(screen.getByText("Invalid meld")).toBeInTheDocument();
    });
  });

  it("sends pass_meld when Pass Meld is clicked", async () => {
    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phase:/)).toBeInTheDocument();
    });

    const passBtn = screen.getByRole("button", { name: /pass meld/i });
    await userEvent.click(passBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("pass_meld");

    mockRoom.state.phase = "discard";
    onStateChangeCallback();

    await waitFor(() => {
      expect(screen.getByText(/Phase:.*Discard/)).toBeInTheDocument();
    });
  });

  it("shows Add to Meld button when own player has melds", async () => {
    mockRoom.state.players[0].board = [
      { rank: 4, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add to meld/i })).toBeInTheDocument();
    });
  });

  it("cancel button clears add mode", async () => {
    mockRoom.state.players[0].board = [
      { rank: 4, suit: 0, meldGroupId: "meld-1" },
      { rank: 5, suit: 0, meldGroupId: "meld-1" },
      { rank: 6, suit: 0, meldGroupId: "meld-1" },
    ];

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add to meld/i })).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add to meld/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/click a meld group/i)).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText(/click a meld group/i)).not.toBeInTheDocument();
    });
  });
});

describe("GameRoomPage draw and discard phases", () => {
  it("shows draw pile as clickable during draw phase", async () => {
    mockRoom.state.phase = "draw";

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phase:.*Draw/)).toBeInTheDocument();
    });

    const drawLabel = screen.getByText("Draw");
    expect(drawLabel).toBeInTheDocument();
  });

  it("shows timer bar", async () => {
    mockRoom.state.phase = "draw";

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phase:.*Draw/)).toBeInTheDocument();
    });

    const timerBars = document.body.querySelectorAll('[style*="height: 4px"]');
    expect(timerBars.length).toBeGreaterThan(0);
  });

  it("hand cards are clickable during discard phase for discarding", async () => {
    mockRoom.state.phase = "discard";

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phase:.*Discard/)).toBeInTheDocument();
    });

    const cards = getHandCardElements();
    expect(cards.length).toBe(3);

    await userEvent.click(cards[0]);
    expect(mockRoomSend).toHaveBeenCalledWith("discard", { cardIndex: 0 });
  });

  it("draw from deck button is present during draw phase", async () => {
    mockRoom.state.phase = "draw";

    render(<GameRoomPage />);

    await waitFor(() => {
      expect(screen.getByText("Draw")).toBeInTheDocument();
    });

    const drawSection = screen.getByText("Draw").closest("div")!;
    const faceDownCards = drawSection.querySelectorAll('[style*="repeating-linear-gradient"]');
    expect(faceDownCards.length).toBeGreaterThan(0);
  });
});

describe("GameRoomPage round end and match finish", () => {
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
  });
});

describe("GameRoomPage waiting state", () => {
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

    const rows = screen.getAllByRole("row");
    const scoreRows = rows.filter((r) => !r.querySelector("th"));
    expect(scoreRows[0]).toHaveTextContent(/1.*Bob.*15/);
    expect(scoreRows[1]).toHaveTextContent(/2.*Alice.*30/);
    expect(scoreRows[2]).toHaveTextContent(/3.*Charlie.*42/);

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
      expect(screen.getByText(/Waiting for players/)).toBeInTheDocument();
    });

    const startBtn = screen.getByRole("button", { name: /start game/i });
    expect(startBtn).toBeInTheDocument();

    await userEvent.click(startBtn);

    expect(mockRoomSend).toHaveBeenCalledWith("start_game");
  });
});
