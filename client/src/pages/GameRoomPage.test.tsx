import { render, screen, waitFor } from "@testing-library/react";
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
});
