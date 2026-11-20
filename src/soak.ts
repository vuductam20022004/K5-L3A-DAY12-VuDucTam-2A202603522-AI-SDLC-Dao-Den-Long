#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { GameSim, defaultFrame } from './core/sim';
import { Rng } from './core/rng';
import { nightDuration } from './core/config';

export function soak(seed:number,nights:number){
  if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(nights)||nights<1)throw new Error('seed nguyên, nights >=1');
  const started=performance.now();
  let sim:GameSim|undefined=new GameSim({seed,night:1});
  global.gc?.();const start=process.memoryUsage().rss/1048576;
  const results:string[]=[];let crashes=0;
  for(let i=0;i<nights;i++){
    const night=i%3+1;
    try{
      if(i>0)sim=new GameSim({seed:seed+i,night});
      const rng=new Rng((seed+i)^0x51a7),input=defaultFrame();
      for(let tick=0;tick<nightDuration(night)*60 && sim!.state==='playing';tick++){
        if(tick%30===0){const angle=rng.range(0,Math.PI*2);input.move=[Math.cos(angle),Math.sin(angle)];}
        input.jump=rng.next()<0.05;input.dash=rng.next()<0.03;input.pulse=rng.next()<0.02;input.interact=rng.next()<0.1;
        sim!.step(input);
      }
      results.push(sim!.state);
    }catch{crashes++;results.push('crashed');}
    sim=undefined;
  }
  // Measure after a genuine reset, with the final old night released.
  sim=new GameSim({seed:seed+nights-1,night:(nights-1)%3+1});
  global.gc?.();const end=process.memoryUsage().rss/1048576;
  return {nights,crashes,results,mem_start_mb:start,mem_end_mb:end,duration_s:(performance.now()-started)/1000};
}
try{
  const args=process.argv.slice(2),get=(name:string)=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw new Error(`Thiếu ${name}`);return args[i+1];};
  const result=soak(Number(get('--seed')),Number(get('--nights')));
  writeFileSync(get('--out'),JSON.stringify(result,null,2)+'\n');
  if(result.crashes)process.exitCode=1;
}catch(e){process.stderr.write((e as Error).message+'\n');process.exitCode=2;}
