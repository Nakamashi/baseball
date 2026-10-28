import type { BallEvent,GameState,PlayProvider,PlayScenario } from './types';
export const occupancy=(s:GameState)=>Object.values(s.runners).sort().join(',');
export class ScriptedPlayProvider implements PlayProvider {
 constructor(public readonly library:PlayScenario[]){}
 resolve(state:GameState,event:Pick<BallEvent,'type'|'direction'>){const scenarios=this.library.filter(s=>s.initial.outs===state.outs&&occupancy(s.initial)===occupancy(state)&&s.ballEvent.type===event.type&&s.ballEvent.direction===event.direction);return scenarios.length?{supported:true as const,scenarios}:{supported:false as const,reason:'This situation is not supported in Version 1. Choose a nearby authored play or clear the filters.'}}
}
