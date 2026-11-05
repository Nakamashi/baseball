import {afterEach, describe, expect, it} from 'vitest';
import {DynamicPlayProvider, defaultSettings} from '../dynamic/provider';
import {DefensiveDecisionEngine, assignmentText} from '../dynamic/defense';
import {MovementEngine} from '../dynamic/movement';
import {BaserunningDecisionEngine} from '../dynamic/baserunning';
import {assumptions} from '../dynamic/conventions';
import {bases, fromWorld, isInfieldDiamond, metres, toWorld} from '../dynamic/geometry';
import {formatDynamic} from '../dynamic/messages';
import {duration, sample} from '../simulation/timeline';
import {validateScenario} from '../simulation/scenarioValidation';
import {positions} from '../simulation/types';
import {scenarios} from '../scenarios';
import type {DynamicScenario, DynamicSettings} from '../dynamic/types';
const provider = new DynamicPlayProvider();
afterEach(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const translated = (s:string) => formatDynamic(s, 'en') ?? s;
function pitcher(error=false) {
  const c=defaultSettings();c.ball.destination={x:495,y:618};c.includeError=error;return provider.generate(c);
}
function contact(s:DynamicScenario) {return s.phases.find(p=>p.title==='Contact')!;}
function purposeful(s:DynamicScenario) {
  expect(validateScenario(s)).toEqual([]);
  for(const f of s.dynamic.diagnostics) {
    expect(new Set(f.assignments.map(a=>a.player))).toEqual(new Set(positions));
    if(f.trigger==='PlayCompleted' || f.state.outs===3)continue;
    for(const a of f.assignments) {
      expect(a.reason).not.toBe('guardSpace');
      expect(a.reason).not.toBe('guardThird');
      expect(a.replacesOn).toContain('ThrowMissed');
      expect(a.replacesOn).toContain('RecoverySecured');
      const text=assignmentText(a);
      expect(translated(text.action)).not.toContain('Hold a useful supporting position');
      for(const value of Object.values(text)) {
        expect(formatDynamic(value,'en')).not.toMatch(/@v2:|\{\w+\}/);
        expect(formatDynamic(value,'ja')).toMatch(/[ぁ-んァ-ヶ一-龯]/);
      }
    }
  }
}
describe('all-nine purposeful defensive responsibilities',()=> {
  it.each([false,true])('moves the spare middle infielder, corner guard and deep backup on the exact pitcher grounder; error=%s',error=> {
    const s=pitcher(error), p=contact(s), job=(id:string)=>p.assignments!.find(a=>a.player===id)!;
    expect(s.dynamic.ball.fielder).toBe('P');
    expect(job('SS')).toMatchObject({type:'CoverBase',base:2});
    expect(job('2B')).toMatchObject({type:'SupportReceiver',reason:'middleSupport',base:2,teammate:'SS'});
    expect(metres(job('2B').target,bases[2])).toBeGreaterThan(4);
    expect(isInfieldDiamond(job('2B').target)).toBe(false);
    expect(job('3B')).toMatchObject({type:'GuardBase',base:3});
    expect(metres(job('3B').target,bases[3])).toBeLessThan(3.1);
    expect(job('RF')).toMatchObject({type:'BackupThrow',base:2});
    expect(job('CF')).toMatchObject({type:'SupportBase',reason:'layeredBackup',base:2,teammate:'RF'});
    expect(metres(job('CF').target,bases[2])).toBeGreaterThan(metres(job('RF').target,bases[2])+10);
    for(const id of positions) {
      expect(p.movements.some(m=>m.player===id),`${id} starts its job at contact`).toBe(true);
      expect(s.phases.some(ph=>ph.movements.some(m=>m.player===id&&m.path.some(q=>metres(m.path[0],q)>0.05)))).toBe(true);
    }
    purposeful(s);
    if(error) {
      const selected=s.dynamic.throwingError!.selected!, rec=s.dynamic.throwingError!.recovery!;
      expect(rec.player).toBe(rec.candidates[0].player);
      expect(rec.secureTime).toBeLessThan(6.3); // previous stationary-CF control: 7.175613 s
      expect(Math.hypot(rec.recognitionVelocities.CF.x,rec.recognitionVelocities.CF.y)).toBeGreaterThan(1);
      expect(s.dynamic.events.filter(e=>e.type==='RunnerOut' && e.player==='R1')).toEqual([]);
      expect(selected.recognitionTime).toBeGreaterThan(selected.missTime);
    }
  });
  it('keeps the original pitcher double-play throws and legal force results with errors off',()=> {
    const s=pitcher();
    expect(s.dynamic.events.filter(e=>e.type==='ThrowStarted').map(e=>[e.player,e.base,e.time]))
      .toEqual([['P',2,2.609177],['SS',1,3.957565]]);
    expect(s.dynamic.events.filter(e=>e.type==='RunnerOut').map(e=>[e.player,e.base,e.force]))
      .toEqual([['R1',2,true],['BR',1,true]]);
  });
  it('uses fixed support anchors and leaves the running lanes clear instead of drifting at each reassessment',()=> {
    const c=defaultSettings();c.ball.destination={x:495,y:618};
    const move=new MovementEngine(),loc=move.starting(c),ball=move.field(c,loc),runners=new BaserunningDecisionEngine().create(c);
    const d=new DefensiveDecisionEngine();
    const first=d.assign(c,ball,'P',2,loc,'contact',{runners,outs:0});
    const moved={...loc,'2B':fromWorld({x:4.2,y:-39}),'3B':fromWorld({x:-20,y:-23})};
    const again=d.assign(c,ball,'P',2,moved,'contact',{runners,outs:0});
    const segmentDistance=(q:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number})=> {
      const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy)));
      return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy);
    };
    const corners=[bases.home,bases[1],bases[2],bases[3]].map(toWorld);
    for(const id of ['2B','3B']) {
      const a=first.assignments.find(a=>a.player===id)!;
      expect(a.target).toEqual(again.assignments.find(a=>a.player===id)!.target);
      for(let n=0;n<4;n++)expect(segmentDistance(toWorld(a.target),corners[n],corners[(n+1)%4])).toBeGreaterThan(1);
    }
  });
  it('makes replacement coverage outrank a former supporting job when the shortstop has the ball',()=> {
    const c=defaultSettings(),move=new MovementEngine(),loc=move.starting(c),ball=move.field(c,loc);
    const runners=new BaserunningDecisionEngine().create(c);runners.find(r=>r.id==='R1')!.goal=3;
    loc['2B']=fromWorld({x:4,y:toWorld(bases[2]).y-2});loc.SS=fromWorld({x:0,y:-52});
    const layout=new DefensiveDecisionEngine().assign(c,ball,'SS','hold',loc,'received',{runners,outs:0});
    expect(layout.assignments.find(a=>a.player==='2B')).toMatchObject({type:'CoverBase',base:2});
    expect(layout.assignments.find(a=>a.player==='3B')).toMatchObject({type:'CoverBase',base:3});
  });
  it('allows a receiver already set on the bag to wait without artificial motion',()=> {
    const c=defaultSettings(),move=new MovementEngine(),loc=move.starting(c),ball=move.field(c,loc);
    loc.SS=bases[2];const runners=new BaserunningDecisionEngine().create(c);
    const a=new DefensiveDecisionEngine().assign(c,ball,'P',2,loc,'fielded',{runners,outs:0,fixedReceiver:'SS'})
      .assignments.find(a=>a.player==='SS')!;
    expect(a).toMatchObject({type:'CoverBase',base:2,target:bases[2]});
    expect(a.arrivalTime).toBe(0);
    expect(translated(assignmentText(a).action)).toContain('second');
  });
  it.each(['Ground ball','Bunt','Line drive','Fly ball','Pop-up'] as const)('reviews every occupancy/out combination across three %s sectors, with and without an error',type=> {
    for(const angle of [-35,0,35])for(let mask=0;mask<8;mask++)for(const outs of [0,1,2])for(const includeError of [false,true]) {
      const c=defaultSettings(),depth=type==='Bunt'?10:type==='Pop-up'?25:type==='Ground ball'?25:65;
      c.ball={type,strength:'normal',destination:fromWorld({x:depth*Math.sin(angle*Math.PI/180),y:-depth*Math.cos(angle*Math.PI/180)})};
      c.state.runners=Object.fromEntries([1,2,3].filter(b=>mask&(1<<(b-1))).map(b=>[`R${b}`,b]));
      c.state.outs=outs;c.includeError=includeError;
      const s=provider.generate(c);purposeful(s);
      for(const id of positions)expect(s.phases.some(p=>p.movements.some(m=>m.player===id&&m.path.some(q=>metres(m.path[0],q)>0.05))),
        `${type} angle=${angle} mask=${mask} outs=${outs} error=${includeError}: ${id}`).toBe(true);
      const before=sample(s,Math.min(3,duration(s)/2));sample(s,duration(s));sample(s,0);
      expect(sample(s,before.time)).toEqual(before);
    }
  },30000);
  it.each(scenarios)('gives all nine real contact movement and bilingual duties in guided play $id',s=> {
    expect(validateScenario(s)).toEqual([]);
    const p=s.phases.find(p=>p.title==='Contact')!;
    for(const id of positions) {
      const m=p.movements.find(m=>m.player===id);
      expect(m,`${s.id} ${id}`).toBeDefined();
      expect(m!.path.some(q=>metres(m!.path[0],q)>0.05)).toBe(true);
    }
  });
  it('ends live jobs after the third out without assigning fresh pursuit or coverage',()=> {
    const c=defaultSettings();c.ball.destination={x:495,y:618};c.state.outs=2;
    const s=provider.generate(c),out=s.dynamic.events.find(e=>e.type==='RunnerOut')!;
    for(const p of s.phases.filter(p=>p.start>=out.time))for(const a of p.assignments!)
      expect(['Decelerate','PossessBall','HoldPosition']).toContain(a.type);
    expect(sample(s,duration(s)).state.outs).toBe(3);
    expect(s.dynamic.events.filter(e=>e.type==='ThrowStarted'&&e.time>out.time)).toEqual([]);
  });
});
