#!/usr/bin/env node
/** Repeat the README's install/build/start path without the workspace modules. */
import {cpSync,mkdirSync,mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {ROOT} from './lib/browser.mjs';
assert(process.env.npm_execpath,'Run npm run test:clean');
mkdirSync(resolve(ROOT,'artifacts'),{recursive:true});const folder=mkdtempSync(resolve(ROOT,'artifacts/clean-install-'));
for(const name of ['src','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','game.contract.json'])cpSync(resolve(ROOT,name),resolve(folder,name),{recursive:true});
const output=[],report=line=>{console.log(line);output.push(line);};let child;
try{
  for(const args of [['ci',...(process.argv.includes('--offline')?['--offline']:[])],['run','build']]){report(`> npm ${args.join(' ')}`);report(execFileSync(process.execPath,[process.env.npm_execpath,...args],{cwd:folder,encoding:'utf8',maxBuffer:8*1024*1024}));}
  report('> npm start -- --port 0');
  child=spawn(process.execPath,[process.env.npm_execpath,'start','--','--port','0'],{cwd:folder,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  const url=await new Promise((done,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('startup timeout')),10000);child.stdout.on('data',part=>{text+=part;const found=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(found){clearTimeout(timer);done(found[0]);}});child.on('error',reject);child.on('exit',code=>reject(new Error(`server exit ${code}`)));});
  assert((await fetch(url)).ok);assert.deepEqual(await(await fetch(url+'/api/leaderboard')).json(),{entries:[]});report('OK clean folder: npm ci → npm run build → npm start; web/API 200');
}catch(error){report(String(error));process.exitCode=1;}
finally{if(child){try{if(process.platform==='win32')execFileSync('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore'});else process.kill(-child.pid);}catch{child.kill();}}writeFileSync(resolve(ROOT,'docs/proof/phase-4/clean-install.txt'),output.join('\n')+'\n');}
