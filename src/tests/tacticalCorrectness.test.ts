import {describe,it,expect,afterEach} from "vitest";
import {DynamicPlayProvider,defaultSettings} from "../dynamic/provider";
import {sample,duration} from "../simulation/timeline";
import {positions,type Position} from "../simulation/types";
import {validateScenario} from "../simulation/scenarioValidation";
import {formatDynamic} from "../dynamic/messages";
import {DefensiveDecisionEngine} from "../dynamic/defense";
import {MovementEngine} from "../dynamic/movement";
import {BaserunningDecisionEngine} from "../dynamic/baserunning";
import type{DynamicSettings,DynamicScenario}from"../dynamic/types";
const provider=new DynamicPlayProvider();afterEach(()=>new Promise<void>(r=>setTimeout(r,0)));
function make(x=425,y=425,type:DynamicSettings["ball"]["type"]="Ground ball") {const c=defaultSettings();c.ball={type,destination:{x,y},strength:"hard"};c.aggression="aggressive";return c;}
function audit(s:DynamicScenario){expect(validateScenario(s)).toEqual([]);for(const p of s.phases){expect(new Set(p.assignments!.map(a=>a.player))).toEqual(new Set(positions));for(const r of Object.values(p.responsibilities))for(const v of Object.values(r)){expect(formatDynamic(v,"en")).not.toMatch(/@v2:|\{\w+\}/);expect(formatDynamic(v,"ja")).toMatch(/[ぁ-んァ-ヶ一-龯]/);}}const t=duration(s)*.43,a=sample(s,t);sample(s,duration(s));sample(s,0);expect(sample(s,t)).toEqual(a);}
const throws=(s:DynamicScenario)=>s.dynamic.events.filter(e=>e.type==="ThrowStarted");
describe("baseball tactical correctness: force continuations and finishing",()=>{
 it.each([423,425,427])("attempts the 6-4-3 at nearby x=%s when both timings permit",x=>{const c=make(x);c.runnerSpeed="slow";const s=provider.generate(c);expect(throws(s).map(e=>[e.player,e.base])).toEqual([["SS",2],["2B",1]]);expect(s.dynamic.decisions[0].continuation).toBeDefined();expect(sample(s,duration(s)).state.outs).toBe(2);audit(s);});
 it.each(["slow","average","fast"]as const)("evaluates the full sequence and actual second-throw timing for a %s BR",speed=>{const c=make();c.runnerSpeed=speed;const s=provider.generate(c),d=s.dynamic.decisions[0];expect(d.alternatives?.find(a=>a.target===2)?.continuation).toBeDefined();const out=s.dynamic.events.find(e=>e.type==="RunnerOut");if(throws(s).length>1){expect(out!.time).toBeLessThan(throws(s)[1].time);expect(throws(s)[1].time-out!.time).toBeLessThan(.8);}else expect(d.continuation!.margin).toBeLessThan(0);audit(s);});
 it("secures the third out and generates no unnecessary relay",()=>{const c=make();c.state.outs=2;c.runnerSpeed="slow";const s=provider.generate(c);const out=s.dynamic.events.find(e=>e.type==="RunnerOut")!;expect(sample(s,duration(s)).state.outs).toBe(3);expect(throws(s).filter(e=>e.time>out.time)).toEqual([]);audit(s);});
 it("cancels obsolete pitcher/OF backup assignments once all throw opportunities close",()=>{const c=make(396,473);c.state.runners={};const s=provider.generate(c);const done=s.phases.find(p=>p.title==="Hold the ball")!;expect(done).toBeDefined();for(const p of s.phases.filter(p=>p.start>=done.start))for(const a of p.assignments!)expect(["BackupThrow","BackupFielder","SupportBase","TrailRunner"]).not.toContain(a.type);audit(s);});
 it("covers third for an imminent advancing R2 even when the chosen return is to second",()=>{const c=make(200,230,"Line drive"),move=new MovementEngine(),loc=move.starting(c),ball=move.field(c,loc),r=new BaserunningDecisionEngine().create(c);r[0]={...r[0],id:"R2",originBase:2,progress:2.4,goal:3,decision:"advance"};const a=new DefensiveDecisionEngine().assign(c,ball,ball.fielder,2,loc,"contact",{runners:r,outs:0});expect(a.assignments.some(a=>a.type==="CoverBase"&&a.base===3)).toBe(true);});
 it("records all meaningful targets and rejected alternatives for a deliberate hold",()=>{const c=make();c.throwTarget="hold";const s=provider.generate(c);expect(throws(s)).toEqual([]);expect(s.dynamic.decisions[0].rejections?.map(r=>r.target)).toEqual([1,2,3,"home"]);audit(s);});
});
