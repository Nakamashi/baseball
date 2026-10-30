import {afterEach, describe, expect, it, vi} from 'vitest';
import corpus from './fixtures/clean-error-baseline.json';
import recoveryCases from './fixtures/error-recovery-cases.json';
import {baseTouchTime, firstTurnPoint, remainingRunningTime} from '../dynamic/runningGeometry';
import {TimelineBuilder} from '../dynamic/timelineBuilder';
import {MovementEngine} from '../dynamic/movement';
import {inspectDefense} from '../dynamic/diagnostics';
import {defaultSettings, DynamicPlayProvider, validateSettings} from '../dynamic/provider';
import {elevatedOverthrow, errorPolicy, ErrorRecoveryFailure, recoveryCandidates, supportedLoosePoint} from '../dynamic/throwRecovery';
import {advanceThrownBall, throwFlight, throwingProfile} from '../dynamic/throwing';
import {readLooseThrow, looseThrowRunningTime} from '../dynamic/baserunning';
import {assumptions} from '../dynamic/conventions';
import {bases, fromWorld, toWorld, metres} from '../dynamic/geometry';
import {DefensiveDecisionEngine} from '../dynamic/defense';
import {formatDynamic} from '../dynamic/messages';
import {duration, sample} from '../simulation/timeline';
import {validateScenario} from '../simulation/scenarioValidation';
import {positions} from '../simulation/types';
import type {DynamicScenario, DynamicSettings, OffensiveRunner} from '../dynamic/types';
const provider=new DynamicPlayProvider();
function bunt(): DynamicSettings {
  const s=defaultSettings();s.ball={type:'Bunt',destination:{x:500,y:650},strength:'hard'};
  s.anticipateBunt=true;s.aggression='aggressive';s.includeError=true;return s;
}
const events=(s:DynamicScenario,type:string)=>s.dynamic.events.filter(e=>e.type===type);
function integrity(s:DynamicScenario) {
  expect(validateScenario(s)).toEqual([]);
  expect(events(s,'PlayCompleted')).toHaveLength(1);
  expect(duration(s)).toBeLessThan(65);
  const final=sample(s,duration(s));
  expect(final.owner).toBeDefined();
  expect(new Set(Object.values(final.state.runners)).size).toBe(Object.values(final.state.runners).length);
  const outs=events(s,'RunnerOut');expect(new Set(outs.map(e=>e.player)).size).toBe(outs.length);
  for(const p of s.phases) {
    expect(new Set(p.assignments!.map(a=>a.player))).toEqual(new Set(positions));
    for(const r of Object.values(p.responsibilities))for(const value of Object.values(r))
      expect(formatDynamic(value,'ja')).toMatch(/[ぁ-んァ-ヶ一-龯]/);
    for(const move of p.movements) for(let i=1;i<(move.samples?.length ?? 0);i++) {
      const a=move.samples![i-1],b=move.samples![i];
      const maximum=move.player==='BR'?10:assumptions.defenderSpeed;
      expect(metres(a.point,b.point)).toBeLessThanOrEqual(maximum*(b.t-a.t)+0.0001);
    }
  }
}
afterEach(()=>vi.restoreAllMocks());
describe('clean simulation equivalence captured before implementation',()=> {
  it.each(corpus.cases)('preserves every compiled clean field for $id',async c=> {
    for(const includeError of [undefined,false]) {
      const input=structuredClone(c.settings) as DynamicSettings;
      if(includeError!==undefined)input.includeError=includeError;
      const p=provider.generate(input);
      delete p.dynamic.settings.includeError;
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(p)));
      expect(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')).toBe(c.sha256);
    }
  });
  it('baseline contains a genuine caught ball, boundary, relay, tags, forces and scoring',()=> {
    const es=corpus.cases.flatMap(c=>c.events as {type:string;force?:boolean}[]);
    expect(es.some(e=>e.type==='BallCaught')).toBe(true);
    expect(es.some(e=>e.type==='BallBoundary')).toBe(true);
    expect(es.some(e=>e.type==='RunScored')).toBe(true);
    expect(es.some(e=>e.type==='RunnerOut' && e.force===false)).toBe(true);
    expect(es.some(e=>e.type==='RunnerOut' && e.force===true)).toBe(true);
    expect(corpus.cases.some(c=>c.events.filter(e=>e.type==='ThrowStarted').length>1)).toBe(true);
  });
});
describe('continuous elevated overthrow and true recovery',()=> {
  it('misses SS on the verified P bunt, keeps the ball live and completes a reachable recovery',()=> {
    const s=provider.generate(bunt()), meta=s.dynamic.throwingError!, chosen=meta.selected!, recovery=meta.recovery!;
    expect(chosen).toMatchObject({thrower:'P',receiver:'SS'});
    expect(events(s,'ThrowMissed')).toHaveLength(1);
    expect(events(s,'ThrowReceived').filter(e=>e.player==='SS' && e.base===2)).toEqual([]);
    expect(events(s,'RunnerOut').filter(e=>e.player==='R1'&&e.base===2)).toEqual([]);
    expect(chosen.trajectory.missHeight).toBeGreaterThan(2.25);
    expect(recovery.player).toBe(recovery.candidates[0].player);
    expect(recovery.player).toBe('CF'); // RF's late backup is not an automatic catch.
    expect(recovery.secureTime-recovery.touchTime).toBeCloseTo(assumptions.fieldDelay,5);
    expect(sample(s,(recovery.touchTime+recovery.secureTime)/2).owner).toBeUndefined();
    expect(sample(s,recovery.secureTime).owner).toBe(recovery.player);
    for(let t=chosen.releaseTime+0.02;t<recovery.touchTime;t+=0.13)expect(sample(s,t).owner).toBeUndefined();
    const start=s.dynamic.diagnostics.find(f=>f.trigger==='Initial contact plan')!;
    expect(start.assignments.find(a=>a.player==='RF')).toMatchObject({type:'BackupThrow',base:2});
    expect(start.assignments.find(a=>a.player==='CF')).toMatchObject({type:'HoldPosition'});
    expect(Math.hypot(recovery.recognitionVelocities.RF.x,recovery.recognitionVelocities.RF.y)).toBeGreaterThan(1);
    expect(events(s,'ErrorRunnerRead')[0].time).toBeCloseTo(chosen.missTime+errorPolicy.readDelay,5);
    expect(sample(s,duration(s)).state.runners).toMatchObject({R1:3,BR:1});
    integrity(s);
  });
  it('preserves initial defender and runner behavior until the observable miss',()=> {
    const input=bunt(), failed=provider.generate(input);input.includeError=false;const clean=provider.generate(input);
    const miss=failed.dynamic.throwingError!.selected!.missTime;
    for(let t=0;t<miss-0.01;t+=0.17) {
      const a=sample(failed,t),b=sample(clean,t);
      for(const player of a.players)expect(metres(player.position,b.players.find(p=>p.id===player.id)!.position)).toBeLessThan(0.001);
    }
  });
  it('preserves analytic flight position, height and velocity; impacts lose energy and the unfielded ball stops naturally',()=> {
    const s=provider.generate(bunt()), tr=s.dynamic.throwingError!.selected!.trajectory;
    const release=tr.frames[0];
    expect(Math.hypot(...Object.values(release.velocity))).toBeCloseTo(throwingProfile(release.point,bases[2],'P').speed,9);
    expect(tr.angle).toBeGreaterThan(throwFlight(release.point,bases[2],'P').angle);
    expect(tr.frames.every(f=>supportedLoosePoint(f.point))).toBe(true);
    expect(tr.events.some(e=>e.type==='landing')).toBe(true);
    expect(tr.frames.at(-1)!.state).toBe('stopped');
    for(let i=1;i<tr.frames.length;i++) {
      const a=tr.frames[i-1],b=tr.frames[i],dt=b.t-a.t;
      expect(dt).toBeGreaterThan(0);
      expect(metres(a.point,b.point)).toBeLessThanOrEqual(23*dt+0.00001);
      const impact=tr.events.some(e=>(e.type==='landing'||e.type==='bounce')&&Math.abs(e.t-b.t)<1e-7);
      if(a.state==='airborne'||a.state==='bouncing') {
        const expected=advanceThrownBall(toWorld(a.point),a.height!,a.velocity,dt);
        expect(metres(fromWorld(expected.position),b.point)).toBeLessThan(1e-7);
        expect(b.height).toBeCloseTo(expected.height,7);
        if(!impact)for(const k of ['x','y','z'] as const)expect(b.velocity[k]).toBeCloseTo(expected.velocity[k],7);
        else expect(Math.hypot(...Object.values(b.velocity))).toBeLessThan(Math.hypot(...Object.values(expected.velocity)));
      }
    }
    // Playback phase cuts, including recognition, never detach the ball.
    const selected=s.dynamic.throwingError!.selected!,end=s.dynamic.throwingError!.recovery!.touchTime;
    for(const p of s.phases.filter(p=>p.start>selected.releaseTime && p.start<end)) {
      expect(metres(sample(s,p.start-1e-6).ball,sample(s,p.start).ball)).toBeLessThan(0.001);
      expect(Math.abs(sample(s,p.start-1e-6).ballHeight!-sample(s,p.start).ballHeight!)).toBeLessThan(0.001);
    }
  });
  it('keeps forward/backward seeking and repeated generation deterministic',()=> {
    const s=provider.generate(bunt());expect(provider.generate(bunt())).toEqual(s);
    const times=s.dynamic.events.filter(e=>['ThrowMissed','RecoveryTouched','RecoverySecured'].includes(e.type)).map(e=>e.time);
    for(const t of times) {const expected=sample(s,t);sample(s,duration(s));sample(s,0);expect(sample(s,t)).toEqual(expected);}
  });
  it('rejects unsupported corridors rather than clamping a throw or granting an award',()=> {
    expect(elevatedOverthrow(fromWorld({x:25,y:-20}),bases[2],'P','standard').outcome).toBe('received');
    expect(elevatedOverthrow(fromWorld({x:0,y:-39}),bases[2],'P','standard').outcome).toBe('received');
    const s=bunt();s.throwTarget='hold';const p=provider.generate(s);
    expect(p.dynamic.throwingError!.status).toBe('no-eligible-throw');
    expect(p.notes.map(n=>formatDynamic(n,'en')).join()).toContain('No eligible throwing error');
    expect(events(p,'RecoverySecured')).toEqual([]);
    const f=structuredClone(corpus.cases.find(c=>c.id==='caught-fly')!.settings) as DynamicSettings;f.includeError=true;
    expect(provider.generate(f).dynamic.throwingError!.status).toBe('no-eligible-throw');
    expect(validateSettings({...bunt(),includeError:'yes' as unknown as boolean})).toBeDefined();
  });
});

describe('error runner reads, further defense and bounded completion',()=> {
  it('holds both runners when the current recovery/return window is too short for conservative advancement',()=> {
    const c=bunt();c.ball={type:'Ground ball',strength:'normal',destination:fromWorld({x:0,y:-5})};
    c.aggression='conservative';
    const s=provider.generate(c);
    expect(s.dynamic.throwingError!.status).toBe('injected');
    expect(sample(s,duration(s)).state.runners).toEqual({BR:1,R1:2});
    const read=s.dynamic.diagnostics.find(d=>d.trigger==='Observed error / coordinated runner read')!;
    expect(read.runners.find(r=>r.id==='R1')!.plan!.candidates[0]).toMatchObject({accepted:false});
    c.aggression='aggressive';
    const risk=provider.generate(c);
    expect(risk.dynamic.diagnostics.find(d=>d.trigger==='Observed error / coordinated runner read')!.runners.find(r=>r.id==='R1')!.goal).toBe(3);
    integrity(s);integrity(risk);
  });
  it('compares every runner at one observation time, keeping base ordering and independent aggression margins',()=> {
    const runners:OffensiveRunner[]=[
      {id:'R1',originBase:1,progress:2,goal:2,speed:7,runVelocity:0,status:'active',decision:'hold'},
      {id:'BR',originBase:0,progress:1,goal:1,speed:7,runVelocity:0,status:'active',decision:'hold',approach:'straight',firstTurn:{kind:'overrun',stage:'complete',travelled:0,extent:8,readRemaining:0}},
    ];
    const positionsBefore=runners.map(r=>r.progress);
    readLooseThrow(bunt(),runners,()=>20);
    expect(runners.map(r=>r.progress)).toEqual(positionsBefore);
    expect(runners.map(r=>r.goal)).toEqual([3,2]);
    const blocked=structuredClone(runners);blocked[0].goal=2;blocked[1].goal=1;
    readLooseThrow(bunt(),blocked,(base)=>base===3?0:20);
    expect(blocked.map(r=>r.goal)).toEqual([2,1]);
  });
  it('retains an already-started overrun/return when reading a possible second-base attempt',()=> {
    const c=bunt();
    const r:OffensiveRunner={id:'BR',originBase:0,progress:1,goal:1,speed:7,runVelocity:4,
      status:'active',decision:'advance',approach:'straight',firstTurn:{kind:'overrun',stage:'outbound',travelled:3,extent:8,readRemaining:0.35}};
    const before=structuredClone(r);
    expect(looseThrowRunningTime(r,2)).toBeGreaterThan(8);
    readLooseThrow(c,[r],()=>25);
    expect(r.firstTurn).toEqual(before.firstTurn);expect(r.runVelocity).toBe(before.runVelocity);
    expect(r.goal).toBe(1);expect(r.afterFirstReturnGoal).toBe(2);
    const locations={...new MovementEngine().starting(c),BR:firstTurnPoint(r)};
    const builder=new TimelineBuilder({...c.state,runners:{BR:1}},locations,[r]);
    for(let pass=0;pass<8 && r.firstTurn;pass++)
      builder.interval('Return',formatDynamic(r.plan!.reason,'en')!,remainingRunningTime(r),{kind:'held',owner:'P'},true,false,true);
    expect(r.firstTurn).toBeUndefined();expect(r.goal).toBe(2);
    expect(metres(builder.locations.BR,bases[1])).toBeLessThan(0.001);
    expect(r.runVelocity).toBe(0);
    builder.interval('Advance',formatDynamic(r.plan!.reason,'en')!,remainingRunningTime(r),{kind:'held',owner:'P'});
    expect(builder.state.runners.BR).toBe(2);
  });
  it('fails explicitly when the continuation time budget is exhausted instead of emitting PlayCompleted',()=> {
    const original=errorPolicy.maximumLiveTime;
    Object.assign(errorPolicy,{maximumLiveTime:1});
    try {expect(()=>provider.generate(bunt())).toThrow(ErrorRecoveryFailure);}
    finally {Object.assign(errorPolicy,{maximumLiveTime:original});}
  });
  it('fails explicitly on an exhausted action budget before making a further recovered throw',()=> {
    const original=errorPolicy.maximumActions;
    Object.assign(errorPolicy,{maximumActions:0});
    try {expect(()=>provider.generate(structuredClone(recoveryCases[0].settings) as DynamicSettings)).toThrow(ErrorRecoveryFailure);}
    finally {Object.assign(errorPolicy,{maximumActions:original});}
  });
  it('retains moving RF momentum and chooses actual reachability instead of assigning the backup possession',()=> {
    const s=provider.generate(bunt()), meta=s.dynamic.throwingError!, rec=meta.recovery!, t=meta.selected!.recognitionTime;
    const before=toWorld(sample(s,t).players.find(p=>p.id==='RF')!.position);
    const after=toWorld(sample(s,t+0.001).players.find(p=>p.id==='RF')!.position);
    expect((after.x-before.x)/0.001).toBeCloseTo(rec.recognitionVelocities.RF.x,1);
    expect((after.y-before.y)/0.001).toBeCloseTo(rec.recognitionVelocities.RF.y,1);
    const computed=recoveryCandidates(meta.selected!.trajectory,t-meta.selected!.releaseTime,rec.recognitionPositions,rec.recognitionVelocities,
      ['P','2B','SS','LF','CF','RF']);
    expect(computed[0].player).toBe(rec.player);
    expect(computed[0].time).toBeCloseTo(rec.touchTime-meta.selected!.releaseTime,5);
  });
});

describe('independent recovered out / first-base motion fixtures',()=> {
  it.each(recoveryCases)('resolves $name from actual recovery and legal runner state',fixture=> {
    const s=provider.generate(structuredClone(fixture.settings) as DynamicSettings);
    integrity(s);
    expect(events(s,'ThrowMissed')).toHaveLength(1);
    expect(events(s,'RecoverySecured')).toHaveLength(1);
    const meta=s.dynamic.throwingError!, control=meta.recovery!.secureTime;
    const brRead=s.dynamic.diagnostics.find(f=>f.trigger==='Observed error / coordinated runner read')!.runners.find(r=>r.id==='BR')!;
    expect(brRead).toMatchObject({goal:2,errorTurnAtFirst:true,approach:'straight'});
    const first=events(s,'RunnerAdvanced').find(e=>e.player==='BR'&&e.base===1)!;
    expect(metres(sample(s,first.time).players.find(p=>p.id==='BR')!.position,bases[1])).toBeLessThan(0.001);
    const before=sample(s,first.time-0.001).players.find(p=>p.id==='BR')!.position;
    const after=sample(s,first.time+0.001).players.find(p=>p.id==='BR')!.position;
    expect(metres(before,after)).toBeLessThan(0.0001); // stop before the turn
    expect(events(s,'FirstBaseOverrun').filter(e=>e.player==='BR')).toEqual([]);
    if(fixture.name.startsWith('recovered-tag')) {
      const out=events(s,'RunnerOut').find(e=>e.player==='BR')!;
      expect(out).toMatchObject({base:2,force:false});expect(out.time).toBeGreaterThan(control);
      const finalThrow=events(s,'ThrowStarted').filter(e=>e.time>=control).at(-1)!;
      expect(finalThrow).toBeDefined();
      const receipt=events(s,'ThrowReceived').find(e=>e.time>finalThrow.time)!;
      const at=sample(s,out.time);
      expect(metres(at.players.find(p=>p.id==='BR')!.position,at.players.find(p=>p.id===receipt.player)!.position)).toBeLessThanOrEqual(assumptions.fieldingReach+0.001);
      expect(s.dynamic.decisions.find(d=>d.time!>=control && d.runner==='BR')).toMatchObject({override:false,force:false});
      if(fixture.settings.state.outs===2) {
        expect(at.state.outs).toBe(3);
        const validRuns=events(s,'RunScored').filter(e=>e.time<out.time-1e-6).length;
        expect(sample(s,duration(s)).state.runs).toBe(validRuns);
        expect(sample(s,duration(s)).state.runners).toEqual({});
      }
    } else {
      const second=events(s,'RunnerAdvanced').find(e=>e.player==='BR'&&e.base===2)!;
      expect(second).toBeDefined();
      const readTime=meta.selected!.recognitionTime;
      expect(second.time-readTime).toBeCloseTo(baseTouchTime(brRead,2),4);
    }
    const ledger=inspectDefense(s,control).timingLedger.throws;
    expect(ledger[0]).toMatchObject({outcome:'missed',glove:undefined,secured:undefined});
  });
  it.each([0,1,2])('keeps multiple-runner occupancy, outs and scoring legal with %s initial outs',outs=> {
    for(const runners of [{R1:1,R2:2},{R1:1,R3:3},{R1:1,R2:2,R3:3}] as DynamicSettings['state']['runners'][]) {
      const c=bunt();c.state.outs=outs;c.state.runners=runners;c.throwTarget=2;
      const s=provider.generate(c);integrity(s);
      expect(events(s,'ThrowMissed').length).toBeLessThanOrEqual(1);
      expect(sample(s,duration(s)).state.outs).toBe(outs+events(s,'RunnerOut').length);
    }
  });
});
