import type { Base, Point, Position } from './types';
export const bases:Record<Base,Point>={home:{x:500,y:770},1:{x:700,y:570},2:{x:500,y:370},3:{x:300,y:570}};
export const defaults:Record<Position,Point>={P:{x:500,y:570},C:{x:500,y:815},'1B':{x:710,y:510},'2B':{x:610,y:390},'3B':{x:290,y:510},SS:{x:390,y:390},LF:{x:235,y:295},CF:{x:500,y:175},RF:{x:765,y:295}};
export const batter:Point={x:530,y:785};
export function interpolate(path:Point[],progress:number):Point {
 if(path.length===1)return {...path[0]};
 const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y));
 const total=lengths.reduce((a,b)=>a+b,0);let distance=Math.max(0,Math.min(1,progress))*total;
 for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]&&lengths[i]>0){const t=distance/lengths[i];return {x:path[i].x+(path[i+1].x-path[i].x)*t,y:path[i].y+(path[i+1].y-path[i].y)*t}}distance-=lengths[i]}
 return {...path[path.length-1]};
}
