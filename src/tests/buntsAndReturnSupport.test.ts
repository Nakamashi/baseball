import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, DynamicPlayProvider } from '../dynamic/provider';
import { MovementEngine } from '../dynamic/movement';
import { DefensiveDecisionEngine } from '../dynamic/defense';
import { BaserunningDecisionEngine } from '../dynamic/baserunning';
import { assumptions } from '../dynamic/conventions';
import { bases, defaults, fromWorld, metres, toWorld, isInfieldDiamond } from '../dynamic/geometry';
import { predictTrajectory } from '../dynamic/trajectory';
import { planMotion, sampleMotion } from '../dynamic/locomotion';
import { formatDynamic } from '../dynamic/messages';
import { sample, duration } from '../simulation/timeline';
import { validateScenario } from '../simulation/scenarioValidation';
import { positions } from '../simulation/types';
import type { DynamicScenario, DynamicSettings } from '../dynamic/types';
const provider = new DynamicPlayProvider(), movement = new MovementEngine();
afterEach(() => new Promise<void>(r => setTimeout(r, 0)));
function bunt(strength: DynamicSettings['ball']['strength'] = 'soft', angle = 0, depth = 3) {
  const c = defaultSettings(); c.ball = { type: 'Bunt', strength,
    destination: fromWorld({ x: depth * Math.sin(angle * Math.PI / 180), y: -depth * Math.cos(angle * Math.PI / 180) }) };
  c.runnerSpeed = 'fast'; c.aggression = 'aggressive'; c.state.runners = {}; return c;
}
function check(s: DynamicScenario) {
  expect(validateScenario(s)).toEqual([]);
  for (const p of s.phases) {
    expect(new Set(p.assignments!.map(a => a.player))).toEqual(new Set(positions));
    for (const r of Object.values(p.responsibilities)) for (const text of Object.values(r)) {
      expect(formatDynamic(text, 'en')).not.toMatch(/@v2:|\{\w+\}/);
      expect(formatDynamic(text, 'ja')).toMatch(/[ぁ-んァ-ヶ一-龯]/);
    }
  }
}
const events = (s: DynamicScenario, type: string) => s.dynamic.events.filter(e => e.type === type);
const point = (s: DynamicScenario, t: number, id: string) => sample(s, t).players.find(p => p.id === id)!.position;
function velocity(s: DynamicScenario, t: number, id: string) {
  const a = toWorld(point(s, t - 0.001, id)), b = toWorld(point(s, t + 0.001, id));
  return { x: (b.x - a.x) / 0.002, y: (b.y - a.y) / 0.002 };
}
describe('cooperative bunt fielding and legal first-base receiving', () => {
  it('separates physical catcher stance from authored marker art and models a deadened roller', () => {
    const c = bunt(), start = movement.starting(c), b = movement.field(c, start);
    expect(metres(start.C, bases.home)).toBeCloseTo(1.5, 8);
    expect(metres(defaults.C, bases.home)).toBeGreaterThan(4);
    expect(b.fielder).toBe('C'); expect(b.touchTime).toBeLessThan(1.7);
    const end = predictTrajectory(c).frames.at(-1)!;
    expect(metres(end.point, bases.home)).toBeGreaterThan(2);
    expect(metres(end.point, bases.home)).toBeLessThan(3.5);
    expect(metres(end.point, c.ball.destination)).toBeGreaterThan(0.05);
    expect(metres(predictTrajectory(bunt('normal')).frames.at(-1)!.point, bases.home)).toBeGreaterThan(10);
    expect(metres(predictTrajectory(bunt('hard')).frames.at(-1)!.point, bases.home)).toBeGreaterThan(17);
  });
  it.each(['soft', 'hard'] as const)('retires a fast BR on a routine %s bunt using ready 1B, without slowing the runner', strength => {
    const c = bunt(strength), s = provider.generate(c);
    const first = s.dynamic.diagnostics[0].assignments.find(a => a.base === 1 && a.type === 'CoverBase')!;
    expect(first.player).toBe('1B');
    expect(s.dynamic.diagnostics[0].assignments.find(a => a.player === '1B')!.type).not.toBe('ChargeBunt');
    const out = events(s, 'RunnerOut').find(e => e.player === 'BR')!, control = events(s, 'ThrowReceived')[0];
    expect(out).toMatchObject({ base: 1, force: true });
    expect(out.time).toBe(control.time); expect(out.time - 1).toBeLessThan(4.2);
    expect(metres(point(s, out.time, control.player!), bases[1])).toBeLessThan(0.02);
    const touch = events(s, 'RunnerBaseTouch').find(e => e.player === 'BR' && e.base === 1)!;
    expect(touch.time - 1).toBeCloseTo(4.2, 4);
    check(s);
  });
  it('keeps a genuinely close fast-runner bunt safe and retires the average runner on the same physics', () => {
    const c = bunt('normal'), fast = provider.generate(c); c.runnerSpeed = 'average'; const average = provider.generate(c);
    expect(events(fast, 'RunnerOut').filter(e => e.player === 'BR')).toEqual([]);
    expect(events(average, 'RunnerOut').some(e => e.player === 'BR' && e.base === 1)).toBe(true);
    check(fast); check(average);
  });
  it('uses C momentum for a timely lead force and keeps 1B covering the batter', () => {
    const c = bunt(); c.state.runners = { R1: 1 }; const s = provider.generate(c);
    expect(s.dynamic.ball.fielder).toBe('C');
    const release = events(s, 'ThrowStarted')[0]; expect(release).toMatchObject({ player: 'C', base: 2 });
    expect(events(s, 'RunnerOut')[0]).toMatchObject({ player: 'R1', base: 2, force: true });
    expect(events(s, 'RunnerAdvanced').some(e => e.player === 'BR' && e.base === 1)).toBe(true);
    expect(s.dynamic.diagnostics[0].assignments.find(a => a.player === '1B')).toMatchObject({ type: 'CoverBase', base: 1 });
    const v = velocity(s, release.time, 'C'); expect(Math.hypot(v.x, v.y)).toBeGreaterThan(0.15);
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1.21);
    check(s);
  });
  it('requires a plant for an unaligned catcher throw and shares the physical release calculation', () => {
    const c = bunt(), d = new DefensiveDecisionEngine(), from = fromWorld({ x: 0, y: -3 }), v = { x: 0, y: -1.75 };
    d.settings = c; d.motion = () => ({ position: from, velocity: v, reaction: 0 });
    const aligned = d.release('C', from, bases[2]), side = d.release('C', from, bases[1]);
    expect(aligned.time).toBeCloseTo(0.3, 7); expect(side.time).toBeCloseTo(0.35, 7);
    const plan = planMotion({ position: toWorld(from), velocity: v }, toWorld(aligned.motionTarget), assumptions.defenderSpeed, assumptions.defenderAcceleration);
    expect(metres(fromWorld(sampleMotion(plan, aligned.time).position), aligned.point)).toBeLessThan(1e-7);
    expect(Math.hypot(...Object.values(sampleMotion(plan, aligned.time).velocity))).toBeCloseTo(0.25, 6);
    expect(d.release('P', from, bases[2]).time).toBeCloseTo(0.35, 7);
  });
  it('uses 2B when 1B really fields, with controlled moving base contact rather than a glove-contact force', () => {
    const c = bunt('hard', 42, 15); c.runnerSpeed = 'average'; c.state.runners = { R1: 1 }; const s = provider.generate(c);
    expect(s.dynamic.ball.fielder).toBe('1B');
    const control = events(s, 'ThrowReceived').find(e => e.base === 1)!, glove = events(s, 'ThrowGloveContact').find(e => e.base === 1)!;
    expect(control.player).toBe('2B'); expect(control.time - glove.time).toBeCloseTo(0.12, 6);
    expect(s.dynamic.diagnostics.some(f => f.assignments.some(a => a.reception?.kind === 'moving-first'))).toBe(true);
    expect(sample(s, glove.time).owner).toBeUndefined();
    expect(metres(point(s, control.time, '2B'), bases[1])).toBeLessThan(0.02);
    const out = events(s, 'RunnerOut').find(e => e.player === 'BR')!; expect(out.time).toBe(control.time);
    check(s);
  });
  it('completes the final microns of third recovery instead of looping forever', () => {
    const c = bunt('hard', -15, 10); c.state.runners = { R1: 1 }; c.anticipateBunt = true;
    const s = provider.generate(c);
    expect(metres(point(s, duration(s), '3B'), bases[3])).toBeLessThan(0.00001);
    expect(duration(s)).toBeLessThan(12); check(s);
  });
});
describe('return support survives intermediate possession', () => {
  function fly(x = 757, y = 131) { const c = defaultSettings(); c.ball = { type: 'Fly ball', strength: 'normal', destination: { x, y } };
    c.state.runners = {}; c.state.outs = 0; c.runnerSpeed = 'fast'; c.aggression = 'aggressive'; return c; }
  it('keeps LF at third through the original relay and tag with unchanged ball and runner times', () => {
    const s = provider.generate(fly()), relay = events(s, 'ThrowReceived')[0], out = events(s, 'RunnerOut')[0];
    expect(relay.time).toBeCloseTo(10.303544, 5); expect(out.time).toBeCloseTo(12.964146, 5);
    expect(out).toMatchObject({ base: 3, force: false });
    for (const f of s.dynamic.diagnostics.filter(f => f.time >= relay.time && f.time < out.time))
      expect(f.assignments.find(a => a.player === 'LF')).toMatchObject({ type: 'SupportBase', base: 3 });
    const target = s.dynamic.diagnostics[0].assignments.find(a => a.player === 'LF')!.target;
    expect(metres(point(s, 10.53, 'LF'), target)).toBeLessThan(0.01);
    expect(metres(point(s, out.time, 'LF'), target)).toBeLessThan(0.01);
    for (let t = relay.time; t < duration(s); t += 0.1) expect(isInfieldDiamond(point(s, t, 'LF'))).toBe(false);
    check(s);
  });
  it('retains third across the nearby grid and current-holder depth/sector thresholds', () => {
    for (let x = 727; x <= 787; x += 10) for (let y = 101; y <= 161; y += 10) {
      const s = provider.generate(fly(x, y)); let previous;
      for (const f of s.dynamic.diagnostics) {
        const a = f.assignments.find(a => a.player === 'LF')!;
        if (previous?.base === 3 && previous.type === 'SupportBase' && f.target === 3)
          expect(a.type === 'SupportBase' && a.base === 2).toBe(false);
        previous = a;
      }
      expect(validateScenario(s)).toEqual([]);
    }
  });
  it('lets actual receiver reservations and a changed target supersede secondary support', () => {
    const c = fly(), loc = movement.starting(c), ball = movement.field(c, loc), rs = new BaserunningDecisionEngine().create(c), d = new DefensiveDecisionEngine();
    const reserved = d.assign(c, ball, 'CF', 3, loc, 'fielded', { runners: rs, outs: 0, fixedReceiver: 'LF' });
    expect(reserved.assignments.find(a => a.player === 'LF')).toMatchObject({ type: 'CoverBase', base: 3 });
    const redirected = d.assign(c, ball, 'CF', 2, loc, 'fielded', { runners: rs, outs: 0 });
    expect(redirected.assignments.find(a => a.player === 'LF')).not.toMatchObject({ type: 'SupportBase', base: 3 });
    const complete = d.assign(c, ball, 'CF', 3, loc, 'complete', { runners: rs, outs: 3 });
    expect(complete.assignments.every(a => !['BackupThrow', 'SupportBase'].includes(a.type))).toBe(true);
  });
});
