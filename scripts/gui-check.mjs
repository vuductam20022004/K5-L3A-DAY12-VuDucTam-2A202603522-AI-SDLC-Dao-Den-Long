#!/usr/bin/env node
/** Isolated local browser regression tests, without the user's Chrome profile.
 * Node >=22; uses the installed Chrome and its standard DevTools protocol.
 * Run Vite first. This script never attaches to an existing browser.
 */
import { spawn,execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform, release } from 'node:os';
import assert from 'node:assert/strict';
import {startLocalServer,launchBrowser} from './lib/browser.mjs';
if(process.argv.includes('--probe-media')){
  const probe=await launchBrowser();
  try{console.log(JSON.stringify(await probe.evaluate(`({mp4:MediaRecorder.isTypeSupported('video/mp4'),h264:MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E'),webm:MediaRecorder.isTypeSupported('video/webm')})`)));}finally{await probe.close();}
  process.exit(0);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROOF = resolve(ROOT, 'docs/proof/phase-4');
const ART = resolve(ROOT, 'artifacts');
mkdirSync(join(PROOF, 'screenshots'), { recursive: true }); mkdirSync(ART, { recursive: true });
const chrome = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(chrome, 'Set CHROME_PATH to an installed Chromium browser');
const server=process.env.GUI_URL?undefined:await startLocalServer({development:true});
const url = process.env.GUI_URL ?? server.url;
const profile = mkdtempSync(join(ART, 'gui-profile-'));
const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1280,720',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const log = [], checks = [], errors = [];
function report(line) { log.push(line); console.log(line); writeFileSync(join(PROOF, 'gui-output.txt'), log.join('\n') + '\n'); }
function check(name, condition) { assert(condition, name); checks.push(name); report(`OK ${name}`); }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let socket, sessionId, sequence = 0;
const pending = new Map();
function send(method, params = {}, session = sessionId) {
  return new Promise((resolveMessage, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve: resolveMessage, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, timeout = 10000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timeout waiting for ${expression}`);
}
async function click(id) { await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`); }
async function key(key, code, hold = 50, modifiers = 0) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers });
  await delay(hold);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers: 0 });
}
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(PROOF, 'screenshots', `${name}.png`), Buffer.from(data, 'base64'));
}

try {
  const endpoint = await new Promise((done, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error(`Chrome did not start: ${stderr.slice(-2000)}`)), 15000);
    browser.on('error', reject); browser.on('exit', (code) => reject(new Error(`Chrome exited: ${code}`)));
    browser.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); done(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((done, reject) => { socket.onopen = done; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.id) {
      const p = pending.get(message.id); if (!p) return;
      clearTimeout(p.timeout); pending.delete(message.id);
      if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const version = await send('Browser.getVersion', {}, null);
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await waitFor('window.__game?.screen === "menu"');
  check('menu starts with gameplay frozen', await evaluate('__game.sim.simSteps === 0'));
  await shot('menu'); await click('newGame');
  await waitFor('__game.screen === "intro"');
  check('night introduction precedes gameplay', await evaluate('__game.sim.simSteps === 0 && document.body.innerText.includes("ÔNG ĐĂNG")'));
  await click('enterNight'); await waitFor('__game.screen === "playing"');
  const before = await evaluate('__game.sim.player.pos.z');
  await key('w', 'KeyW', 400);
  check('W moves forward in actual browser input', await evaluate(`__game.sim.player.pos.z > ${before + 1}`));
  await key(' ', 'Space');
  check('Space jumps', await evaluate('__game.sim.player.pos.y > 0'));
  await evaluate('__game.sim.player.carried = 3');
  await key('q', 'KeyQ');
  check('Q spends carried motes and starts cooldown', await evaluate('__game.sim.player.carried === 0 && __game.sim.snapshot().player.pulse_cd_s > 0'));
  await key('Shift', 'ShiftLeft', 50, 8);
  check('Shift activates dash', await evaluate('__game.sim.snapshot().player.dash_cd_s > 0'));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 600, y: 330, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 330, button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 330, button: 'left', clickCount: 1 });
  await delay(300);
  const origin = await evaluate('({...__game.sim.player.pos})');
  const camera = await evaluate('({x:__game.sim.player.pos.x-__game.renderer.camera.position.x,z:__game.sim.player.pos.z-__game.renderer.camera.position.z})');
  await key('w', 'KeyW', 400);
  const moved = await evaluate('({...__game.sim.player.pos})');
  check('W follows rotated camera with radians converted to degrees', (moved.x - origin.x) * camera.x + (moved.z - origin.z) * camera.z > 3);
  await shot('night-1');
  await key('p', 'KeyP'); await waitFor('__game.screen === "pause"');
  const paused = await evaluate('__game.sim.snapshot()'); await delay(350);
  check('pause freezes sim time but clock ticks continue', await evaluate(`__game.sim.simSteps === ${paused.sim_tick} && __game.sim.steps > ${paused.tick}`));
  await shot('pause'); await click('pauseSettings');
  await evaluate(`document.getElementById('volume').value = '37'; document.getElementById('volume').dispatchEvent(new Event('input')); document.getElementById('sensitivity').value = '6.5'; document.getElementById('sensitivity').dispatchEvent(new Event('input'));`);
  check('settings update stored volume and mouse sensitivity', await evaluate('__game.settings.volume === 0.37 && __game.settings.sensitivity === 0.0065'));
  await evaluate(`document.querySelector('.binding[data-action="forward"]').click()`);await key('i','KeyI');
  check('movement can be rebound from the settings screen',await evaluate('__game.settings.bindings.forward === "i"'));
  await evaluate(`document.querySelector('.binding[data-action="jump"]').click()`);await key('i','KeyI');
  check('duplicate binding is explained and rejected',await evaluate('document.getElementById("bindingStatus").textContent.includes("Trùng") && __game.settings.bindings.jump === " "'));
  await key(' ','Space');
  await evaluate(`document.getElementById('largeText').checked=true;document.getElementById('largeText').dispatchEvent(new Event('change'));document.getElementById('reducedMotion').checked=true;document.getElementById('reducedMotion').dispatchEvent(new Event('change'));`);
  check('large text is exactly 1.25 times the eighteen pixel base',await evaluate('Math.abs(parseFloat(getComputedStyle(document.body).fontSize)-22.5)<0.01'));
  check('all visible UI leaf text is at least eighteen pixels',await evaluate(`Array.from(document.querySelectorAll('#panel *,#hud *,#bottomHud *')).filter(e=>!e.children.length&&e.textContent.trim()&&e.getClientRects().length).every(e=>parseFloat(getComputedStyle(e).fontSize)>=18)`));
  await shot('settings'); await click('settingsBack'); await click('resume');
  await waitFor('__game.screen === "playing"');
  check('resume returns to gameplay', await evaluate('__game.sim.state === "playing"'));
  await delay(200);const remapOrigin=await evaluate('({...__game.sim.player.pos})');await key('i','KeyI',350);
  check('the new movement key acts in gameplay',await evaluate(`Math.hypot(__game.sim.player.pos.x-(${remapOrigin.x}),__game.sim.player.pos.z-(${remapOrigin.z}))>1`));
  await evaluate(`__game.loadScenario({random_motes:false,random_shades:false,random_drifters:false,time_left_s:20,lanterns:[{id:'L1',pos:[0,0,1],lit:true,fuel:20}],shades:[{id:'S1',pos:[3,0.8,0],state:'stunned',state_ticks_left:9999}]})`);
  await delay(100);
  check('normal palette has purple shade outline and eyes', await evaluate(`__game.renderer.scene.getObjectByName('outline').material.color.getHexString() === '7a3cff' && __game.renderer.scene.getObjectByName('eyes').children.every(e => e.material.color.getHexString() === '7a3cff')`));
  check('lit lantern exposes a fuel bar and full paper shape', await evaluate(`__game.renderer.scene.getObjectByName('fuelFill').visible && __game.renderer.scene.getObjectByName('paper').scale.y === 1`));
  await waitFor(`__game.renderer.scene.getObjectByName('fuelFill').material.opacity === 0.3`);
  await shot('low-fuel-blink');
  await key('p','KeyP'); await waitFor('__game.screen === "pause"'); await click('pauseSettings');
  await evaluate(`document.getElementById('accessiblePalette').checked = true; document.getElementById('accessiblePalette').dispatchEvent(new Event('change'));`);
  check('accessible palette toggle is persisted', await evaluate('__game.settings.accessiblePalette === true'));
  await shot('accessible-settings'); await click('settingsBack'); await click('resume'); await waitFor('__game.screen === "playing"');
  check('accessible shade outline and eyes use exact cyan', await evaluate(`__game.renderer.scene.getObjectByName('outline').material.color.getHexString() === '00b3ff' && __game.renderer.scene.getObjectByName('eyes').children.every(e => e.material.color.getHexString() === '00b3ff')`));
  check('accessible danger UI is white with a warning symbol', await evaluate(`getComputedStyle(document.getElementById('clock')).color === 'rgb(255, 255, 255)' && !document.getElementById('dangerMarker').hidden && document.getElementById('fuelStatus').textContent.includes('⚠')`));
  await shot('accessible-low-fuel');
  await evaluate(`__game.loadScenario({random_motes:false,random_shades:false,random_drifters:false,shades:[{id:'S1',pos:[0.5,0.8,0],state:'chase'}]})`);await delay(120);
  check('reduced motion suppresses hit screen flashes',await evaluate('__game.sim.player.flames===2 && !document.getElementById("flash").classList.contains("hit")'));
  await evaluate(`__game.loadScenario({random_motes:false,random_shades:true,random_drifters:false});__game.sim.simSteps=299`);await delay(150);
  check('shade spawn has visual captions and directional arrows',await evaluate('document.getElementById("spawnCues").children.length===2 && document.getElementById("toast").textContent.includes("Bóng Mực" )'));
  await shot('spawn-indicators');
  const audio = await evaluate('__game.audio');
  check('Web Audio unlocked and SFX were dispatched', audio.state === 'running' && audio.sounds.jump > 0 && audio.sounds.pulse > 0 && audio.sounds.dash > 0);
  await evaluate('__game.sim.player.flames = 0'); await waitFor('__game.screen === "result"');
  check('losing a night does not add campaign score', await evaluate('__game.campaign.totalScore === 0'));
  await evaluate(`document.getElementById('playerName').value='ab'`);
  check('score entry rejects a name shorter than three characters',await evaluate('!document.getElementById("scoreForm").checkValidity()'));
  await evaluate(`document.getElementById('playerName').value='QA_Lost';document.getElementById('scoreForm').requestSubmit()`);
  await waitFor('document.getElementById("scoreStatus").textContent.includes("Đã lưu")');
  check('losing score is saved using won-night totals',await evaluate('document.getElementById("scoreStatus").textContent.includes("Đã lưu")'));
  await click('continueGame'); await waitFor('__game.screen === "intro"');
  check('retry keeps the same night and restores three flames', await evaluate('__game.sim.night === 1 && __game.sim.player.flames === 3 && __game.sim.simSteps === 0'));
  await click('enterNight'); await waitFor('__game.screen === "playing"');
  await evaluate('__game.sim.simSteps = (__game.sim.map.durationS - 29) * 60 + 1'); await delay(100);
  check('last thirty seconds turn the clock red', await evaluate('document.getElementById("clock").classList.contains("danger")'));
  await evaluate('__game.sim.simSteps = (__game.sim.map.durationS - 10) * 60 + 1'); await delay(100);
  check('final ten seconds emit countdown sound', await evaluate('__game.audio.sounds.countdown > 0'));
  await evaluate('__game.sim.player.pos = {...__game.sim.lanterns[0].pos}; __game.sim.player.carried = 10');
  await delay(100);
  check('nearby lamp exposes E deposit hint', await evaluate('!document.getElementById("interactHint").hidden'));
  await key('e', 'KeyE');
  check('E lights a lamp, scores 150 and raises ambient light', await evaluate('__game.sim.lanterns[0].lit && __game.sim.score === 150 && Math.abs(__game.renderer.ambient.intensity - 0.26) < 0.001'));
  check('successful lighting grows the HUD to twelve carry slots', await evaluate('document.getElementById("slots").children.length === 12 && document.getElementById("carryCount").textContent === "0/12"'));
  await shot('lamp-lit');
  await evaluate('__game.sim.lanterns[0].fuelTicks = 1200; __game.sim.player.carried = 2'); await delay(100);
  check('E prompt switches to refuel for a lit lamp', await evaluate('document.getElementById("interactHint").textContent.includes("Châm dầu")'));
  await key('e','KeyE');
  check('refuel spends motes and awards five points each', await evaluate('__game.sim.player.carried === 0 && __game.sim.score === 160'));
  await evaluate('__game.sim.lanterns[0].fuelTicks = 1'); await delay(100);
  check('extinguished lantern is collapsed and torn with no fuel bar', await evaluate(`!__game.sim.lanterns[0].lit && __game.renderer.scene.getObjectByName('paper').scale.y === 0.8 && __game.renderer.scene.getObjectByName('tear').visible && !__game.renderer.scene.getObjectByName('fuelFill').visible`));
  await shot('lantern-out');
  await evaluate('__game.sim.player.carried = 5'); await key('e','KeyE');
  check('relight costs five, adds forty and grows capacity again', await evaluate('__game.sim.lanterns[0].lit && __game.sim.score === 225 && __game.sim.capacity === 14'));
  await shot('lantern-relit');
  await send('Page.reload'); await waitFor('window.__game?.screen === "menu"');
  check('settings survive page reload', await evaluate('__game.settings.volume === 0.37 && __game.settings.sensitivity === 0.0065'));
  check('accessible palette survives page reload', await evaluate('__game.settings.accessiblePalette === true && document.body.dataset.accessible === "true"'));
  check('rebound keys, motion and large text survive reload',await evaluate('__game.settings.bindings.forward==="i" && __game.settings.reducedMotion && __game.settings.largeText'));
  await click('openLeaderboard');await waitFor('document.getElementById("leaderboardRows").textContent.includes("QA_Lost")');
  await shot('leaderboard');
  check('leaderboard survives a fresh page load',await evaluate('document.getElementById("leaderboardRows").textContent.includes("QA_Lost")'));
  if(server){
    const exported=resolve(PROOF,'export-leaderboard.json');
    execFileSync(process.execPath,[resolve(ROOT,'dist/server.js'),'--data-dir',server.dataDir,'--export-leaderboard',exported],{cwd:ROOT,stdio:'pipe'});
    const entries=JSON.parse((await import('node:fs')).readFileSync(exported,'utf8')).entries;
    check('CLI export reads the exact on-disk leaderboard',entries.length===1&&entries[0].name==='QA_Lost'&&entries[0].score===0&&entries[0].nights_won===0&&Number.isFinite(Date.parse(entries[0].achieved_at)));
  }
  await click('leaderboardBack');await click('menuSettings');await click('resetBindings');
  check('restore defaults resets all nine action bindings',await evaluate('JSON.stringify(__game.settings.bindings)===JSON.stringify({forward:"w",backward:"s",left:"a",right:"d",jump:" ",dash:"shift",interact:"e",pulse:"q",pause:"p"})'));
  await click('settingsBack');
  await click('newGame'); await click('enterNight'); await waitFor('__game.screen === "playing"');
  const performanceRuns = [];
  for (const night of [1, 2, 3]) {
    check(`campaign enters night ${night}`, await evaluate(`__game.sim.night === ${night}`));
    // Explicit test fixtures: reposition for a map overview; do not alter game tuning.
    if (night === 2) await evaluate('__game.sim.player.pos = {x:35,y:0,z:0}');
    if (night === 3) await evaluate('__game.sim.player.pos = {x:0,y:0,z:-28}');
    await delay(600); await shot(`night-${night}-map`);
    check(`night ${night} HUD contains ten carry slots and cooldowns`, await evaluate('document.getElementById("slots").children.length === 10 && !document.getElementById("bottomHud").hidden'));
    await evaluate('__game.resetMetrics()'); await delay(8000);
    const metrics = await evaluate('__game.metrics');
    check(`night ${night} headless browser average FPS >= 30 (${metrics.fps.toFixed(1)})`, metrics.fps >= 30);
    performanceRuns.push({ night, ...metrics });
    if (night === 3) {
      await evaluate('__game.sim.wind.nextTick = __game.sim.simSteps + 30'); await delay(100);
      check('wind warning shows leaves and dispatches sound', await evaluate('document.getElementById("wind").textContent.includes("đang tới") && __game.audio.sounds.wind > 0'));
      await shot('wind-warning'); await delay(500);
      check('wind warning becomes an active gust', await evaluate('__game.sim.wind.active && document.getElementById("wind").textContent.includes("mạnh")'));
    }
    // Explicit time/fuel fixtures test both no early win and the final dawn tick.
    await evaluate(`__game.loadScenario({time_left_s:30,random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,lanterns:__game.sim.map.lanterns.map(l=>({id:l.id,pos:[l.pos.x,l.pos.y,l.pos.z],lit:true,fuel:100}))})`);
    await delay(200);
    check(`night ${night} all-lit state does not win early`, await evaluate('__game.screen === "playing" && __game.sim.state === "playing"'));
    await evaluate(`__game.loadScenario({time_left_s:2/60,random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,lanterns:__game.sim.map.lanterns.slice(0,__game.sim.requiredLitCount).map(l=>({id:l.id,pos:[l.pos.x,l.pos.y,l.pos.z],lit:true,fuel:80}))})`);
    await waitFor(night === 3 ? '__game.screen === "dawn"' : '__game.screen === "result"');
    if (night < 3) { await shot(`result-${night}`); await click('continueGame'); await waitFor('__game.screen === "intro"'); await click('enterNight'); await waitFor('__game.screen === "playing"'); }
  }
  check('Bình Minh totals exactly three won nights', await evaluate('__game.campaign.complete && __game.campaign.scores.size === 3 && document.body.innerText.includes("Bình Minh")'));
  await shot('dawn');
  const gpu = await evaluate(`(() => { const gl = __game.renderer.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return {vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}; })()`);
  check('no uncaught browser exceptions', errors.length === 0);
  writeFileSync(join(PROOF, 'performance-gui.json'), JSON.stringify({ mode: 'isolated Chrome headless; actual WebGL rendering, real wall-clock RAF', viewport: { width:1280,height:720,deviceScaleFactor:1 },
    browser: version, gpu, cpu: cpus()[0]?.model, os: `${platform()} ${release()}`, runs: performanceRuns,
    caveat: 'Headless measurement does not replace listening to audio and measuring a normal visible browser window.' }, null, 2) + '\n');
  writeFileSync(join(PROOF, 'gui-checks.json'), JSON.stringify({ checks, errors, fixtures: 'Explicit core scenarios for low-fuel/palette visuals, timer, loss/retry and final dawn transitions; no game tuning changed.' }, null, 2) + '\n');
  report(`== GUI passed: ${checks.length} checks ==`);
} catch (error) {
  report(`FAIL ${error.stack ?? error}`);
  writeFileSync(join(PROOF, 'gui-checks.json'), JSON.stringify({ checks, errors, failure: String(error) }, null, 2));
  if (socket?.readyState === WebSocket.OPEN && sessionId) { try { await shot('failure'); } catch {} }
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close', {}, null); } catch {}
    socket.close();
  }
  browser.kill();
  server?.stop();
}
