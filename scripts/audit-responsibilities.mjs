// Review matrix, not a universal demand for perpetual movement. Ready, a set
// receiver, dead balls and completion still allow purposeful waiting.
import {createServer} from 'vite';
import {createServer as http} from 'node:http';
import {writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:{server:http()}},appType:'custom'});
try {
 const {DynamicPlayProvider,defaultSettings}=await server.ssrLoadModule('/src/dynamic/provider.ts');
 const {fromWorld,metres}=await server.ssrLoadModule('/src/dynamic/geometry.ts');
 const {assignmentText}=await server.ssrLoadModule('/src/dynamic/defense.ts');
 const {formatDynamic}=await server.ssrLoadModule('/src/dynamic/messages.ts');
 const {sample,duration}=await server.ssrLoadModule('/src/simulation/timeline.ts');
 const {scenarios}=await server.ssrLoadModule('/src/scenarios/index.ts');
 const {validateScenario}=await server.ssrLoadModule('/src/simulation/scenarioValidation.ts');
 const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
 const rows=[];
 for(const type of ['Ground ball','Bunt','Line drive','Fly ball','Pop-up']) for(const angle of [-35,0,35]) for(const mask of [0,1,2,3,4,5,6,7]) for(const outs of [0,1,2]) {
 const s=defaultSettings(); s.ball={type,strength:'normal',destination:fromWorld({x:Math.sin(angle*Math.PI/180)*(type==='Bunt'?10:type==='Pop-up'?25:type==='Ground ball'?25:65),y:-Math.cos(angle*Math.PI/180)*(type==='Bunt'?10:type==='Pop-up'?25:type==='Ground ball'?25:65)})};
 s.state.outs=outs;s.state.runners=Object.fromEntries([1,2,3].filter(b=>mask&(1<<(b-1))).map(b=>['R'+b,b]));
 for(const includeError of [false,true]) {
 s.includeError=includeError;
 try {const p=new DynamicPlayProvider().generate(s); rows.push({id:`${type}/${angle}/${mask}/${outs}/${includeError}`,settings:structuredClone(s),fielder:p.dynamic.ball.fielder,contactAssignments:p.phases.find(ph=>ph.title==='Contact').assignments.map(a=>({...a,instruction:Object.fromEntries(Object.entries(assignmentText(a)).map(([k,v])=>[k,formatDynamic(v,'en')]))})),events:p.dynamic.events,final:sample(p,duration(p)).state,issues:validateScenario(p),stationary:positions.filter(id=>!p.phases.some(ph=>ph.movements.some(m=>m.player===id && m.path.some(pt=>metres(m.path[0],pt)>0.05)))),fallbackPhases:p.phases.filter(ph=>ph.title!=='Ready' && ph.state.ballStatus!=='complete' && ph.state.outs<3 && ph.assignments?.some(a=>a.reason==='guardSpace')).length});}
 catch(e){rows.push({id:`${type}/${angle}/${mask}/${outs}/${includeError}`,error:e.message,settings:structuredClone(s)});}
 }
 }
 const authored=scenarios.map(s=>({id:s.id,stationary:positions.filter(id=>!s.phases.some(p=>p.movements.some(m=>m.player===id && m.path.some(pt=>metres(m.path[0],pt)>0.05))))}));
 const failures=rows.filter(r=>r.error || r.issues?.length || r.fallbackPhases || r.stationary?.length);
 const data={scope:'720 dynamic plays: five ball types, three sectors, all occupancies, all three out counts, error OFF/ON; plus all 24 authored plays',rows,authored};
 const output=process.argv[2] || '/tmp/defensive-responsibilities.json';
 await writeFile(output,JSON.stringify(data,null,2)+'\n');
 if(failures.length || authored.some(s=>s.stationary.length))process.exitCode=1;
 console.log(JSON.stringify({plays:rows.length,errors:rows.filter(r=>r.error).length,invalid:rows.filter(r=>r.issues?.length).length,stationaryCounts:Object.fromEntries(positions.map(id=>[id,rows.filter(r=>r.stationary?.includes(id)).length])),authored}));
}finally {await server.close()}
