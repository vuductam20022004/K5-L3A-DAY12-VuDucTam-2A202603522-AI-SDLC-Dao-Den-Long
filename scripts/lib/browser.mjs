import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const delay=ms=>new Promise(r=>setTimeout(r,ms));

export async function startLocalServer({development=false}={}){
  const art=join(ROOT,'artifacts');mkdirSync(art,{recursive:true});const dataDir=mkdtempSync(join(art,'test-data-'));
  const argv=development?[join(ROOT,'scripts/dev-server.mjs')]:[join(ROOT,'dist/server.js'),'--port','0','--data-dir',dataDir];
  const child=spawn(process.execPath,argv,{cwd:ROOT,windowsHide:true,env:{...process.env,DAO_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
  const url=await new Promise((done,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Local server startup timeout')),10000);
    child.on('error',reject);child.on('exit',code=>reject(new Error(`Local server exited ${code}`)));
    child.stdout.on('data',chunk=>{output+=chunk;const found=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(found){clearTimeout(timer);done(found[0]);}});
  });
  return {url,dataDir,stop:()=>child.kill()};
}
export async function launchBrowser({headless=true,unlimited=false,width=1280,height=720}={}){
  const chrome=process.env.CHROME_PATH??['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
  if(!chrome)throw new Error('Set CHROME_PATH to an installed Chrome/Edge binary');
  const art=join(ROOT,'artifacts');mkdirSync(art,{recursive:true});const profile=mkdtempSync(join(art,'browser-'));
  const args=[...(headless?['--headless=new']:['--app=about:blank']),'--enable-automation','--remote-debugging-port=0',`--user-data-dir=${profile}`,`--window-size=${width},${height}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',...(unlimited?['--disable-frame-rate-limit','--disable-gpu-vsync']:[]),...(headless?['about:blank']:[])];
  const child=spawn(chrome,args,{cwd:ROOT,windowsHide:true,stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((done,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Browser startup timeout: '+log.slice(-1500))),15000);child.on('error',reject);child.on('exit',code=>reject(new Error(`Browser exited ${code}`)));child.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);done(m[1]);}});});
  const socket=new WebSocket(endpoint);await new Promise((done,reject)=>{socket.onopen=done;socket.onerror=reject;});
  let sequence=0,session;const pending=new Map(),errors=[];
  function send(method,params={},target=session){return new Promise((done,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},20000);pending.set(id,{done,reject,timer});socket.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));});}
  socket.onmessage=({data})=>{const m=JSON.parse(String(data));if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.done(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
  const version=await send('Browser.getVersion',{},null);
  const pages=(await send('Target.getTargets',{},null)).targetInfos.filter(t=>t.type==='page');
  if(pages.length!==1)throw new Error('Expected one page in isolated browser');
  session=(await send('Target.attachToTarget',{targetId:pages[0].targetId,flatten:true},null)).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  async function waitFor(expression,timeout=10000){const begin=performance.now();while(performance.now()-begin<timeout){if(await evaluate(expression))return;await delay(100);}throw new Error('Timeout '+expression);}
  return {send,evaluate,waitFor,errors,version,args,
    navigate:async url=>send('Page.navigate',{url}),
    screenshot:async file=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(file,Buffer.from(r.data,'base64'));},
    click:async id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`),
    key:async(key,code,hold=60,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});await delay(hold);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers:0});},
    close:async()=>{try{await send('Browser.close',{},null);}catch{}socket.close();child.kill();},
  };
}
