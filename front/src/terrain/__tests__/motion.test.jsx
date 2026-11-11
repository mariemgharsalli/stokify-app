import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CountUp from "../motion/CountUp";
import ErrorShake from "../motion/ErrorShake";
import ProgressRing from "../motion/ProgressRing";
import PulseDot from "../motion/PulseDot";
import SheetSpring from "../motion/SheetSpring";
import Skeleton from "../motion/Skeleton";
import StaggerList from "../motion/StaggerList";
import SuccessMark from "../motion/SuccessMark";
import {
  checkDraw,
  motionShifts,
  pageEnter,
  ringMotion,
  shakeAnimate,
  shakeTransition,
  sheetMotion,
  shouldCommitSwipe,
  shouldDismissSheet,
  staggerItem,
  stepMotion,
} from "../motion/presets";
import CompletionBar from "../motion/CompletionBar";
import SwipeRow from "../motion/SwipeRow";
import { fr } from "../strings/fr";

describe("mouvement réduit", () => {
  it("n'applique aucune translation quand le mouvement est réduit", () => {
    expect(motionShifts(pageEnter(true))).toBe(false);
    expect(motionShifts(sheetMotion(true))).toBe(false);
    expect(motionShifts(checkDraw(true))).toBe(false);
    expect(motionShifts(staggerItem(true, 0))).toBe(false);
    expect(shakeAnimate(true, true)).toEqual({ opacity: 1 });
    expect(ringMotion(true, 0.4).initial).toBe(false);
    expect(shakeTransition(false).duration).toBeLessThanOrEqual(0.3);
    expect(staggerItem(false, 7).transition.delay).toBeCloseTo(0.28);
    expect(motionShifts(staggerItem(false, 8))).toBe(false);
    expect(shouldDismissSheet(121, 0)).toBe(true);
    expect(shouldDismissSheet(10, 801)).toBe(true);
    expect(shouldDismissSheet(10, 100)).toBe(false);
    expect(shouldCommitSwipe(-80, 0)).toBe(true);
    expect(shouldCommitSwipe(-10, -900)).toBe(true);
    expect(shouldCommitSwipe(-10, -10)).toBe(false);
    expect(motionShifts(stepMotion(true, true))).toBe(false);
    expect(motionShifts(stepMotion(false, true))).toBe(true);
    expect(motionShifts(stepMotion(false, false))).toBe(false);
  });
});

describe("composants de mouvement", () => {
  it("affiche le nombre final, l'anneau et le squelette sans translation", () => {
    const { container } = render(
      <>
        <CountUp value={12} label="réceptions" />
        <ProgressRing progress={0.5} label="Journée" />
        <Skeleton />
      </>
    );
    expect(screen.getByLabelText("réceptions")).toHaveTextContent("12");
    expect(screen.getByRole("img", { name: "Journée" })).toBeInTheDocument();
    expect(container.querySelector(".terrain-skeleton")).toHaveClass("is-still");
  });

  it("rend la coche, le point live et la liste", () => {
    render(
      <>
        <SuccessMark />
        <PulseDot tone="live" label="En ligne" />
        <ErrorShake active>
          <span>code refusé</span>
        </ErrorShake>
        <StaggerList
          label="lots"
          items={[{ id: "a" }, { id: "b" }]}
          renderItem={(item) => <span>{item.id}</span>}
        />
      </>
    );
    expect(screen.getByRole("img", { name: fr.successDone })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("En ligne");
    expect(screen.getByText("code refusé")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "lots" })).toBeInTheDocument();
    const { container } = render(
      <>
        <CompletionBar ratio={0.5} label="2 sur 4" />
        <SwipeRow actionLabel="Ouvrir" onAction={() => {}}>
          <button type="button">Ouvrir</button>
        </SwipeRow>
      </>
    );
    expect(screen.getByRole("meter", { name: "2 sur 4" })).toHaveAttribute("aria-valuenow", "50");
    expect(container.querySelector(".terrain-meter-fill")).toHaveClass("is-still");
    expect(screen.getAllByRole("button", { name: "Ouvrir" })).toHaveLength(1);
  });

  it("ferme la feuille par le bouton et par Échap", () => {
    const onClose = vi.fn();
    render(
      <SheetSpring title="Résultat" onClose={onClose}>
        <p>fiche</p>
      </SheetSpring>
    );
    expect(screen.getByRole("dialog", { name: "Résultat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: fr.close }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
