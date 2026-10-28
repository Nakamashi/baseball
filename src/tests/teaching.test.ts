import { describe, it, expect } from "vitest";
import { scenarios } from "../scenarios";
import { catalogueChoices, situationKey } from "../simulation/catalogue";
import { tickPlayback } from "../hooks/usePlayback";
import { sample } from "../simulation/timeline";
describe("guided catalogue", () => {
  it("offers only populated situations in every category", () => {
    for (const category of [
      "all",
      ...new Set(scenarios.map((s) => s.category)),
    ]) {
      const choices = catalogueChoices(scenarios, category, "");
      expect(choices.plays.length).toBeGreaterThan(0);
      for (const situation of choices.situations) {
        const result = catalogueChoices(
          scenarios,
          category,
          situationKey(situation),
        );
        expect(result.plays.length).toBeGreaterThan(0);
        expect(
          result.plays.every(
            (s) => category === "all" || s.category === category,
          ),
        ).toBe(true);
        expect(
          result.plays.every(
            (s) => situationKey(s) === situationKey(situation),
          ),
        ).toBe(true);
      }
    }
  });
  it("recovers a previous incompatible situation when the category changes", () => {
    const result = catalogueChoices(scenarios, "Bunts", "2:3");
    expect(result.plays.map((s) => s.id)).toEqual(["23", "24"]);
  });
});
describe("reading time", () => {
  const s = scenarios[5];
  it("pauses at the next phase even when a frame crosses several phases", () => {
    const result = tickPlayback(s, 0, 30, 2, "step");
    expect(result).toEqual({ time: s.phases[1].start, stopped: true });
    expect(sample(s, result.time).phase.id).toBe(s.phases[1].id);
  });
  it("resumes through one more phase from a boundary", () =>
    expect(tickPlayback(s, s.phases[1].start, 30, 1, "step")).toEqual({
      time: s.phases[2].start,
      stopped: true,
    }));
  it("does not skip a boundary when the frame starts a few milliseconds before it", () =>
    expect(tickPlayback(s, 1.499, 0.02, 1, "step")).toEqual({
      time: 1.5,
      stopped: true,
    }));
  it("keeps continuous playback available", () => {
    const result = tickPlayback(s, 0, 5, 1, "full");
    expect(result).toEqual({ time: 5, stopped: false });
  });
});
