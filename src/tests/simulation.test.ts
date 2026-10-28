import {describe,it,expect} from 'vitest';
import {scenarios} from '../scenarios';
import {defaults,bases,interpolate} from '../simulation/geometry';
import {advance,duration,sample,stepTime} from '../simulation/timeline';
import {ScriptedPlayProvider} from '../simulation/scriptedPlayProvider';
import {validateScenario} from '../simulation/scenarioValidation';
describe('authored catalogue',()=>{
 it('contains 24 unique, structurally valid scenarios',()=>{expect(scenarios.length).toBe(24);expect(new Set(scenarios.map(s=>s.id)).size).toBe(24);expect(scenarios.flatMap(validateScenario)).toEqual([])});
 it.each(scenarios)('$id has stable initial positions, runners, and single possession',s=>{const snap=sample(s,0);for(const [id,p]of Object.entries(defaults))expect(snap.players.find(v=>v.id===id)?.position).toEqual(p);for(const [id,b]of Object.entries(s.initial.runners))expect(snap.players.find(v=>v.id===id)?.position).toEqual(bases[b]);for(let t=0;t<=duration(s);t+=.2){const frame=sample(s,t);expect(frame.players.filter(p=>p.hasBall).length).toBe(frame.owner?1:0);if(frame.owner)expect(frame.ball).toEqual(frame.players.find(p=>p.id===frame.owner)!.position)}});
 it('keeps recorded outs consistent with retired runners',()=>{for(const s of scenarios){for(const phase of s.phases){const retired=Object.values(phase.statuses).filter(v=>v==='out').length;expect(phase.state.outs).toBe(s.initial.outs+retired)}}});
 it('rejects bad scenario data',()=>{const s=structuredClone(scenarios[0]);delete s.startingPositions.P;s.phases[1].start=-1;s.phases[2].state.outs=4;s.phases[1].movements.push({player:'ghost' as 'P',path:[{x:-1,y:0}]});expect(validateScenario(s).length).toBeGreaterThan(3)});
});
describe('deterministic timeline',()=>{
 const s=scenarios[0];
 it('interpolates along distance across multiple segments',()=>{expect(interpolate([{x:0,y:0},{x:10,y:0},{x:10,y:30}],.5)).toEqual({x:10,y:10})});
 it('scrubs backward, forward, and restarts without residual state',()=>{const expected=sample(s,4);sample(s,duration(s));expect(sample(s,4)).toEqual(expected);expect(sample(s,0).state.outs).toBe(0);expect(sample(s,duration(s)).state.outs).toBe(1);expect(sample(s,0).players.find(p=>p.id==='BR')?.status).toBe('active')});
 it('pauses, resumes at the selected speed, and stops at the end',()=>{expect(advance(4,2,1,duration(s),false)).toBe(4);expect(advance(4,2,2,duration(s),true)).toBe(8);expect(advance(duration(s)-1,5,1,duration(s),true)).toBe(duration(s))});
 it('steps in both directions at phase boundaries',()=>{expect(stepTime(s,0,1)).toBe(s.phases[1].start);expect(stepTime(s,s.phases[2].start,-1)).toBe(s.phases[1].start)});
 it('distinguishes successful and late double-play relays',()=>{expect(sample(scenarios[5],100).state.outs).toBe(2);expect(sample(scenarios[7],100).state.outs).toBe(1);expect(sample(scenarios[7],100).state.runners).toEqual({BR:1})});
 it('tracks tag-ups, sacrifice runs, and bunt coverage',()=>{const fly=scenarios[14];const catchPhase=fly.phases.find(p=>p.title==='Catch')!;expect(sample(fly,catchPhase.start).players.find(p=>p.id==='R3')?.position).toEqual(bases[3]);expect(sample(fly,100).state.runs).toBe(1);expect(sample(scenarios[16],100).state.runners).toEqual({R2:3});expect(sample(scenarios[23],100).owner).toBe('2B');expect(sample(scenarios[23],100).state.runners).toEqual({R1:2})});
});
describe('scripted provider',()=>{const provider=new ScriptedPlayProvider(scenarios);it('matches occupancy, outs, ball type and direction; count is context only',()=>{const s=scenarios[5];const result=provider.resolve({...s.initial,balls:3,strikes:2},s.ballEvent);expect(result.supported).toBe(true);if(result.supported)expect(result.scenarios.map(s=>s.id)).toEqual(['06']);expect(provider.resolve({...s.initial,outs:2},s.ballEvent).supported).toBe(true);expect(provider.resolve({...s.initial,runners:{R3:3}},s.ballEvent).supported).toBe(false)});it('does not misapply an infield fly to two outs',()=>expect(provider.resolve({...scenarios[17].initial,outs:2},scenarios[17].ballEvent).supported).toBe(false))});
