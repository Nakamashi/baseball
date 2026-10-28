import { bases, batter, defaults } from '../simulation/geometry';
import { positions, type Base, type BallAction, type Direction, type GameState, type PlayScenario, type PlayerId, type Point, type Position, type Responsibility, type Runner } from '../simulation/types';
export interface Spec { id:number; title:string; category:string; type:PlayScenario['ballEvent']['type']; direction:Direction; fielder:Position; location:Point; outs:number; runners?:Partial<Record<Runner,Base>>; objective:string; result:string; notation:string; notes?:string[]; alternatives?:string[] }
export const role=(action:string,why:string,support='Watch the ball and runners; communicate before changing assignments.'):Responsibility=>({action,why,support});
export function author(spec:Spec){
 const initial:GameState={outs:spec.outs,balls:0,strikes:0,runners:spec.runners??{},phase:'Ready',runs:0};
 const startingPositions:Record<string,Point>={...structuredClone(defaults),BR:batter};
 for(const [r,b] of Object.entries(initial.runners))startingPositions[r]=bases[b];
 const s:PlayScenario={id:String(spec.id).padStart(2,'0'),title:spec.title,category:spec.category,description:`${spec.outs} out${spec.outs===1?'':'s'} · ${Object.keys(initial.runners).length?Object.entries(initial.runners).map(([r,b])=>`${r} on ${b}`).join(', '):'Bases empty'}`,objective:spec.objective,initial,ballEvent:{type:spec.type,direction:spec.direction,location:spec.location,outcome:spec.type==='Base hit'?'hit':spec.type==='Fly ball'||spec.type==='Line drive'?'caught':'fielded'},startingPositions,phases:[],result:spec.result,notation:spec.notation,notes:spec.notes??[],alternatives:spec.alternatives??[]};
 let loc=structuredClone(startingPositions),time=0,state=structuredClone(initial),statuses:Partial<Record<Runner,'active'|'out'|'scored'>>={};
 let roles:Record<string,Responsibility>={
 P:role('Read the contact; prepare to back up the next throw.','Moving toward the likely play prevents extra bases on an overthrow.'),
 C:role('Leave the catching stance and direct the defense.','The catcher sees the whole field and calls the base for the throw.'),
 '1B':role('Move to first and present a target.','A clear target helps the infielder finish the routine out.'),
 '2B':role('Read the ball and cover the middle of the diamond.','Be ready for a force, relay, or deflected ball.'),
 '3B':role('Protect third and watch the lead runner.','An uncovered base can allow an unnecessary advance.'),
 SS:role('Read the ball and coordinate middle-infield coverage.','One middle infielder fields while the other protects the base.'),
 LF:role('Move in behind the left side of the infield.','Back up a missed grounder or a throw toward third.'),
 CF:role('Move in line behind second base.','A ball past the middle infield should not become an extra base.'),
 RF:role('Back up the throw toward first base.','Stop a wild throw before the batter can take another base.'),
 BR:role('Run hard through first on a ground ball.','Touch the base; look to the coach after crossing it.')};
 for(const r of Object.keys(initial.runners))roles[r]=role('Read contact and locate the ball.','Know whether you are forced to run or must retouch after a catch.');
 function assign(updates:Partial<Record<PlayerId,Responsibility>>){roles={...roles,...updates} as Record<string,Responsibility>}
 function phase(title:string,explanation:string,seconds:number,ball:BallAction,targets:Partial<Record<PlayerId,Point|Point[]>>={},change?:{outs?:number; runners?:Partial<Record<Runner,Base>>; runs?:number; statuses?:Partial<Record<Runner,'active'|'out'|'scored'>>}){
  if(change){state={...state,...(change.outs!==undefined?{outs:change.outs}:{}),...(change.runners?{runners:change.runners}:{}),...(change.runs!==undefined?{runs:change.runs}:{})};statuses={...statuses,...change.statuses}}
  state={...state,phase:title};
  const movements=Object.entries(targets).map(([id,target])=>({player:id as PlayerId,path:[loc[id],...(Array.isArray(target)?target:[target as Point])]}));
  // Each phase keeps its own teaching snapshot, independent of future role updates.
  const teaching=structuredClone(roles);
  if(title==='Ready')for(const id of Object.keys(teaching))teaching[id].action=`Read the outs and occupied bases. On contact: ${teaching[id].action}`;
  if(ball.kind==='held'&&title!=='Ready')teaching[ball.owner]={...teaching[ball.owner],action:title==='Outcome'?'Keep possession as the play finishes.':`Secure the ball. ${teaching[ball.owner].action}`};
  if(ball.kind==='travel'&&ball.style==='throw'){
   const previous=s.phases.at(-1)?.ball;
   if(previous?.kind==='held')teaching[previous.owner]={...teaching[previous.owner],action:explanation};
   if(ball.receiver)teaching[ball.receiver]={...teaching[ball.receiver],action:`Present a target and receive the throw. ${teaching[ball.receiver].action}`};
  }
  for(const [id,status] of Object.entries(statuses))if(status==='out'||status==='scored')teaching[id]={action:status==='out'?'You are out. The play continues for the other runners.':'You have scored. Stay clear of the continuing play.',why:roles[id].why,support:'Review the timing of the catch, force, or relay with your coach.'};
  s.phases.push({id:`${s.id}-${s.phases.length}`,title,start:time,duration:seconds,explanation,movements,ball,responsibilities:teaching,state:structuredClone(state),statuses:{...statuses}});
  for(const m of movements)loc[m.player]=m.path.at(-1)!;time=Number((time+seconds).toFixed(3));
 }
 function held(title:string,text:string,owner:Position,seconds=1.4,targets:Partial<Record<PlayerId,Point|Point[]>>={},change?:Parameters<typeof phase>[5]){phase(title,text,seconds,{kind:'held',owner},targets,change)}
 function throwTo(from:Position,to:Position,text:string,targets:Partial<Record<PlayerId,Point|Point[]>>={},change?:Parameters<typeof phase>[5]){
  phase('Throw',text,1.5,{kind:'travel',path:[loc[from],targets[to] as Point??loc[to]],style:'throw',receiver:to},targets);
  held('Receive',text,to,1,{},change);
 }
 function contact(targets:Partial<Record<PlayerId,Point|Point[]>>={}){
  phase('Contact',`The ball is hit toward ${spec.direction.toLowerCase()}. Fielders move together into fielding, coverage, and backup positions.`,3.5,{kind:'travel',path:[bases.home,spec.location],style:'hit',receiver:spec.fielder},{...targets,[spec.fielder]:spec.location});
 }
 function ready(){phase('Ready','Read the outs and runners. Choose a player to follow their assignment.',1.5,{kind:'held',owner:'P'})}
 function finish(owner:Position){held('Outcome',spec.result,owner,2)}
 return {s,assign,phase,held,throwTo,contact,ready,finish,loc:()=>loc};
}
export const groundBackup={C:{x:550,y:740},LF:{x:245,y:455},CF:{x:500,y:300},RF:{x:800,y:590}};
export {bases,defaults,positions};
