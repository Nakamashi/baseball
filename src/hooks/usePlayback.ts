import { useEffect, useRef, useState } from "react";
import { advance, duration, stepTime } from "../simulation/timeline";
import type { PlayScenario } from "../simulation/types";
export type PlaybackMode = "step" | "full";
export function tickPlayback(
  s: PlayScenario,
  time: number,
  delta: number,
  speed: number,
  mode: PlaybackMode,
) {
  const end =
    mode === "step"
      ? ([...s.phases.map((p) => p.start), duration(s)].find(
          (t) => t > time + 1e-9,
        ) ?? duration(s))
      : duration(s);
  const next = advance(time, delta, speed, end, true);
  return { time: next, stopped: next >= end };
}
export function usePlayback(scenario: PlayScenario) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [mode, setMode] = useState<PlaybackMode>("step");
  const total = duration(scenario);
  const previous = useRef<number | null>(null);
  const clock = useRef(0);
  const seek = (next: number) => {
    setPlaying(false);
    clock.current = Math.max(0, Math.min(total, next));
    setTime(clock.current);
  };
  useEffect(() => {
    clock.current = 0;
    setTime(0);
    setPlaying(false);
  }, [scenario]);
  useEffect(() => {
    if (!playing) {
      previous.current = null;
      return;
    }
    let request: number;
    const tick = (now: number) => {
      const delta =
        previous.current === null ? 0 : (now - previous.current) / 1000;
      previous.current = now;
      const next = tickPlayback(scenario, clock.current, delta, speed, mode);
      clock.current = next.time;
      setTime(next.time);
      if (next.stopped) {
        setPlaying(false);
        return;
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      previous.current = null;
    };
  }, [playing, speed, scenario, mode]);
  return {
    time,
    playing,
    speed,
    total,
    mode,
    setSpeed,
    setMode: (mode: PlaybackMode) => {
      setPlaying(false);
      setMode(mode);
    },
    toggle: () => {
      if (clock.current >= total) {
        clock.current = 0;
        setTime(0);
      }
      setPlaying((v) => !v);
    },
    restart: () => seek(0),
    seek,
    step: (direction: 1 | -1) =>
      seek(stepTime(scenario, clock.current, direction)),
  };
}
