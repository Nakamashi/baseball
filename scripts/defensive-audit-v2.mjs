import { createServer } from 'vite';
import { createServer as httpServer } from 'node:http';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { once } from 'node:events';
import { createHash } from 'node:crypto';

// Audit-only: production generation, independent checks over compiled evidence.
// A seed selects reproducible input perturbations; the engine has no RNG.
const args = process.argv.slice(2);
const value = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const output = value('--output', 'audit/defensive-v2-after');
const filter = value('--case');
const server = await createServer({ server: { middlewareMode: true, hmr: { server: httpServer() } }, appType: 'custom' });
try {
  const { DynamicPlayProvider, defaultSettings, validateSettings } = await server.ssrLoadModule('/src/dynamic/provider.ts');
  const { fromWorld, toWorld, bases } = await server.ssrLoadModule('/src/dynamic/geometry.ts');
  const { sample, duration } = await server.ssrLoadModule('/src/simulation/timeline.ts');
  const { validateScenario } = await server.ssrLoadModule('/src/simulation/scenarioValidation.ts');
  const { formatDynamic } = await server.ssrLoadModule('/src/dynamic/messages.ts');
  const { assumptions } = await server.ssrLoadModule('/src/dynamic/conventions.ts');
  const { ballPhysics } = await server.ssrLoadModule('/src/dynamic/trajectory.ts');
  const { throwProfiles, throwPhysics } = await server.ssrLoadModule('/src/dynamic/throwing.ts');
  const defenders = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const distance = (a, b) => { const p = toWorld(a), q = toWorld(b); return Math.hypot(p.x - q.x, p.y - q.y); };
  const polar = (angle, depth) => fromWorld({ x: depth * Math.sin(angle * Math.PI / 180), y: -depth * Math.cos(angle * Math.PI / 180) });
  const text = (v) => formatDynamic(v, 'en') ?? v;
  const zones = [
    ['third', -42, 27], ['short', -25, 32], ['pitcher', 0, 18], ['second', 25, 32], ['first', 42, 27],
    ['left', -38, 65], ['left-center', -18, 88], ['center', 0, 80], ['right-center', 18, 88], ['right', 38, 65],
  ];
  const buntZones = [['third-line', -42, 10], ['short-push', -25, 22], ['pitcher', 0, 14], ['second-push', 25, 22], ['first-line', 42, 10], ['catcher', 0, 3]];
  const types = [['ground', 'Ground ball'], ['line', 'Line drive'], ['fly', 'Fly ball'], ['pop', 'Pop-up'], ['bunt', 'Bunt']];
  const cases = [], exclusions = [], adjustments = [];
  const make = (type, point, mask, outs, strength = 'normal') => {
    const s = defaultSettings();
    s.state.runners = Object.fromEntries([1, 2, 3].filter(b => mask & (1 << (b - 1))).map(b => [`R${b}`, b]));
    s.state.outs = outs; s.ball = { type, destination: point, strength }; return s;
  };
  for (const [slug, type] of types) for (const [zone, angle, depth] of type === 'Bunt' ? buntZones : zones)
    for (let mask = 0; mask < 8; mask++) for (let outs = 0; outs < 3; outs++) {
      const id = `base-${slug}-${zone}-b${mask}-o${outs}`;
      const adjusted = type === 'Pop-up' && zones.findIndex(z => z[0] === zone) >= 5;
      const settings = make(type, polar(angle, adjusted ? 32 : depth), mask, outs);
      if (validateSettings(settings)) { exclusions.push({ id, settings, reason: text(validateSettings(settings)) }); continue; }
      if (adjusted) adjustments.push({ id, reason: 'Outfield-sector pop-up reinterpreted as same azimuth at 32 m; conventional deep outfield pop-up excluded.', requestedDepth: depth, actualDepth: 32 });
      cases.push({ id, group: 'baseline', zone, seed: 0, settings });
    }
  for (const c of cases.slice()) {
    const s = c.settings, mask = Number(c.id.match(/-b(\d)/)[1]);
    const vary = ['Ground ball', 'Bunt'].includes(s.ball.type) ||
      (s.ball.type === 'Line drive' && zones.findIndex(z => z[0] === c.zone) >= 5 && [1, 2, 7].includes(mask) && s.state.outs < 2) ||
      (s.ball.type === 'Fly ball' && zones.findIndex(z => z[0] === c.zone) >= 5 && [4, 5].includes(mask) && s.state.outs < 2);
    if (vary) for (const strength of ['soft', 'hard']) {
      const settings = structuredClone(s); settings.ball.strength = strength;
      cases.push({ ...c, settings, id: c.id.replace('base-', `strength-${strength}-`), group: 'strength' });
    }
  }
  // Anticipation is independently selected pre-pitch, not inferred from type.
  for (const [zone, angle, depth] of buntZones) for (const mask of [0, 1, 2, 3, 4, 5, 6, 7]) for (const outs of [0, 1, 2]) {
    const strengths = ['third-line', 'first-line'].includes(zone) && outs < 2 ? ['soft', 'normal', 'hard'] : ['normal'];
    for (const strength of strengths) {
      const settings = make('Bunt', polar(angle, depth), mask, outs, strength); settings.anticipateBunt = true;
      cases.push({ id: `anticipate-bunt-${zone}-b${mask}-o${outs}-${strength}`, group: 'bunt-anticipation', zone, seed: 0, settings });
    }
  }
  const dpPoints = [['ss', 425, 425], ['2b', 575, 425], ['3b', 300, 540], ['1b', 650, 550], ['p', 500, 590], ['ss-left', 396, 473], ['3b-hole', 350, 500], ['1b-line', 690, 560], ['1b-inside', 680, 580], ['p-left', 480, 590]];
  for (const [zone, x, y] of dpPoints) for (const runnerSpeed of ['slow', 'average', 'fast'])
    for (const strength of ['soft', 'normal', 'hard']) for (const outs of [0, 1, 2]) {
      const settings = make('Ground ball', { x, y }, 1, outs, strength); settings.runnerSpeed = runnerSpeed;
      cases.push({ id: `dp-${zone}-${runnerSpeed}-${strength}-o${outs}`, group: 'double-play', zone, seed: 0, settings });
    }
  // Input seeds vary angle/depth slightly, athlete/arm profiles and runner intent.
  const seededTemplates = [
    ...dpPoints.map(([zone, x, y]) => ({ zone, settings: make('Ground ball', { x, y }, 1, 0, 'hard') })),
    ...['left-center', 'right-center'].map(zone => ({ zone, settings: make('Line drive', polar(zone === 'left-center' ? -18 : 18, 100), 3, 0, 'hard') })),
    { zone: 'tag-home', settings: make('Fly ball', polar(18, 80), 4, 0, 'hard') },
    { zone: 'bunt-first', settings: make('Bunt', { x: 637, y: 620 }, 1, 0, 'soft') },
    { zone: 'bunt-third', settings: make('Bunt', polar(-42, 10), 3, 0, 'soft') },
  ];
  const random = seed => () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  for (const seed of [17, 29, 101, 997]) for (const template of seededTemplates) {
    const rng = random(seed), settings = structuredClone(template.settings), p = toWorld(settings.ball.destination);
    settings.ball.destination = fromWorld({ x: p.x + (rng() - 0.5) * 1.2, y: p.y + (rng() - 0.5) * 1.2 });
    // The supported polygon is slightly inside the schematic foul lines near
    // home. Preserve a valid fair input if a perturbation crosses its edge.
    if (validateSettings(settings)) settings.ball.destination = structuredClone(template.settings.ball.destination);
    settings.runnerSpeed = ['slow', 'average', 'fast'][Math.floor(rng() * 3)];
    settings.aggression = ['conservative', 'normal', 'aggressive'][Math.floor(rng() * 3)];
    settings.armStrength = ['developing', 'standard', 'strong'][Math.floor(rng() * 3)];
    settings.state.outs = seed % 3;
    if (settings.ball.type === 'Bunt') settings.anticipateBunt = seed % 2 === 1;
    cases.push({ id: `seed-${seed}-${template.zone}`, group: 'seed', zone: template.zone, seed, settings });
  }
  // Boundaries and explicit holds exercise rule paths absent from normal aims.
  for (const [zone, type, angle, depth, mask, outs, extra] of [
    ['home-run', 'Fly ball', 42, 130, 7, 2, { field: { fenceHeight: 1, fenceMode: 'standard' } }],
    ['two-base-award', 'Line drive', -42, 130, 3, 0, { field: { fenceHeight: 1, fenceMode: 'standard' } }],
    ['hold-caught-line', 'Line drive', -25, 32, 3, 0, { throwTarget: 'hold' }],
    ['tag-home', 'Fly ball', 18, 95, 4, 0, { aggression: 'aggressive', runnerSpeed: 'fast', armStrength: 'strong' }],
  ]) {
    const settings = { ...make(type, polar(angle, depth), mask, outs, 'hard'), ...extra };
    if (zone === 'home-run') settings.ball.destination = { x: 500, y: 15 };
    if (zone === 'two-base-award') { settings.ball.type = 'Fly ball'; settings.ball.destination = { x: 887.52, y: 370.36 }; }
    cases.push({ id: `focus-${zone}`, group: 'focus', zone, seed: 0, settings });
  }
  for (const [zone, type, x, y, mask, outs, extra] of [
    ['caught-line-retouch', 'Line drive', 425, 350, 1, 0, { aggression: 'aggressive' }],
    ['infield-fly', 'Fly ball', 390, 390, 3, 0, {}],
    ['caught-third-out', 'Fly ball', 500, 100, 4, 2, { aggression: 'aggressive', runnerSpeed: 'fast' }],
    ['right-center-manual', 'Line drive', 678, 104, 1, 0, { aggression: 'aggressive' }],
    ['left-center-manual', 'Line drive', 322, 104, 1, 0, { aggression: 'aggressive' }],
    ['right-center-home', 'Line drive', 678, 104, 1, 0, { aggression: 'aggressive', throwTarget: 'home' }],
    ['left-center-home', 'Line drive', 322, 104, 1, 0, { aggression: 'aggressive', throwTarget: 'home' }],
    ['loaded-relay', 'Fly ball', 509, 91, 7, 0, { aggression: 'aggressive' }],
  ]) {
    const settings = { ...make(type, { x, y }, mask, outs, type === 'Fly ball' && zone === 'infield-fly' ? 'normal' : 'hard'), ...extra };
    cases.push({ id: `focus-${zone}`, group: 'focus', zone, seed: 0, settings });
  }
  const selected = filter ? cases.filter(c => c.id === filter) : cases;
  if (!selected.length) throw new Error(`Unknown case: ${filter}`);
  await mkdir(output, { recursive: true });
  const evidenceFile = `${output}/traces.jsonl.gz`;
  const zip = createGzip({ level: 6 }), file = createWriteStream(evidenceFile);
  zip.pipe(file);
  const rows = [];
  const flag = (flags, severity, code, detail, evidence) => { if (!flags.some(f => f.code === code)) flags.push({ severity, code, detail, evidence }); };
  const engine = new DynamicPlayProvider();
  const started = Date.now();
  for (const [index, c] of selected.entries()) {
    const flags = []; let s;
    try { s = engine.generate(c.settings); } catch (error) {
      rows.push({ ...c, flags: [{ severity: 'Critical', code: 'generation', detail: error.message }], error: error.message }); continue;
    }
    if (c.group === 'seed') {
      const again = engine.generate(c.settings);
      if (JSON.stringify(again) !== JSON.stringify(s)) flag(flags, 'Critical', 'nondeterminism', 'Identical complete settings produced a different compiled scenario.');
    }
    const events = s.dynamic.events, final = sample(s, duration(s));
    const snap = t => sample(s, t);
    const point = (id, t) => snap(t).players.find(p => p.id === id)?.position;
    const structural = validateScenario(s);
    if (structural.length) flag(flags, 'Critical', 'structure', 'Production structural validation failed.', structural);
    let lastTime = -Infinity;
    const retired = new Set(), touched = new Map(Object.entries(c.settings.state.runners).map(([id, b]) => [id, b]));
    let caught = false, declared = false, third;
    const timing = { contact: s.dynamic.contactTime, touch: events.find(e => e.type === 'BallTouched')?.time,
      secured: events.find(e => e.type === 'BallFielded')?.time, throws: [] };
    for (const [ei, e] of events.entries()) {
      if (!Number.isFinite(e.time) || e.time < lastTime - 1e-6) flag(flags, 'Critical', 'event-order', 'Event timestamps decrease or are not finite.', e);
      lastTime = e.time;
      if (e.type === 'InfieldFly') {
        declared = true;
        if (c.settings.state.outs >= 2 || !c.settings.state.runners.R1 || !c.settings.state.runners.R2 || !['Fly ball', 'Pop-up'].includes(c.settings.ball.type))
          flag(flags, 'Critical', 'illegal-infield-fly', 'Infield fly declared outside qualifying type/base/out state.', e);
      }
      if (e.type === 'BallCaught') caught = true;
      if (e.type === 'RunnerAdvanced' || e.type === 'RunnerBaseTouch') {
        const b = e.base === 'home' ? 4 : e.base;
        const separation = distance(point(e.player, e.time), bases[e.base]);
        if (separation > 0.05) flag(flags, 'Critical', 'runner-touch-geometry', 'A recorded base touch is not at the physical base in compiled movement.', { e, separation });
        if (!retired.has(e.player) && b > (touched.get(e.player) ?? 0) + 1) flag(flags, 'Critical', 'base-order', 'Runner advances past an untouched intervening base.', e);
        touched.set(e.player, b);
      }
      if (['RunnerTaggedUp', 'RunnerRetouched'].includes(e.type) && distance(point(e.player, e.time), bases[e.base]) > 0.05)
        flag(flags, 'Critical', 'retouch-geometry', 'Recorded retouch/tag-up departure is not at the original physical base.', e);
      if (e.type === 'ThrowStarted') {
        const glove = events.slice(ei + 1).find(v => v.type === 'ThrowGloveContact');
        const control = events.slice(ei + 1).find(v => ['ThrowReceived', 'BaseTouched'].includes(v.type));
        const previous = events.slice(0, ei).filter(v => ['BallFielded', 'ThrowReceived'].includes(v.type) && v.player === e.player).at(-1);
        const target = glove ? point(glove.player, glove.time) : undefined;
        timing.throws.push({ from: e.player, to: glove?.player, target: e.base, release: e.time, previousControl: previous?.time,
          preparation: previous ? e.time - previous.time : undefined, glove: glove?.time, control: control?.time,
          flight: glove ? glove.time - e.time : undefined, distance: target ? distance(point(e.player, e.time), target) : undefined });
        if (third && e.time > third.time) flag(flags, 'Critical', 'post-third-throw', 'Throw released after the third out.', e);
        const before = snap(e.time - 1e-7);
        if (before.owner !== e.player) flag(flags, 'Critical', 'throw-no-control', 'Thrower lacks secure possession before release.', { e, owner: before.owner });
      }
      if (e.type === 'RunnerOut') {
        if (retired.has(e.player)) flag(flags, 'Critical', 'duplicate-out', 'One runner retired twice.', e);
        const origin = e.player === 'BR' ? 0 : Number(e.player.slice(1));
        const b = e.base === 'home' ? 4 : e.base;
        if (e.force) {
          const valid = !caught && !declared && b === origin + 1 && (touched.get(e.player) ?? origin) < b &&
            Array.from({ length: origin }, (_, i) => i === 0 ? 'BR' : `R${i}`).every(id => !retired.has(id) && (id === 'BR' || id in c.settings.state.runners));
          if (!valid) flag(flags, 'Critical', 'illegal-force', 'Recorded force does not exist under initial occupancy and intervening outs/catches/touches.', e);
          const holder = snap(e.time).owner;
          if (!holder || distance(point(holder, e.time), bases[e.base]) > 0.65)
            flag(flags, 'Critical', 'force-off-base', 'Force recorded without secure holder within modeled foot/glove reach of base.', { e, holder, metres: holder ? distance(point(holder, e.time), bases[e.base]) : undefined });
          const moving = holder && snap(e.time - 1e-7).phase.assignments?.find(a => a.player === holder)?.reception;
          if (moving && (distance(point(holder, e.time), bases[e.base]) > 0.02 ||
            !events.slice(0, ei).some(v => v.type === 'BaseTouched' && v.player === holder && v.base === e.base && Math.abs(v.time - e.time) < 1e-6)))
            flag(flags, 'Critical', 'moving-force-contact', 'Moving force requires compiled body/base contact and an explicit controlled base touch.', { e, holder });
        } else {
          const isCatchOut = e.player === 'BR' && (caught || declared);
          const isAppeal = events.slice(0, ei).some(v => v.type === 'BallCaught') && s.dynamic.decisions.some(d => d.appeal && d.runner === e.player && d.target === e.base && d.time <= e.time);
          if (!isCatchOut && !isAppeal) {
            const holder = snap(e.time).owner;
            const separation = holder ? distance(point(holder, e.time), point(e.player, e.time)) : Infinity;
            if (separation > 1.2) flag(flags, 'Critical', 'remote-tag', 'Tag out recorded with ball holder more than 1.2 m from runner.', { e, holder, separation });
          }
        }
        retired.add(e.player);
        if (c.settings.state.outs + retired.size === 3) third = e;
      }
      if (e.type === 'ThrowGloveContact') {
        const before = snap(e.time - 1e-7);
        const separation = distance(before.ball, point(e.player, e.time));
        if (separation > 0.65) flag(flags, 'Critical', 'remote-reception', 'Throw glove contact occurs beyond receiving reach.', { e, separation });
      }
      if (e.type === 'BallCaught') {
        const firstGround = s.dynamic.ball.trajectory.events.find(v => ['landing', 'wall'].includes(v.type));
        const firstTouch = events.find(v => v.type === 'BallTouched');
        if (!firstTouch || (firstGround && firstTouch.time - s.dynamic.contactTime >= firstGround.t + 1e-5))
          flag(flags, 'Critical', 'catch-after-ground', 'A catch is recorded after the actual first touch follows ground/wall contact.', e);
      }
    }
    if (final.state.outs !== c.settings.state.outs + retired.size) flag(flags, 'Critical', 'out-total', 'Final out count disagrees with unique recorded outs.');
    const scores = events.filter(e => e.type === 'RunScored');
    const noRuns = third && (third.force || (third.player === 'BR' && third.base === 1));
    const expectedRuns = noRuns ? 0 : scores.filter(e => !third || e.time < third.time - 1e-6).length;
    if (final.state.runs !== c.settings.state.runs + expectedRuns) flag(flags, 'Critical', 'scoring', 'Final run count disagrees with independent third-out scoring check.', { expectedRuns, actual: final.state.runs, third });
    for (const p of s.phases) {
      if (new Set(p.assignments?.map(a => a.player)).size !== 9 || defenders.some(id => !p.assignments?.some(a => a.player === id)))
        flag(flags, 'High', 'missing-job', 'A phase lacks exactly one assignment per defender.', { phase: p.id });
      for (const m of p.movements) {
        const samples = m.samples ?? [];
        for (let i = 1; i < samples.length; i++) {
          const dt = samples[i].t - samples[i - 1].t;
          const displacement = distance(samples[i - 1].point, samples[i].point);
          // Coincident segment boundaries can differ by ~1e-17 seconds.
          if (dt < 1e-8 && displacement < 1e-6) continue;
          const speed = displacement / dt;
          if (!Number.isFinite(speed) || speed > assumptions.defenderSpeed + 0.02)
            if (defenders.includes(m.player))
              flag(flags, 'Medium', 'defender-speed', 'Compiled defender movement exceeds configured speed cap.', { phase: p.id, player: m.player, speed, cap: assumptions.defenderSpeed });
          if (!defenders.includes(m.player) && (!Number.isFinite(speed) || speed > assumptions.runnerSpeed[c.settings.runnerSpeed] + 0.02))
            flag(flags, 'Medium', 'runner-speed', 'Compiled runner movement exceeds the configured profile speed cap.', { phase: p.id, player: m.player, speed, cap: assumptions.runnerSpeed[c.settings.runnerSpeed] });
        }
      }
    }
    // Distinct from decision quality: forecast-versus-compiled control timing.
    for (const d of s.dynamic.decisions) {
      const chosen = d.alternatives?.find(a => a.target === d.target && a.runner === d.runner && !!a.appeal === !!d.appeal);
      const receive = events.find(e => ['ThrowReceived', 'BaseTouched'].includes(e.type) && e.base === d.target && e.time >= d.time);
      const next = s.dynamic.decisions.find(v => v.time > d.time + 1e-6);
      if (chosen && receive && distance(point(receive.player, receive.time), bases[d.target]) < 0.65 &&
        (!next || receive.time <= next.time + 1e-6) && !s.dynamic.diagnostics.some(f => f.time >= d.time && f.time < receive.time && f.route.kind === 'relay')) {
        const error = receive.time - d.time - chosen.ballArrival;
        if (Math.abs(error) > 0.04) flag(flags, 'Medium', 'forecast-control-drift', 'Compiled control time differs from selected direct/carry forecast by more than 40 ms.', { decisionTime: d.time, target: d.target, predicted: chosen.ballArrival, actual: receive.time - d.time, error });
      }
      if (chosen?.runner === 'BR' && chosen.force && d.target === 1) {
        const touch = events.find(e => e.type === 'RunnerAdvanced' && e.player === 'BR' && e.base === 1 && e.time > d.time);
        const history = touch ? s.dynamic.diagnostics.filter(f => f.time >= d.time && f.time < touch.time) : [];
        const unchangedGoal = history.length > 0 && history.every(f => f.runners.find(r => r.id === 'BR')?.goal === 1);
        if (touch && unchangedGoal && chosen.runnerArrival > touch.time - d.time + 0.2)
          flag(flags, 'High', 'runner-first-touch-forecast', 'Selected first-base challenge overestimates time to BR first touch by more than 200 ms despite unchanged goal; inspect stop/return duration versus first crossing.',
            { decisionTime: d.time, predictedRemaining: chosen.runnerArrival, actualRemaining: touch.time - d.time, touch: touch.time,
              predictedBallControl: chosen.ballArrival, selectedMargin: chosen.margin });
      }
      if (d.target === 'hold' && d.alternatives?.some(a => a.viable && !a.appeal) && !d.override)
        flag(flags, 'High', 'ignored-out', 'Automatic hold ignores an explicitly viable opportunity.', d);
    }
    const issues = [...new Set(s.dynamic.diagnostics.flatMap(f => f.issues.map(i => i.kind)))];
    const liveIssues = s.dynamic.diagnostics.filter(f => f.time >= 1 && f.state.outs < 3 && f.route.target !== 'hold').flatMap(f => f.issues.map(issue => ({ time: f.time, ...issue })));
    const essentialIssues = liveIssues.filter(i => ['unfulfilled', 'conflict'].includes(i.kind) && !/optional|back.*reception/i.test(i.detail));
    if (essentialIssues.length) flag(flags, 'High', 'coverage-review', 'Allocator reports unfulfilled/conflicting essential responsibility during a live target; tactical review required.', essentialIssues.slice(0, 8));
    if (liveIssues.some(i => i.kind === 'unfulfilled' && /optional|back.*reception/i.test(i.detail))) flag(flags, 'Medium', 'optional-support-review', 'No timely backup of an optional/intermediate reception; advisory, retaining base coverage can be sound.', liveIssues.filter(i => i.kind === 'unfulfilled' && /optional|back.*reception/i.test(i.detail)).slice(0, 8));
    if (liveIssues.some(i => i.kind === 'late-coverage')) flag(flags, 'Medium', 'late-coverage-review', 'Allocator reports base coverage arriving after an advancing runner; inspect whether a useful earlier rotation exists.', liveIssues.filter(i => i.kind === 'late-coverage').slice(0, 8));
    if (liveIssues.some(i => ['late-backup', 'late-cutoff', 'space-limited'].includes(i.kind))) flag(flags, 'Medium', 'late-support-review', 'Allocator reports late or space-limited support; advisory, not an automatic tactical error.', liveIssues.filter(i => ['late-backup', 'late-cutoff', 'space-limited'].includes(i.kind)).slice(0, 8));
    if (s.dynamic.ball.caught && s.dynamic.ball.fielder === 'P' && ['Fly ball', 'Pop-up'].includes(c.settings.ball.type)) {
      const alternatives = s.dynamic.ball.candidates.filter(v => ['SS', '2B', '3B', '1B', 'C'].includes(v.player) && v.caught);
      if (alternatives.length) flag(flags, 'Medium', 'pop-priority-review', 'P catches a fly/pop despite other reachable infield catches; compare Perry Hill p38 priority convention.', alternatives.map(v => ({ player: v.player, time: v.time })));
    }
    const [feed, pivot] = timing.throws;
    if (c.settings.ball.strength === 'hard' && c.settings.runnerSpeed === 'average' && c.settings.state.outs < 2 &&
      feed?.target === 2 && pivot?.target === 1 && ['SS', '2B'].includes(feed.to) && !retired.has('BR')) {
      const d = distance(s.startingPositions[feed.to], bases[2]), a = assumptions.defenderAcceleration, v = assumptions.defenderSpeed;
      // Independently derived rest-to-rest kinematic bound; no decision helper.
      const travel = d <= v * v / a ? 2 * Math.sqrt(d / a) : d / v + v / a;
      const earliestControl = s.dynamic.contactTime + assumptions.reaction + travel + assumptions.catchTime;
      const earliestFirstControl = earliestControl + throwProfiles.pivot.prepare + pivot.flight + assumptions.catchTime;
      const brTouch = events.find(e => e.type === 'RunnerAdvanced' && e.player === 'BR' && e.base === 1)?.time;
      const moving = s.phases.some(p => p.start >= feed.previousControl && p.start <= feed.release + 1e-6 && p.assignments?.some(a => a.player === feed.to && a.reception));
      if (!moving && brTouch && earliestFirstControl > brTouch && timing.secured < earliestControl - 0.5)
        flag(flags, 'High', 'double-play-coverage-floor', 'Rest-to-rest second-base coverage creates a lower bound later than the average BR, even with an early hard-grounder pickup. Confirmed model bottleneck; calibration/footwork correction needs review.',
          { receiver: feed.to, startingDistance: d, minimumStoppedTravel: travel, earliestControl, earliestFirstControl, brTouch, deficit: earliestFirstControl - brTouch });
    }
    const row = { ...c, flags, result: text(s.result), outs: final.state.outs - c.settings.state.outs, runs: final.state.runs, finalState: final.state,
      fielder: s.dynamic.ball.fielder, caught: s.dynamic.ball.caught, infieldFly: s.dynamic.ball.infieldFly,
      launch: s.dynamic.ball.trajectory.launch, issues, timing,
      outsLedger: events.filter(e => e.type === 'RunnerOut'),
      runnerTouches: events.filter(e => ['RunnerAdvanced', 'RunnerBaseTouch', 'RunnerTaggedUp', 'RunnerRetouched', 'RunScored'].includes(e.type)),
      decisions: s.dynamic.decisions, termination: s.dynamic.terminationReason };
    rows.push(row);
    // Retain every actual 60 Hz movement/ball sample and every role/runner
    // snapshot. Omit duplicate path vertices and unused hypothetical frames
    // beyond interception; exact settings regenerate the untouched projection.
    const trace = { ...s, phases: s.phases.map(p => ({ ...p, movements: p.movements.map(m => ({ ...m,
      path: m.samples ? [m.path[0], m.path.at(-1)] : m.path })) })),
      dynamic: { ...s.dynamic, ball: { ...s.dynamic.ball, trajectory: { ...s.dynamic.ball.trajectory, frames: undefined } } } };
    const line = JSON.stringify({ id: c.id, seed: c.seed, settings: c.settings, flags, omitted: ['Untouched projection frames; regenerate from settings', 'Duplicate path vertices when timed samples are present'], scenario: trace }) + '\n';
    if (!zip.write(line)) await once(zip, 'drain');
    if ((index + 1) % 250 === 0) console.log(`Audited ${index + 1}/${selected.length}`);
    if ((index + 1) % 20 === 0) await new Promise(resolve => setImmediate(resolve));
  }
  zip.end(); await once(file, 'close');
  const severities = ['Critical', 'High', 'Medium', 'Low'];
  const count = (key) => Object.fromEntries([...new Set(rows.map(key))].map(k => [k, { executed: rows.filter(r => key(r) === k).length, flagged: rows.filter(r => key(r) === k && r.flags.length).length }]));
  const head = (await readFile('.git/HEAD', 'utf8')).trim();
  const sourceCommit = head.startsWith('ref: ') ? (await readFile(`.git/${head.slice(5)}`, 'utf8')).trim() : head;
  const sourceHash = createHash('sha256');
  for (const root of ['src', 'scripts']) {
    const files = (await readdir(root, { recursive: true })).filter(p => /\.(ts|tsx|mjs|css)$/.test(p)).sort();
    for (const file of files) sourceHash.update(`${root}/${file}\0`).update(await readFile(`${root}/${file}`));
  }
  sourceHash.update(await readFile('package.json'));
  const summary = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourceCommit, sourceFilesSha256: sourceHash.digest('hex'),
    proposedBaseline: 1104, validBaseline: cases.filter(c => c.group === 'baseline').length, exclusions: exclusions.length, adjustments: adjustments.length,
    executed: rows.length, generated: rows.filter(r => !r.error).length, unflagged: rows.filter(r => !r.flags.length).length, flagged: rows.filter(r => r.flags.length).length,
    scenarioSeverity: Object.fromEntries(severities.map(sev => [sev, rows.filter(r => r.flags.some(f => f.severity === sev) && !severities.slice(0, severities.indexOf(sev)).some(higher => r.flags.some(f => f.severity === higher))).length])),
    byCode: Object.fromEntries([...new Set(rows.flatMap(r => r.flags.map(f => f.code)))].sort().map(code => [code, rows.filter(r => r.flags.some(f => f.code === code)).length])),
    byGroup: count(r => r.group), byType: count(r => r.settings.ball.type), elapsedSeconds: (Date.now() - started) / 1000,
    assumptions, ballPhysics, throwProfiles, throwPhysics,
    evidenceSha256: createHash('sha256').update(await readFile(evidenceFile)).digest('hex'),
    determinismReplays: rows.filter(r => r.group === 'seed' && !r.error).length,
    notes: ['Flagged includes advisory reviews; unflagged means passed implemented checks, not certified correct baseball.', 'Seeds perturb complete inputs; production simulation is deterministic and has no random seed API.', 'Times retain production microsecond quantization and include 1 second before contact.'] };
  await writeFile(`${output}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
  await writeFile(`${output}/results.json`, JSON.stringify(rows, null, 2) + '\n');
  await writeFile(`${output}/matrix-exceptions.json`, JSON.stringify({ exclusions, adjustments }, null, 2) + '\n');
  console.log(JSON.stringify(summary, (key, v) => ['assumptions', 'ballPhysics', 'throwProfiles', 'throwPhysics'].includes(key) ? undefined : v, 2));
  if (args.includes('--strict') && rows.some(r => r.flags.some(f => f.severity === 'Critical'))) process.exitCode = 1;
} finally { await server.close(); }
