#!/usr/bin/env node
/** Isolated local browser regression tests, without the user's Chrome profile.
 * Node >=22; uses the installed Chrome and its standard DevTools protocol.
 * Run Vite first. This script never attaches to an existing browser.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform, release } from 'node:os';
import assert from 'node:assert/strict';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROOF = resolve(ROOT, 'docs/proof/phase-2');
const ART = resolve(ROOT, 'artifacts');
mkdirSync(join(PROOF, 'screenshots'), { recursive: true }); mkdirSync(ART, { recursive: true });
const chrome = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(chrome, 'Set CHROME_PATH to an installed Chromium browser');
const url = process.env.GUI_URL ?? 'http://127.0.0.1:5173';
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
  await shot('settings'); await click('settingsBack'); await click('resume');
  await waitFor('__game.screen === "playing"');
  check('resume returns to gameplay', await evaluate('__game.sim.state === "playing"'));
  const audio = await evaluate('__game.audio');
  check('Web Audio unlocked and SFX were dispatched', audio.state === 'running' && audio.sounds.jump > 0 && audio.sounds.pulse > 0 && audio.sounds.dash > 0);
  await evaluate('__game.sim.player.flames = 0'); await waitFor('__game.screen === "result"');
  check('losing a night does not add campaign score', await evaluate('__game.campaign.totalScore === 0'));
  await click('continueGame'); await waitFor('__game.screen === "intro"');
  check('retry keeps the same night and restores three flames', await evaluate('__game.sim.night === 1 && __game.sim.player.flames === 3 && __game.sim.simSteps === 0'));
  await click('enterNight'); await waitFor('__game.screen === "playing"');
  await evaluate('__game.sim.simSteps = 16201'); await delay(100);
  check('last thirty seconds turn the clock red', await evaluate('document.getElementById("clock").classList.contains("danger")'));
  await evaluate('__game.sim.simSteps = 17401'); await delay(100);
  check('final ten seconds emit countdown sound', await evaluate('__game.audio.sounds.countdown > 0'));
  await evaluate('__game.sim.player.pos = {...__game.sim.lanterns[0].pos}; __game.sim.player.carried = 10');
  await delay(100);
  check('nearby lamp exposes E deposit hint', await evaluate('!document.getElementById("interactHint").hidden'));
  await key('e', 'KeyE');
  check('E lights a lamp, scores deposit and raises ambient light', await evaluate('__game.sim.lanterns[0].lit && __game.sim.score === 200 && Math.abs(__game.renderer.ambient.intensity - 0.26) < 0.001'));
  await shot('lamp-lit');
  await send('Page.reload'); await waitFor('window.__game?.screen === "menu"');
  check('settings survive page reload', await evaluate('__game.settings.volume === 0.37 && __game.settings.sensitivity === 0.0065'));
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
    // Finish through the core's normal tick/game_over event using a documented fixture.
    await evaluate('__game.sim.lanterns.forEach(l => l.lit = true)');
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
  writeFileSync(join(PROOF, 'gui-checks.json'), JSON.stringify({ checks, errors, fixtures: 'Map overview positions and all-lit lamps for campaign transitions; gameplay rules unchanged.' }, null, 2) + '\n');
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
}
