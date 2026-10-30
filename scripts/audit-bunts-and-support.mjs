import { createServer } from 'vite';
import { createServer as httpServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
const output = process.argv[2] ?? 'audit/bunts-and-support';
const server = await createServer({ server: { middlewareMode: true, hmr: { server: httpServer() } }, appType: 'custom' });
try {
  const { DynamicPlayProvider, defaultSettings, validateSettings } = await server.ssrLoadModule('/src/dynamic/provider.ts');
  const { MovementEngine } = await server.ssrLoadModule('/src/dynamic/movement.ts');
  const { fromWorld, toWorld, metres, bases } = await server.ssrLoadModule('/src/dynamic/geometry.ts');
  const { validateScenario } = await server.ssrLoadModule('/src/simulation/scenarioValidation.ts');
  const { sample } = await server.ssrLoadModule('/src/simulation/timeline.ts');
  const { assumptions } = await server.ssrLoadModule('/src/dynamic/conventions.ts');
  const provider = new DynamicPlayProvider(), movement = new MovementEngine(), inputs = new Map(), rows = [], errors = [];
  const polar = (depth, angle) => fromWorld({ x: depth * Math.sin(angle * Math.PI / 180), y: -depth * Math.cos(angle * Math.PI / 180) });
  const add = (depth, angle, strength, anticipateBunt, speed, mask, outs) => {
    const id = [depth, angle, strength, anticipateBunt, speed, mask, outs].join(':');
    const c = defaultSettings(); c.ball = { type: 'Bunt', destination: polar(depth, angle), strength };
    c.anticipateBunt = anticipateBunt; c.runnerSpeed = speed; c.aggression = 'aggressive'; c.state.outs = outs;
    c.state.runners = Object.fromEntries([1, 2, 3].filter(b => mask & (1 << (b - 1))).map(b => [`R${b}`, b]));
    inputs.set(id, { id, depth, angle, strength, anticipateBunt, speed, mask, outs, settings: c });
  };
  for (const d of [1.1, 2, 3, 4, 5, 7.5, 10, 15, 20]) for (const a of [-42, -30, -15, 0, 15, 30, 42])
    for (const strength of ['soft', 'normal', 'hard']) for (const anticipation of [false, true])
      for (const speed of ['average', 'fast']) for (const mask of [0, 1]) add(d, a, strength, anticipation, speed, mask, 0);
  for (const a of [-42, -30, -15, 0, 15, 30, 42]) for (const strength of ['soft', 'normal', 'hard'])
    for (const anticipation of [false, true]) for (const speed of ['average', 'fast'])
      for (let mask = 0; mask < 8; mask++) for (let outs = 0; outs < 3; outs++) add(3, a, strength, anticipation, speed, mask, outs);
  for (const input of inputs.values()) {
    try {
      if (validateSettings(input.settings)) throw Error('Invalid input');
      const s = provider.generate(input.settings), events = s.dynamic.events, failures = validateScenario(s);
      for (const phase of s.phases) {
        if (new Set(phase.assignments.map(a => a.player)).size !== 9) failures.push('All-nine uniqueness');
        for (const m of phase.movements.filter(m => !m.player.startsWith('R') && m.player !== 'BR'))
          for (let i = 1; i < m.samples.length; i++) {
            const dt = m.samples[i].t - m.samples[i-1].t;
            if (dt > 1e-7 && metres(m.samples[i].point, m.samples[i-1].point) / dt > assumptions.defenderSpeed + 0.002)
              failures.push('Defender speed cap');
          }
      }
      for (const e of events.filter(e => e.type === 'RunnerOut' && e.force)) {
        const receiver = events.filter(v => ['ThrowReceived', 'BaseTouched'].includes(v.type) && v.base === e.base && v.time <= e.time).at(-1);
        if (!receiver) failures.push('Force without controlled receiving/base touch');
        else if (metres(sample(s, e.time).players.find(p => p.id === receiver.player).position, bases[e.base]) > 0.02)
          failures.push('Force receiver away from base');
      }
      const moving = s.dynamic.diagnostics.flatMap(f => f.assignments.filter(a => a.reception?.kind === 'moving-first'));
      const row = { ...input, settings: undefined, fielder: s.dynamic.ball.fielder, pickup: s.dynamic.ball.touchTime,
        firstCover: s.dynamic.diagnostics[0].assignments.find(a => a.base === 1 && a.type === 'CoverBase')?.player,
        BRout: events.some(e => e.type === 'RunnerOut' && e.player === 'BR' && e.base === 1),
        leadOut: events.some(e => e.type === 'RunnerOut' && e.player !== 'BR'),
        noOut: !events.some(e => e.type === 'RunnerOut'), movingFirst: moving.length > 0,
        firstControl: events.find(e => e.type === 'ThrowReceived' && e.base === 1)?.time,
        failures: [...new Set(failures)] };
      if (row.failures.length) errors.push({ id: input.id, failures: row.failures });
      rows.push(row);
    } catch (e) { errors.push({ id: input.id, error: String(e) }); }
    if (rows.length % 250 === 0) console.log(`Bunts ${rows.length}/${inputs.size}`);
    if (rows.length % 25 === 0) await new Promise(r => setImmediate(r));
  }
  const dense = { cases: 0, winners: {}, stopMin: Infinity, stopMax: 0 };
  for (let d = 1.1; d <= 25; d += 0.2) for (let a = -44; a <= 44; a += 4) {
    const c = defaultSettings(); c.ball = { type: 'Bunt', strength: 'soft', destination: polar(d, a) };
    if (validateSettings(c)) continue;
    const b = movement.field(c, movement.starting(c)), stop = metres(bases.home, b.trajectory.frames.at(-1).point);
    dense.cases++; dense.winners[b.fielder] = (dense.winners[b.fielder] ?? 0) + 1;
    dense.stopMin = Math.min(dense.stopMin, stop); dense.stopMax = Math.max(dense.stopMax, stop);
  }
  const lf = [];
  const points = new Map();
  for (let x = 727; x <= 787; x += 10) for (let y = 101; y <= 161; y += 10) points.set(`${x}:${y}`, { x, y, group: 'nearby' });
  for (const x of [650,700,750,800,850,900]) for (const y of [80,120,160,200,240,280]) points.set(`${x}:${y}`, {x,y,group:'broad'});
  for (const x of [243,500]) points.set(`${x}:131`, {x,y:131,group:'other-sector'});
  for (const point of points.values()) {
    const c = defaultSettings(); c.ball = { type: 'Fly ball', destination: { x: point.x, y: point.y }, strength: 'normal' };
    c.runnerSpeed = 'fast'; c.aggression = 'aggressive'; c.state.runners = {};
    const s = provider.generate(c), transitions = []; let previous;
    for (const f of s.dynamic.diagnostics) {
      const job = f.assignments.find(a => a.player === 'LF');
      if (previous?.job.type === 'SupportBase' && previous.job.base === 3 && job.type === 'SupportBase' && job.base === 2 &&
        previous.target === f.target && [3, 'home'].includes(f.target)) errors.push({ point, error: 'LF released third during same return' });
      const key = JSON.stringify([job.type, job.base, f.target]);
      if (key !== previous?.key) transitions.push({ time: f.time, type: job.type, base: job.base, target: f.target });
      previous = { job, target: f.target, key };
    }
    const failures = validateScenario(s); if (failures.length) errors.push({ point, failures });
    lf.push({ ...point, caught: s.dynamic.ball.caught, transitions });
  }
  const comparable = rows.filter(r => r.outs === 0 && r.mask <= 1);
  const rates = [];
  for (const speed of ['average','fast']) for (const mask of [0,1]) for (const anticipation of [false,true]) for (const strength of ['soft','normal','hard']) {
    const rs = comparable.filter(r => r.speed === speed && r.mask === mask && r.anticipateBunt === anticipation && r.strength === strength);
    rates.push({ speed, mask, anticipation, strength, cases: rs.length, BRout: rs.filter(r => r.BRout).length,
      leadOut: rs.filter(r => r.leadOut).length, noOut: rs.filter(r => r.noOut).length });
  }
  const summary = { cases: rows.length, errors, denseSoft: dense, lfCases: lf.length, rates,
    movingFirstCases: rows.filter(r => r.movingFirst).length,
    movingExample: rows.find(r => r.movingFirst && r.BRout),
    note: 'Deterministic engineering regression, not population baseball success rates. Times include the one-second Ready phase.' };
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
  await writeFile(`${output}/cases.json`, JSON.stringify(rows) + '\n');
  await writeFile(`${output}/lf.json`, JSON.stringify(lf, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exitCode = 1;
} finally { await server.close(); }
