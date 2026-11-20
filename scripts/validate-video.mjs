#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,startLocalServer,launchBrowser} from './lib/browser.mjs';
let browser,server;
try{
  server=await startLocalServer({development:true});browser=await launchBrowser();
  await browser.navigate(server.url);await browser.waitFor('!!window.__game');
  await browser.evaluate(`(()=>{document.body.replaceChildren();document.body.style.cssText='margin:0;background:#0e1430;overflow:hidden';const video=document.createElement('video');video.id='demoVideo';video.style.cssText='width:1280px;height:720px';video.preload='auto';video.muted=true;video.controls=true;document.body.append(video);video.src='/docs/demo/demo.mp4';video.load()})()`);
  await browser.send('Page.bringToFront');await browser.waitFor('document.getElementById("demoVideo").readyState>=1',15000);
  const metadata=await browser.evaluate(`({duration_s:demoVideo.duration,width:demoVideo.videoWidth,height:demoVideo.videoHeight,readyState:demoVideo.readyState,error:demoVideo.error?.message??null})`);
  if(!metadata.duration_s||metadata.duration_s>=300||metadata.width!==1280||metadata.height!==720)throw new Error('Invalid metadata '+JSON.stringify(metadata));
  mkdirSync(resolve(ROOT,'docs/proof/phase-4/screenshots'),{recursive:true});
  for(const time of [5,20,42,70,metadata.duration_s-4]){await browser.evaluate(`demoVideo.currentTime=${time}`);await browser.waitFor('!demoVideo.seeking&&demoVideo.readyState>=2',10000);await browser.screenshot(resolve(ROOT,`docs/proof/phase-4/screenshots/demo-${Math.floor(time)}s.png`));}
  writeFileSync(resolve(ROOT,'docs/demo/validation.json'),JSON.stringify({...metadata,bytes:readFileSync(resolve(ROOT,'docs/demo/demo.mp4')).length,method:'Actual HTMLVideoElement loaded from local HTTP, finite duration and dimensions; five decoded video-frame screenshots.'},null,2)+'\n');console.log(JSON.stringify(metadata));
}catch(error){console.error(error.stack??error);process.exitCode=1;}
finally{await browser?.close();server?.stop();}
