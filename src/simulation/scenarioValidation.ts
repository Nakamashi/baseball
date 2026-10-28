import { sample,duration } from './timeline';
import { positions, type PlayScenario } from './types';
export function validateScenario(s:PlayScenario):string[]{
 const errors:string[]=[];const known=Object.keys(s.startingPositions);const valid=[...positions,'BR',...Object.keys(s.initial.runners)];
 const fail=(message:string)=>errors.push(`${s.id}: ${message}`);
 if(!s.phases.length)fail('missing phases');
 for(const p of positions)if(!known.includes(p))fail(`missing defender ${p}`);
 for(const id of known)if(!valid.includes(id))fail(`invalid player ${id}`);
 const validPoint=(p:{x:number;y:number})=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=900;
 for(const p of Object.values(s.startingPositions))if(!validPoint(p))fail('invalid starting coordinates');
 let end=0;let previousOuts=s.initial.outs;
 const checkState=(state:PlayScenario['initial'])=>{if(!Number.isInteger(state.outs)||state.outs<0||state.outs>3)fail('invalid outs');if(state.balls<0||state.balls>3||state.strikes<0||state.strikes>2)fail('invalid count');const occupied=Object.values(state.runners);if(occupied.some(b=>![1,2,3].includes(b as number)))fail('invalid base');if(new Set(occupied).size!==occupied.length)fail('duplicate base occupancy');for(const id of Object.keys(state.runners))if(!known.includes(id)||positions.includes(id as typeof positions[number]))fail('invalid runner');};
 checkState(s.initial);
 for(const [i,p] of s.phases.entries()){
  if(!Number.isFinite(p.start)||Math.abs(p.start-end)>.00001||!Number.isFinite(p.duration)||p.duration<=0)fail('invalid timestamps');end=p.start+p.duration;checkState(p.state);
  if(p.state.outs<previousOuts)fail('outs decrease');previousOuts=p.state.outs;
  for(const id of known)if(!p.responsibilities[id]?.action||!p.responsibilities[id]?.why||!p.responsibilities[id]?.support)fail(`missing explanation ${id}`);
  const moving=new Set<string>();
  for(const m of p.movements){if(!known.includes(m.player))fail('movement has unknown player');if(moving.has(m.player))fail('duplicate movement');moving.add(m.player);if(m.path.length<2||m.path.some(v=>!validPoint(v)))fail('invalid movement path');if(i){const last=sample(s,p.start-.000001).players.find(v=>v.id===m.player);if(last&&Math.hypot(last.position.x-m.path[0].x,last.position.y-m.path[0].y)>.01)fail('discontinuous movement')}}
  if(p.ball.kind==='held'){if(!known.includes(p.ball.owner))fail('unknown ball owner');const previous=s.phases[i-1];if(previous?.ball.kind==='travel'&&previous.ball.receiver!==p.ball.owner)fail('invalid possession transition');if(previous?.ball.kind==='held'&&previous.ball.owner!==p.ball.owner)fail('possession changed without throw');}
  else {if(p.ball.path.length<2||p.ball.path.some(v=>!validPoint(v)))fail('invalid ball path');if(p.ball.receiver&&!positions.includes(p.ball.receiver))fail('invalid receiver');if(p.ball.receiver){const endSnap=sample(s,Math.min(duration(s),p.start+p.duration-.000001));const pos=endSnap.players.find(v=>p.ball.kind==='travel'&&v.id===p.ball.receiver)?.position;const target=p.ball.path.at(-1)!;if(pos&&Math.hypot(pos.x-target.x,pos.y-target.y)>.01)fail('ball misses receiver');}if(p.ball.style==='throw'&&i){const prev=sample(s,p.start-.000001);if(!prev.owner)fail('throw without possession');else if(Math.hypot(prev.ball.x-p.ball.path[0].x,prev.ball.y-p.ball.path[0].y)>.01)fail('throw starts away from owner');}}
  for(const [r,status] of Object.entries(p.statuses))if((status==='out'||status==='scored')&&r in p.state.runners)fail('retired runner occupies a base');
 }
 if(s.phases.length){const final=sample(s,duration(s));for(const [r,b] of Object.entries(final.state.runners)){const player=final.players.find(p=>p.id===r);const target={1:{x:700,y:570},2:{x:500,y:370},3:{x:300,y:570}}[b as 1|2|3];if(!player||!target||Math.hypot(player.position.x-target.x,player.position.y-target.y)>.1)fail('final runner position disagrees with occupancy')}}
 if(s.id==='18'&&(s.initial.outs>=2||!Object.values(s.initial.runners).includes(1)||!Object.values(s.initial.runners).includes(2)||s.ballEvent.type!=='Fly ball'))fail('infield fly not qualified');
 return errors;
}
