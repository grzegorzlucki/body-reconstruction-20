import { describe, expect, it } from "vitest";
import {
  timerDefaults,
  timerPosition,
  totalSeconds,
  validTimer,
} from "./intervalTimer";
describe("HSR timer", () => {
  it("includes preparation once and only rests between sets", () => {
    const s = { ...timerDefaults, prepare: 0 };
    expect(totalSeconds(s)).toBe(348);
    expect(totalSeconds({ ...s, prepare: 10 })).toBe(358);
    expect(timerPosition(s, 56)).toMatchObject({
      kind: "rest",
      remaining: 85,
      set: 1,
    });
    expect(timerPosition(s, 141)).toMatchObject({
      kind: "prepare",
      phase: "Przygotowanie",
      remaining: 5,
      set: 2,
      rep: 1,
    });
    expect(timerPosition(s, 146)).toMatchObject({
      kind: "move1",
      remaining: 3,
      set: 2,
      rep: 1,
    });
    expect(timerPosition(s, 348)).toMatchObject({ kind: "done", remaining: 0 });
  });
  it("skips zero phases, preparation and rest at exact boundaries", () => {
    const s = {
      ...timerDefaults,
      prepare: 0,
      move1: 0,
      hold: 0,
      move2: 3,
      reps: 2,
      sets: 2,
      rest: 0,
    };
    expect(timerPosition(s, 0)).toMatchObject({
      kind: "move2",
      remaining: 3,
      rep: 1,
    });
    expect(timerPosition(s, 2.99)).toMatchObject({ remaining: 1, rep: 1 });
    expect(timerPosition(s, 3)).toMatchObject({ remaining: 3, rep: 2 });
    expect(timerPosition(s, 6)).toMatchObject({ set: 2, rep: 1 });
    expect(timerPosition(s, 100)).toMatchObject({ kind: "done" });
  });
  it("rejects zero-duration repetitions and invalid settings", () => {
    expect(validTimer({ ...timerDefaults, move1: 0, hold: 0, move2: 0 })).toBe(
      false,
    );
    for (const changes of [
      { reps: 0 },
      { sets: 1.5 },
      { prepare: -1 },
      { rest: NaN },
      { move1: 3601 },
      { sidePrepare: -1 },
      { sidePrepare: 3601 },
    ])
      expect(validTimer({ ...timerDefaults, ...changes })).toBe(false);
  });
  it("runs both sides of each set, with preparation before switching and rest only after both", () => {
    const s = { ...timerDefaults, unilateral: true, prepare: 2, move1: 1, hold: 0, move2: 0, reps: 5, sets: 2, sidePrepare: 3, rest: 10 };
    expect(totalSeconds(s)).toBe(38);
    expect(timerPosition(s, 0)).toMatchObject({ kind: "prepare", side: "L", set: 1 });
    expect(timerPosition(s, 2)).toMatchObject({ kind: "move1", side: "L", rep: 1, set: 1 });
    expect(timerPosition(s, 6)).toMatchObject({ kind: "move1", side: "L", rep: 5 });
    expect(timerPosition(s, 7)).toMatchObject({ phase: "Przygotowanie — zmiana strony", remaining: 3, side: "P", set: 1 });
    expect(timerPosition(s, 10)).toMatchObject({ kind: "move1", side: "P", rep: 1, set: 1 });
    expect(timerPosition(s, 14)).toMatchObject({ kind: "move1", side: "P", rep: 5 });
    expect(timerPosition(s, 15)).toMatchObject({ kind: "rest", set: 1 });
    expect(timerPosition(s, 20)).toMatchObject({ kind: "prepare", side: "L", set: 2, remaining: 5 });
    expect(timerPosition(s, 25)).toMatchObject({ kind: "move1", side: "L", rep: 1, set: 2 });
    expect(timerPosition(s, 30)).toMatchObject({ kind: "prepare", side: "P", set: 2 });
    expect(timerPosition(s, 33)).toMatchObject({ kind: "move1", side: "P", set: 2 });
    expect(timerPosition(s, 38)).toMatchObject({ kind: "done", remaining: 0 });
  });
  it("can start on the right and skip switch preparation and rest", () => {
    const s = { ...timerDefaults, unilateral: true, firstSide: "P" as const, prepare: 0, move1: 1, hold: 0, move2: 0, reps: 5, sets: 2, sidePrepare: 0, rest: 0 };
    expect(totalSeconds(s)).toBe(20);
    expect(timerPosition(s, 0)).toMatchObject({ side: "P", set: 1, rep: 1 });
    expect(timerPosition(s, 5)).toMatchObject({ kind: "move1", side: "L", set: 1, rep: 1 });
    expect(timerPosition(s, 10)).toMatchObject({ side: "P", set: 2, rep: 1 });
    expect(timerPosition(s, 20)).toMatchObject({ kind: "done" });
  });
  it("preserves old settings that have no unilateral fields", () => {
    const { unilateral, sidePrepare, firstSide, ...legacy } = timerDefaults;
    expect(validTimer(legacy)).toBe(true);
    expect(totalSeconds(legacy)).toBe(totalSeconds({ ...legacy, unilateral: false }));
  });
});
