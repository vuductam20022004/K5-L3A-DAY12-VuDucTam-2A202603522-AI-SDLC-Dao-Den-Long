#!/usr/bin/env node
/** Records actual WebGL/DOM frames into an MP4 using Chrome's native encoder.
 * The separately measured official benchmark is never recorded during timing.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,startLocalServer,launchBrowser,delay} from './lib/browser.mjs';
const directory=resolve(ROOT,'docs/demo');mkdirSync(directory,{recursive:true});
let server,browser,capture,recording=false,frames=0,stage='startup';const chapters=[];
try{
  server=await startLocalServer({development:true});browser=await launchBrowser();
  await browser.navigate(server.url);await browser.waitFor('window.__game?.screen==="menu"');
  const target=await browser.send('Target.createTarget',{url:'about:blank',background:true},null);
  const recorder=(await browser.send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  const rec=async expression=>{const result=await browser.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},recorder);if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  await rec(`(()=>{const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;document.body.append(canvas);window.ctx=canvas.getContext('2d');window.parts=[];window.recorder=new MediaRecorder(canvas.captureStream(10),{mimeType:'video/mp4;codecs=avc1.42E01E',videoBitsPerSecond:1800000});recorder.ondataavailable=e=>parts.push(e.data);recorder.start(1000);})()`);
  await browser.send('Page.bringToFront');
  const began=performance.now();recording=true;
  capture=(async()=>{while(recording){const at=performance.now();const {data}=await browser.send('Page.captureScreenshot',{format:'jpeg',quality:82});await rec(`new Promise((done,reject)=>{const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,1280,720);done()};image.onerror=reject;image.src=${JSON.stringify('data:image/jpeg;base64,'+data)}})`);frames++;await delay(Math.max(0,100-(performance.now()-at)));}})();
  async function chapter(text){stage=text;chapters.push({at_s:(performance.now()-began)/1000,text});console.log(text);await browser.evaluate(`(()=>{let label=document.getElementById('demoChapter');if(!label){label=document.createElement('div');label.id='demoChapter';Object.assign(label.style,{position:'fixed',left:'24px',top:'152px',padding:'10px 16px',background:'#0e1430ee',color:'#f5f1e6',font:'18px sans-serif',zIndex:100,pointerEvents:'none',maxWidth:'850px'});document.body.append(label)}label.textContent=${JSON.stringify(text)}})()`);}
  await chapter('v1.0.0 · Chơi trực tiếp bằng input bàn phím · Contract 1.3');await delay(2500);
  await browser.click('newGame');await delay(3000);await browser.click('enterNight');await delay(1500);
  await browser.key('d','KeyD',1700);await browser.key(' ','Space',180);await delay(1000);
  await browser.key('w','KeyW',1600);await browser.key('Shift','ShiftLeft',100);await delay(2200);
  await chapter('Cài đặt lưu lại · Đổi phím · Bảng màu · Giảm chuyển động · Chữ lớn');
  await browser.key('p','KeyP');await browser.waitFor('__game.screen==="pause"');await browser.click('pauseSettings');await delay(3500);
  await browser.evaluate(`document.querySelector('[data-action="forward"]').click()`);await browser.key('i','KeyI');await delay(1200);await browser.click('resetBindings');
  await browser.click('settingsBack');await browser.click('resume');await browser.waitFor('__game.screen==="playing"');
  await chapter('Scenario kiểm chứng công khai: nạp 10 → đèn sáng → cạn dầu → thắp lại 5');
  await browser.evaluate(`__game.loadScenario({random_motes:false,random_shades:false,random_drifters:false,player:{pos:[0,0,25],carried:10}})`);await delay(1400);await browser.key('e','KeyE');await delay(2600);
  await browser.evaluate('__game.sim.lanterns[0].fuelTicks=1');await delay(1700);await browser.evaluate('__game.sim.player.carried=5');await browser.key('e','KeyE');await delay(2600);
  await chapter('Scenario bình minh: thắng 3 Đêm → nhập tên → ghi bảng điểm trên đĩa');
  for(const night of [1,2,3]){
    await browser.evaluate(`__game.loadScenario({time_left_s:2/60,random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,lanterns:__game.sim.map.lanterns.slice(0,__game.sim.requiredLitCount).map(l=>({id:l.id,pos:[l.pos.x,l.pos.y,l.pos.z],lit:true,fuel:80}))})`);
    await browser.waitFor(night===3?'__game.screen==="dawn"':'__game.screen==="result"');await delay(1400);
    if(night<3){await browser.click('continueGame');await browser.click('enterNight');await browser.waitFor('__game.screen==="playing"');}
  }
  await browser.evaluate(`document.getElementById('playerName').value='Demo_May';document.getElementById('scoreForm').requestSubmit()`);await browser.waitFor('document.getElementById("scoreStatus").textContent.includes("Đã lưu")');await delay(1800);
  await browser.click('resultMenu');await browser.click('openLeaderboard');await browser.waitFor('document.getElementById("leaderboardRows").textContent.includes("Demo_May")');await delay(2500);
  const benchUrl=new URL(server.url);benchUrl.search=new URLSearchParams({benchmark:'1',seed:'42',duration:'30',started:String(Date.now()),os:process.platform}).toString();
  await browser.navigate(benchUrl.href);await browser.waitFor('!!window.__bench');await chapter('Cảnh benchmark chuẩn · Đang quay nên số FPS trong video không dùng để chấm');
  stage='benchmark animation';await browser.waitFor('__bench.state.done',40000);await delay(500);console.log('Benchmark scene finished');
  const proof=resolve(ROOT,'docs/proof/phase-4');
  const sections=[['TEST / VERIFY (output lệnh thực)',readFileSync(resolve(proof,'verify-output.txt'),'utf8')],['HEADLESS JSONL (cuối file thực)',readFileSync(resolve(proof,'run-dawn-win.jsonl'),'utf8').trim().split('\n').slice(-3).join('\n')],['BENCHMARK đo riêng, không quay màn hình',readFileSync(resolve(ROOT,'bench.json'),'utf8')],['SOAK: 10 Đêm / cùng tiến trình',readFileSync(resolve(ROOT,'soak.json'),'utf8')]];
  for(const [title,content] of sections){stage=title;console.log(title);await browser.evaluate(`(()=>{document.body.innerHTML='';document.body.style.cssText='margin:0;padding:32px;background:#0e1430;color:#f5f1e6;font:18px/1.4 monospace;overflow:hidden';const h=document.createElement('h1');h.textContent=${JSON.stringify(title)};h.style.fontSize='26px';const p=document.createElement('pre');p.style.cssText='white-space:pre-wrap;word-break:break-word;font:18px/1.45 monospace';p.textContent=${JSON.stringify(content)};document.body.append(h,p)})()`);await delay(title.startsWith('TEST')?6500:5000);}
  stage='stop frame capture';recording=false;await capture;console.log('Captured frames',frames);stage='encode MP4';
  const encoded=await rec(`new Promise(done=>{recorder.onstop=()=>{const blob=new Blob(parts,{type:recorder.mimeType}),reader=new FileReader();reader.onload=()=>done({data:reader.result,mime:recorder.mimeType,bytes:blob.size});reader.readAsDataURL(blob)};recorder.stop()})`);
  const file=resolve(directory,'demo.mp4');writeFileSync(file,Buffer.from(encoded.data.split(',')[1],'base64'));
  stage='validate MP4';console.log('Encoded bytes',encoded.bytes);
  await browser.send('Page.bringToFront',{},recorder);
  const video=await rec(`new Promise((done,reject)=>{const v=document.createElement('video');v.preload='metadata';document.body.append(v);v.onloadedmetadata=()=>done({duration_s:v.duration,width:v.videoWidth,height:v.videoHeight});v.onerror=reject;v.src=URL.createObjectURL(new Blob(parts,{type:recorder.mimeType}))})`);
  if(!Number.isFinite(video.duration_s)||video.duration_s>=300||video.width!==1280||video.height!==720)throw new Error('Invalid MP4 metadata '+JSON.stringify(video));
  const metadata={...video,bytes:encoded.bytes,mime:encoded.mime,frames,chapters,wall_s:(performance.now()-began)/1000,method:'Actual Chrome WebGL/DOM screenshots at ~10 fps → canvas MediaRecorder H.264 MP4. No generated gameplay frames. No microphone/audio track. Explicit core scenario fixtures are captioned. Benchmark figures come from separate visible unrecorded run.',browser:browser.version};
  writeFileSync(resolve(directory,'metadata.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify({file,...video,bytes:encoded.bytes,frames}));
}catch(error){recording=false;await capture?.catch(()=>{});console.error('Failed stage: '+stage+'; '+(error.stack??error));process.exitCode=1;}
finally{await browser?.close();server?.stop();}
