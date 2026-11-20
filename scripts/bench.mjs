#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { platform, release, cpus } from 'node:os';
import { startLocalServer,launchBrowser } from './lib/browser.mjs';

const processStarted=Date.now()-process.uptime()*1000;
const args=process.argv.slice(2),get=(flag,fallback)=>{const i=args.indexOf(flag);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing ${flag}`);return args[i+1];};
let server,browser;
try{
  const seed=Number(get('--seed','42')),duration=Number(get('--duration','30')),out=resolve(get('--out','bench.json'));
  if(!Number.isSafeInteger(seed)||!Number.isFinite(duration)||duration<=0)throw new Error('Invalid seed/duration');
  server=await startLocalServer();browser=await launchBrowser({headless:args.includes('--headless'),unlimited:true});
  const url=new URL(server.url);url.search=new URLSearchParams({benchmark:'1',seed:String(seed),duration:String(duration),started:String(processStarted),unlimited:'1',os:`${platform()} ${release()}`}).toString();
  await browser.navigate(url.href);await browser.waitFor('window.__bench?.state.done',Math.ceil((duration+20)*1000));
  if(browser.errors.length)throw new Error(JSON.stringify(browser.errors));
  const result=await browser.evaluate('__bench.state.result');
  const scene=await browser.evaluate(`({shades:__bench.sim.shades.length,motes:__bench.sim.motes.filter(m=>m.active).length,wander:__bench.sim.shades.every(s=>s.state==='wander'),player:__bench.sim.snapshot().player.pos,lit:__bench.sim.lanterns.filter(l=>l.lit).map(l=>({id:l.id,fuel:__bench.sim.fuel(l)})),drawCalls:__bench.renderer.renderer.info.render.calls,viewport:[innerWidth,innerHeight]})`);
  mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  writeFileSync(out.replace(/\.json$/,'')+'.frames.json',JSON.stringify(await browser.evaluate('__bench.samples'))+'\n');
  writeFileSync(out.replace(/\.json$/,'')+'.metadata.json',JSON.stringify({scene,browser:browser.version,flags:browser.args.filter(a=>!a.startsWith('--user-data-dir')),cpu:cpus()[0]?.model,headless:args.includes('--headless'),warmup_s:3,duration_s:duration,peakMemoryExplanation:'Web renderer is multiprocess; portable per-game RSS is unavailable, reported null.'},null,2)+'\n');
  await browser.screenshot(out.replace(/\.json$/,'')+'.png');
  console.log(JSON.stringify(result));
}catch(error){console.error(error.stack??error);process.exitCode=1;}
finally{await browser?.close();server?.stop();}
