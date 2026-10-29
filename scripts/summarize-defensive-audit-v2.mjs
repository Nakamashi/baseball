import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { createServer } from 'vite';
import { createServer as httpServer } from 'node:http';

const root = process.argv[2] ?? 'audit/defensive-v2-after';
const wanted = new Set([
  'dp-ss-average-hard-o0', 'dp-ss-slow-hard-o0', 'dp-2b-average-hard-o0', 'dp-3b-average-hard-o0',
  'dp-p-average-hard-o0', 'dp-1b-line-average-hard-o0', 'base-pop-pitcher-b1-o0',
  'base-ground-left-center-b2-o2', 'base-ground-second-b1-o0', 'focus-right-center-manual',
  'focus-left-center-manual', 'focus-right-center-home', 'focus-left-center-home', 'focus-loaded-relay', 'anticipate-bunt-third-line-b3-o0-normal',
  'anticipate-bunt-first-line-b1-o0-soft', 'focus-caught-line-retouch', 'focus-infield-fly',
  'focus-caught-third-out', 'strength-hard-ground-short-b1-o0', 'base-line-left-b0-o0',
]);
const server = await createServer({ server: { middlewareMode: true, hmr: { server: httpServer() } }, appType: 'custom' });
try {
  const { toWorld } = await server.ssrLoadModule('/src/dynamic/geometry.ts');
  const { sample } = await server.ssrLoadModule('/src/simulation/timeline.ts');
  const { formatDynamic } = await server.ssrLoadModule('/src/dynamic/messages.ts');
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const metres = (a, b) => { const p = toWorld(a), q = toWorld(b); return Math.hypot(p.x - q.x, p.y - q.y); };
  const zip = createGzip(), file = createWriteStream(`${root}/player-audits.jsonl.gz`); zip.pipe(file);
  const lines = createInterface({ input: createReadStream(`${root}/traces.jsonl.gz`).pipe(createGunzip()), crlfDelay: Infinity });
  const aggregate = Object.fromEntries(positions.map(id => [id, { scenarios: 0, maxSpeed: 0, initiallyHolding: 0, initialRoles: {}, receptions: 0, supportingAtRelease: 0, relevantBaseBackups: 0, baseBackupsReadyAtGlove: 0, supportChangedBeforeGlove: 0 } ]));
  const examples = {};
  await mkdir(`${root}/examples`, { recursive: true });
  for await (const line of lines) {
    const record = JSON.parse(line), s = record.scenario;
    const players = Object.fromEntries(positions.map(id => [id, { initialPosition: s.startingPositions[id], firstMovement: undefined, distanceTravelled: 0, maxSpeed: 0, roleChanges: [], receptions: [], supports: [] }]));
    const last = {};
    for (const p of s.phases) {
      for (const a of p.assignments) {
        const key = JSON.stringify([a.type, a.base, a.reason, a.target]);
        if (key !== last[a.player]) {
          players[a.player].roleChanges.push({ time: p.start, type: a.type, reason: a.reason, base: a.base, target: a.target });
          last[a.player] = key;
        }
      }
      for (const m of p.movements) {
        const v = players[m.player]; if (!v) continue;
        const points = m.samples ?? [{ t: 0, point: m.path[0] }, { t: p.duration, point: m.path.at(-1) }];
        for (let i = 1; i < points.length; i++) {
          const d = metres(points[i - 1].point, points[i].point), dt = points[i].t - points[i - 1].t;
          v.distanceTravelled += d;
          if (dt > 1e-8) v.maxSpeed = Math.max(v.maxSpeed, d / dt);
          if (!v.firstMovement && d > 1e-5) v.firstMovement = { time: p.start + points[i - 1].t, from: points[i - 1].point, toward: points[i].point };
        }
      }
    }
    for (const e of s.dynamic.events.filter(e => e.type === 'ThrowStarted')) {
      const glove = s.dynamic.events.find(v => v.type === 'ThrowGloveContact' && v.time > e.time);
      if (!glove) continue;
      const release = sample(s, e.time), at = sample(s, glove.time);
      players[glove.player].receptions.push({ release: e.time, glove: glove.time, from: e.player, actualPosition: at.players.find(p => p.id === glove.player).position });
      for (const a of release.phase.assignments.filter(a => ['BackupThrow', 'SupportBase', 'Cutoff', 'RelayTrailer'].includes(a.type))) {
        const actual = at.players.find(p => p.id === a.player).position;
        const remaining = metres(actual, a.target);
        const latest = at.phase.assignments.find(v => v.player === a.player);
        // Anticipated support for a later base and an optional cutoff are not
        // backups of this particular reception. Judge a base backup against
        // the actual receiving point/player, not a different leg of a relay.
        const receiverPoint = at.players.find(p => p.id === glove.player).position;
        const relevantBaseBackup = a.type === 'BackupThrow' && a.base === e.base &&
          (a.teammate === glove.player || (a.receivingPoint && metres(a.receivingPoint, receiverPoint) <= 0.65));
        players[a.player].supports.push({ release: e.time, glove: glove.time, type: a.type, base: a.base, target: a.target,
          actualPosition: actual, distanceFromReleaseTargetAtGlove: remaining, ready: remaining <= 0.65,
          relevantBaseBackup,
          changed: latest.type !== a.type || metres(latest.target, a.target) > 0.65 });
      }
    }
    const end = sample(s, s.phases.at(-1).start);
    for (const id of positions) {
      const p = players[id], a = aggregate[id]; p.finalPosition = end.players.find(v => v.id === id).position;
      a.scenarios++; a.maxSpeed = Math.max(a.maxSpeed, p.maxSpeed);
      const initial = p.roleChanges[0]?.type; a.initialRoles[initial] = (a.initialRoles[initial] ?? 0) + 1;
      if (initial === 'HoldPosition') a.initiallyHolding++;
      a.receptions += p.receptions.length; a.supportingAtRelease += p.supports.length;
      a.relevantBaseBackups += p.supports.filter(v => v.relevantBaseBackup).length;
      a.baseBackupsReadyAtGlove += p.supports.filter(v => v.relevantBaseBackup && v.ready).length;
      a.supportChangedBeforeGlove += p.supports.filter(v => v.changed).length;
    }
    if (!zip.write(JSON.stringify({ id: record.id, players }) + '\n')) await once(zip, 'drain');
    if (wanted.has(record.id)) {
      const example = { ...record, playerAudit: players, readableEvents: s.dynamic.events.map(e => ({ ...e, explanation: formatDynamic(e.explanation, 'en') ?? e.explanation })) };
      await writeFile(`${root}/examples/${record.id}.json`, JSON.stringify(example, null, 2) + '\n');
      examples[record.id] = { events: example.readableEvents, decisions: s.dynamic.decisions, allNine: players,
        ball: s.dynamic.ball, frames: s.dynamic.diagnostics.map(f => ({ time: f.time, trigger: f.trigger, target: f.target, route: f.route, assignments: f.assignments, issues: f.issues })) };
    }
  }
  zip.end(); await once(file, 'close');
  const results = JSON.parse(await readFile(`${root}/results.json`, 'utf8'));
  const dp = [];
  for (const strength of ['soft', 'normal', 'hard']) for (const speed of ['slow', 'average', 'fast']) {
    const cases = results.filter(r => r.group === 'double-play' && r.settings.ball.strength === strength && r.settings.runnerSpeed === speed && r.settings.state.outs < 2);
    dp.push({ strength, speed, scenarios: cases.length, doublePlays: cases.filter(r => r.outs >= 2).length,
      twoThrows: cases.filter(r => r.timing?.throws.length >= 2).length });
  }
  const situations = {};
  for (const r of results) {
    const key = `bases-${Object.values(r.settings.state.runners).join('') || 'empty'}-outs-${r.settings.state.outs}`;
    const v = situations[key] ??= { executed: 0, flagged: 0, outsRecorded: 0, runs: 0 };
    v.executed++; v.flagged += r.flags.length > 0; v.outsRecorded += r.outs ?? 0; v.runs += r.runs ?? 0;
  }
  await writeFile(`${root}/analysis.json`, JSON.stringify({ aggregate, doublePlayMatrix: dp, situations,
    examples: Object.keys(examples), supportCaveat: 'Support positions compare the release assignment to actual compiled position at glove contact. Only relevantBaseBackup jobs are judged as backups of this reception. Cutoff readiness needs its earlier flight-crossing deadline; future-base support and changed assignments are not automatically errors.' }, null, 2) + '\n');
  await writeFile(`${root}/examples/index.json`, JSON.stringify(Object.keys(examples), null, 2) + '\n');
  console.log(`Analyzed ${results.length} scenarios, ${Object.keys(examples).length} detailed examples, and all nine defenders. Wrote analysis.json and player-audits.jsonl.gz.`);
} finally { await server.close(); }
