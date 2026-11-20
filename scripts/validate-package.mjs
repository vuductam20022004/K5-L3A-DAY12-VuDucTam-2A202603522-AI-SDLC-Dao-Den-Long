#!/usr/bin/env node
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {ROOT,launchBrowser} from './lib/browser.mjs';
const directory=resolve(ROOT,'artifacts'),folder=mkdtempSync(resolve(directory,'unpacked-')),zip=resolve(directory,'release/dao-den-long-v1.0.0.zip');
const proof=resolve(ROOT,'docs/proof/phase-4'),output=[];let server,browser;
const report=text=>{output.push(text);console.log(text);};
async function start(){server=spawn(process.execPath,[resolve(folder,'dist/server.js'),'--port','0'],{cwd:folder,windowsHide:true,stdio:['ignore','pipe','pipe']});return new Promise((done,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('startup timeout')),10000);server.on('error',reject);server.stdout.on('data',part=>{text+=part;const found=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(found){clearTimeout(timer);done(found[0]);}});});}
async function stop(){if(!server||server.exitCode!==null)return;await new Promise(done=>{server.once('exit',done);server.kill();});}
try{
  report('ZIP SHA256 '+createHash('sha256').update(readFileSync(zip)).digest('hex'));
  if(process.platform==='win32'){const q=s=>"'"+s.replaceAll("'","''")+"'";execFileSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath ${q(zip)} -DestinationPath ${q(folder)}`],{stdio:'pipe'});}
  else execFileSync('unzip',['-q',zip,'-d',folder],{stdio:'pipe'});
  const manifest=JSON.parse(readFileSync(resolve(folder,'MANIFEST.sha256.json'),'utf8'));
  for(const [name,hash] of Object.entries(manifest)){const path=resolve(folder,name);assert(path.startsWith(folder+sep));assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,name);}
  report(`OK native ZIP extraction and ${Object.keys(manifest).length} SHA256 entries`);assert(!existsSync(resolve(folder,'node_modules')));report('OK package has no node_modules');
  let url=await start();assert((await fetch(url)).ok);browser=await launchBrowser();await browser.navigate(url);await browser.waitFor('window.__game?.screen==="menu"');await browser.click('newGame');await browser.click('enterNight');await browser.waitFor('__game.screen==="playing"');
  await browser.key('w','KeyW',400);assert(await browser.evaluate('__game.sim.player.pos.z>1'));await browser.screenshot(resolve(proof,'screenshots/packaged-game.png'));assert.equal(browser.errors.length,0);report('OK production ZIP: menu → intro → game, actual keyboard input, no browser errors');await browser.close();browser=undefined;
  for(const [name,score] of [['Zip_Low',10],['Zip_High',20]]){const r=await fetch(url+'/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,score,nights_won:1,seed:42})});assert.equal(r.status,201);}
  const forbidden=await fetch(url+'/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://foreign.invalid'},body:'{}'});assert.equal(forbidden.status,403);
  const invalid=await fetch(url+'/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"ab"}'});assert.equal(invalid.status,400);
  await stop();url=await start();const entries=(await(await fetch(url+'/api/leaderboard')).json()).entries;assert.deepEqual(entries.map(e=>e.name),['Zip_High','Zip_Low']);assert(entries.every(e=>Number.isFinite(Date.parse(e.achieved_at))));report('OK disk leaderboard persists across server restart; descending order, invalid name and foreign origin rejected');
  const exported=resolve(proof,'package-export.json');execFileSync(process.execPath,[resolve(folder,'dist/server.js'),'--export-leaderboard',exported],{cwd:folder,stdio:'pipe'});assert.deepEqual(JSON.parse(readFileSync(exported,'utf8')),{entries});report('OK packaged run_cmd --export-leaderboard reads same disk data');
  const headless=resolve(proof,'package-headless.jsonl');assert.equal(execFileSync(process.execPath,[resolve(folder,'dist/headless.js'),'--seed','1','--night','1','--ticks','600','--out',headless],{cwd:folder,encoding:'utf8'}),'');assert.equal(JSON.parse(readFileSync(headless,'utf8').trim().split('\n').at(-1)).type,'end');report('OK packaged headless: 600 ticks, clean stdout, terminal end record');
  const soakOut=resolve(proof,'package-soak.json');execFileSync(process.execPath,['--jitless','--expose-gc',resolve(folder,'dist/soak.js'),'--seed','7','--nights','10','--out',soakOut],{cwd:folder,stdio:'pipe'});const soak=JSON.parse(readFileSync(soakOut,'utf8'));assert.equal(soak.crashes,0);assert(soak.mem_end_mb<=1.2*soak.mem_start_mb);report('OK packaged soak: 10 nights, zero crashes, RSS <= 1.2x');
}catch(error){report(String(error.stack??error));process.exitCode=1;}
finally{await browser?.close();await stop();writeFileSync(resolve(proof,'package-validation.txt'),output.join('\n')+'\n');}
