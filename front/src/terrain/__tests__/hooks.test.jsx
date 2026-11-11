import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { useWakeLock } from "../lib/useWakeLock";

function OnlineProbe() {
  const online = useOnlineStatus();
  return <span>{online ? "on" : "off"}</span>;
}

function WakeProbe() {
  useWakeLock(true);
  return null;
}

describe("hooks terrain", () => {
  afterEach(() => {
    delete navigator.wakeLock;
  });

  it("suit les événements en ligne et hors ligne", () => {
    render(<OnlineProbe />);
    expect(screen.getByText("on")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText("off")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByText("on")).toBeInTheDocument();
  });

  it("ne fait rien si wakeLock est absent", () => {
    expect(() => render(<WakeProbe />)).not.toThrow();
  });

  it("demande le verrou écran et le relâche", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    navigator.wakeLock = { request };

    const view = render(<WakeProbe />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledWith("screen");

    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(release).toHaveBeenCalled();
  });
});
