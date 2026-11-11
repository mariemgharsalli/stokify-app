import { beforeEach, describe, expect, it } from "vitest";
import { feedback, unlockAudio } from "../lib/feedback";
import { useTerrainStore } from "../store/terrainStore";

describe("feedback", () => {
  beforeEach(() => {
    useTerrainStore.setState({ soundOn: true, hapticsOn: true });
  });

  it("ne lève pas sans AudioContext ni vibrate", () => {
    const previousAudio = window.AudioContext;
    const previousWebkit = window.webkitAudioContext;
    const previousVibrate = navigator.vibrate;
    try {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: undefined,
      });
      expect(() => {
        unlockAudio();
        feedback.success();
        feedback.warn();
        feedback.error();
      }).not.toThrow();
    } finally {
      window.AudioContext = previousAudio;
      window.webkitAudioContext = previousWebkit;
      if (previousVibrate) {
        Object.defineProperty(navigator, "vibrate", { configurable: true, value: previousVibrate });
      }
    }
  });

  it("absorbe un vibrate qui lève", () => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: () => {
        throw new Error("indisponible");
      },
    });
    expect(() => feedback.error()).not.toThrow();
  });
});
