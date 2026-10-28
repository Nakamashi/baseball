import {useEffect,useRef,useState} from 'react';
import {advance,duration,stepTime} from '../simulation/timeline';
import type {PlayScenario} from '../simulation/types';
export function usePlayback(scenario:PlayScenario){
 const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);const total=duration(scenario);const previous=useRef<number|null>(null);
 useEffect(()=>{setTime(0);setPlaying(false)},[scenario]);
 useEffect(()=>{if(!playing){previous.current=null;return}let request:number;const tick=(now:number)=>{const delta=previous.current===null?0:(now-previous.current)/1000;previous.current=now;setTime(t=>advance(t,delta,speed,total,true));request=requestAnimationFrame(tick)};request=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(request);previous.current=null}},[playing,speed,total]);
 useEffect(()=>{if(time>=total)setPlaying(false)},[time,total]);
 return {time,playing,speed,total,setSpeed,toggle:()=>{if(time>=total)setTime(0);setPlaying(v=>!v)},restart:()=>{setPlaying(false);setTime(0)},seek:(t:number)=>{setPlaying(false);setTime(Math.max(0,Math.min(total,t)))},step:(d:1|-1)=>{setPlaying(false);setTime(t=>stepTime(scenario,t,d))}};
}
