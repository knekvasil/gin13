import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerChip from "./PlayerChip";

describe("PlayerChip", () => {
  it("renders timer bar with correct width when timerPct is provided", () => {
    const player = { name: "Alice", score: 42, disconnected: false };
    const { container } = render(
      <PlayerChip player={player} isTurn timerPct={60} />,
    );
    const bar = container.querySelector(".rounded-lg.h-full");
    expect(bar).toBeTruthy();
    expect((bar as HTMLElement).style.width).toBe("60%");
  });

  it("does not render timer bar when timerPct is null", () => {
    const player = { name: "Alice", score: 42, disconnected: false };
    const { container } = render(
      <PlayerChip player={player} isTurn timerPct={undefined} />,
    );
    const bar = container.querySelector(".rounded-lg.h-full");
    expect(bar).toBeFalsy();
  });
});
