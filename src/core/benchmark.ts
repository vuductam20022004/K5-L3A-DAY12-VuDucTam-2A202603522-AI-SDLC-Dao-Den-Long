import { GameSim } from './sim';
import { Rng } from './rng';

/** Canonical isolated scene. Never used by normal headless gameplay. */
export function benchmarkScene(seed: number): GameSim {
  const rng=new Rng(seed);
  const position=():[number,number,number]=>{const a=rng.range(0,Math.PI*2),r=40*Math.sqrt(rng.next());return [Math.cos(a)*r,0,Math.sin(a)*r];};
  return new GameSim({seed,night:1,mode:'benchmark',scenario:{random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,
    motes:Array.from({length:100},position),
    shades:Array.from({length:200},(_,i)=>{const p=position();p[1]=1;return{id:`S${i+1}`,pos:p,state:'wander' as const};}),
    lanterns:[{id:'L1',pos:[0,0,25],lit:true,fuel:100},{id:'L2',pos:[23.8,0,7.7],lit:true,fuel:100},{id:'L3',pos:[14.7,0,-20.2],lit:true,fuel:100},
      {id:'L4',pos:[-14.7,0,-20.2]},{id:'L5',pos:[-23.8,0,7.7]}],
  }});
}
