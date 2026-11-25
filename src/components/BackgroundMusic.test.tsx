import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundMusic } from "./BackgroundMusic";

describe("BackgroundMusic", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("uses the practice track by default and loops it", () => {
    const { container } = render(<BackgroundMusic />);
    const audio = container.querySelector("audio");
    expect(audio).toHaveAttribute("src", "/audio/bach-cello-suite-no-1-prelude-dark.mp3");
    expect(audio).toHaveAttribute("loop");
    expect(screen.getByLabelText("Background music volume")).toHaveValue("0.35");
  });

  it("plays, switches modes, mutes, and changes volume", async () => {
    const { container } = render(<BackgroundMusic />);
    const audio = container.querySelector("audio")!;

    fireEvent.click(screen.getByRole("button", { name: "Play background music" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause background music" })).toBeInTheDocument());
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "40 Hz" }));
    expect(audio).toHaveAttribute("src", "/audio/focus-40hz.mp3");

    fireEvent.click(screen.getByRole("button", { name: "Mute background music" }));
    await waitFor(() => expect(audio.muted).toBe(true));

    fireEvent.change(screen.getByLabelText("Background music volume"), { target: { value: "0.6" } });
    await waitFor(() => {
      expect(audio.volume).toBe(0.6);
      expect(audio.muted).toBe(false);
    });
  });
});
