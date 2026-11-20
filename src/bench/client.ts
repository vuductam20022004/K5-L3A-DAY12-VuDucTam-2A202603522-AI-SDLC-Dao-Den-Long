import * as THREE from 'three';
import { benchmarkScene } from '../core/benchmark';
import { frameStatistics } from '../shared/benchmark-stats';
import { Renderer } from '../render/renderer';

const params=new URLSearchParams(location.search),seed=Number(params.get('seed')??42),duration=Number(params.get('duration')??30);
if(!Number.isSafeInteger(seed)||!Number.isFinite(duration)||duration<=0)throw new Error('Benchmark args invalid');
const sim=benchmarkScene(seed),renderer=new Renderer(document.getElementById('app')!);
for(const id of ['panel','hud','bottomHud','direction','toast','boot','spawnCues']){const el=document.getElementById(id);if(el)el.hidden=true;}
const label=document.createElement('div');label.id='benchStatus';label.textContent='Benchmark · 200 Bóng Mực · 100 đom đóm · Khởi động 3 giây';document.body.append(label);
const samples:number[]=[];let first=-1,last=-1,acc=0,load=0;
const state:{done:boolean;result?:unknown;error?:string}={done:false};
Object.assign(window,{__bench:{state,sim,renderer,samples}});
function frame(now:number):void{
  if(first<0){first=last=now;}
  const dt=now-last;last=now;acc+=dt;
  while(acc>=1000/60){acc-=1000/60;sim.step();}
  const angle=(now-first)/15000*Math.PI*2;
  renderer.camera.position.set(30*Math.cos(angle),15,30*Math.sin(angle));renderer.camera.lookAt(0,0,0);renderer.camera.updateMatrixWorld();
  renderer.sync(sim);renderer.render();
  if(!load){renderer.renderer.getContext().finish();load=Date.now()-Number(params.get('started')??Date.now());}
  const start=first+3000,end=start+duration*1000;
  const measured=Math.min(now,end)-Math.max(now-dt,start);
  if(measured>0)samples.push(measured);
  if(now>=end){
    state.result={contract_version:'1.3',...frameStatistics(samples),load_ms:load,peak_mem_mb:null,vsync_off:params.get('unlimited')==='1',renderer:`Three.js r${THREE.REVISION} / WebGL2`,os:params.get('os')??navigator.platform};
    state.done=true;label.textContent='Benchmark hoàn tất';return;
  }
  if(now>=start)label.textContent=`Benchmark · Đo ${(duration-(now-start)/1000).toFixed(1)} giây còn lại`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
