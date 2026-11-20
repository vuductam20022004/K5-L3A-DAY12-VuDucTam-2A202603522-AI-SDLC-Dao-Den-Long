import { TICK_RATE, defaultFrame } from './core/sim';
import { Campaign } from './core/campaign';
import { TUNING } from './core/config';
import type { FrameInput, GameEvent } from './core/types';
import { Renderer } from './render/renderer';
import { readMoveInput } from './render/input';
import { Audio } from './render/audio';
import { loadSettings, saveSettings } from './render/settings';
import './render/styles.css';

const $ = (id: string) => document.getElementById(id)!;
const renderer = new Renderer($('app'));
$('boot').remove();
const canvas = renderer.renderer.domElement;
canvas.tabIndex = 0;
const audio = new Audio();
const settings = loadSettings(); audio.setVolume(settings.volume);
let campaign = new Campaign(Date.now() % 100000);
let sim = campaign.startNight();
type Screen = 'menu' | 'intro' | 'playing' | 'pause' | 'settings' | 'result' | 'dawn';
let screen: Screen = 'menu';
let settingsReturn: Screen = 'menu';
let camYaw = 0, camPitch = 0.28;
let acc = 0, last = performance.now();
let toastLeft = 0;
let previousCountdown = 11;
const keys = new Set<string>();
let pausePending = false;
const metrics = { frames: 0, milliseconds: 0, fps: 0, drawCalls: 0 };

function clearInput(): void { keys.clear(); pausePending = false; }
function toast(text: string): void { $('toast').textContent = text; $('toast').classList.add('show'); toastLeft = 3; }
function button(id: string, fn: () => void): void { $(id).onclick = fn; }
function releasePointer(): void { if (document.pointerLockElement) document.exitPointerLock(); }
function show(next: Screen): void {
  screen = next;
  $('panel').hidden = next === 'playing';
  $('hud').hidden = next === 'menu' || next === 'intro' || next === 'dawn';
  $('bottomHud').hidden = $('hud').hidden;
  audio.setActive(next === 'playing', sim.night);
  if (next !== 'playing') { clearInput(); releasePointer(); }
  const panel = $('panel');
  if (next === 'menu') {
    panel.innerHTML = `<div class="eyebrow">BA HÒN ĐẢO · BA ĐÊM ÁNH SÁNG</div><h1>Đảo Đèn Lồng</h1>
      <p class="lead">Một túi đom đóm. Một đốm lửa nhỏ.<br />Cùng Mây đưa ánh sáng trở về biển mây.</p>
      <div class="islands"><span>01 · Đảo Bến</span><span>02 · Đảo Cau</span><span>03 · Đảo Chuông</span></div>
      <button id="newGame">Bắt đầu hành trình <span>→</span></button><button id="menuSettings" class="secondary">Cài đặt</button>
      <p class="controls">WASD / ↑↓←→ di chuyển · Chuột xoay camera<br />Space nhảy · Shift lướt · E nạp · Q tỏa sáng · Esc/P tạm dừng</p>`;
    button('newGame', () => { void audio.unlock(); campaign = new Campaign(Date.now() % 100000); prepareNight(); });
    button('menuSettings', () => { settingsReturn = 'menu'; show('settings'); });
  } else if (next === 'intro') {
    panel.innerHTML = `<div class="eyebrow">ĐÊM ${sim.night} / 3</div><h1>${sim.map.name}</h1>
      <p class="speaker">ÔNG ĐĂNG</p><p class="lead">${sim.map.og}</p>
      <div class="islands"><span>${sim.lanterns.length} đèn lồng</span><span>${sim.map.durationS / 60} phút</span><span>3 Ngọn Lửa</span></div>
      <button id="enterNight">Vào cuộc đêm →</button><button id="introMenu" class="secondary">Về menu</button>
      <p class="controls">Mỗi đèn cần 10 đom đóm. Tỏa Sáng tốn 3 đom đóm.<br />Lướt qua khoảng trống, đi theo mũi tên để tìm đèn chưa sáng.</p>`;
    button('enterNight', () => { void audio.unlock(); show('playing'); canvas.focus(); acc = 0; last = performance.now(); });
    button('introMenu', () => show('menu'));
  } else if (next === 'pause') {
    panel.innerHTML = `<div class="eyebrow">ĐÊM ${sim.night} · ${sim.map.name}</div><h1>Tạm dừng</h1><p class="lead">Ánh sáng vẫn đang chờ Mây.</p>
      <button id="resume">Tiếp tục</button><button id="restart" class="secondary">Chơi lại Đêm</button>
      <button id="pauseSettings" class="secondary">Cài đặt</button><button id="backMenu" class="text-button">Về menu</button>`;
    button('resume', () => { pausePending = true; });
    button('restart', prepareNight);
    button('pauseSettings', () => { settingsReturn = 'pause'; show('settings'); });
    button('backMenu', () => show('menu'));
  } else if (next === 'settings') {
    panel.innerHTML = `<div class="eyebrow">THEO CÁCH CỦA BẠN</div><h1>Cài đặt</h1>
      <label for="volume">Âm lượng <output id="volumeValue"></output></label><input id="volume" type="range" min="0" max="100" step="1" />
      <label for="sensitivity">Độ nhạy chuột <output id="sensitivityValue"></output></label><input id="sensitivity" type="range" min="1" max="12" step="0.5" />
      <p class="controls">Tự động lưu trên trình duyệt này.</p><button id="settingsBack">Quay lại</button>`;
    const volume = $('volume') as HTMLInputElement, sensitivity = $('sensitivity') as HTMLInputElement;
    volume.value = String(settings.volume * 100); sensitivity.value = String(settings.sensitivity * 1000);
    const update = () => {
      settings.volume = Number(volume.value) / 100; settings.sensitivity = Number(sensitivity.value) / 1000;
      $('volumeValue').textContent = `${Math.round(settings.volume * 100)}%`;
      $('sensitivityValue').textContent = `${(settings.sensitivity * 1000).toFixed(1)}`;
      audio.setVolume(settings.volume); saveSettings(settings);
    };
    update(); volume.oninput = update; sensitivity.oninput = update;
    button('settingsBack', () => show(settingsReturn));
  } else if (next === 'result' || next === 'dawn') {
    const won = sim.state === 'won';
    panel.innerHTML = `<div class="eyebrow">${next === 'dawn' ? 'BA HÒN ĐẢO ĐÃ BỪNG SÁNG' : `ĐÊM ${sim.night} · ${sim.map.name}`}</div>
      <h1>${next === 'dawn' ? 'Bình Minh' : won ? 'Đảo đã sáng!' : 'Đêm chưa trọn'}</h1>
      <p class="lead">${next === 'dawn' ? 'Tiếng chuông ngân qua biển mây. Mây đã đưa ánh sáng trở về.' : won ? 'Tất cả Đèn Lồng Lớn đã được thắp. Ông Đăng đang đợi bạn ở đảo tiếp theo.' : sim.player.flames <= 0 ? 'Ngọn Lửa đã tắt. Hãy thử lại và giữ ánh sáng bên mình.' : 'Bình minh đã tới khi vẫn còn đèn chưa sáng.'}</p>
      <div class="result-score">${next === 'dawn' ? campaign.totalScore : sim.score}<small>${next === 'dawn' ? 'TỔNG ĐIỂM' : 'ĐIỂM ĐÊM NÀY'}</small></div>
      <p class="controls">Đèn ${sim.lanterns.filter((l) => l.lit).length}/${sim.lanterns.length} · Tổng các đêm thắng: ${campaign.totalScore}</p>
      <button id="continueGame">${next === 'dawn' ? 'Một hành trình mới' : won ? 'Đêm kế tiếp →' : 'Chơi lại Đêm'}</button>
      <button id="resultMenu" class="secondary">Về menu</button>`;
    button('continueGame', () => {
      if (next === 'dawn') { campaign = new Campaign(Date.now() % 100000); }
      else if (won) campaign.nextNight();
      prepareNight();
    });
    button('resultMenu', () => show('menu'));
  }
}
function prepareNight(): void {
  sim = campaign.startNight(); renderer.clearDynamic(); clearInput();
  camYaw = 0; camPitch = 0.28; acc = 0; previousCountdown = 11;
  $('nightLabel').textContent = `Đêm ${sim.night} · ${sim.map.name}`;
  show('intro');
}

addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(key) && screen === 'playing') e.preventDefault();
  if (e.repeat || (e.target instanceof HTMLInputElement)) return;
  if (key === 'escape' || key === 'p') {
    if (screen === 'settings') show(settingsReturn);
    else if (screen === 'playing' || screen === 'pause') pausePending = true;
    return;
  }
  if (screen === 'playing') keys.add(key);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); if (screen === 'playing') pausePending = true; });
canvas.addEventListener('click', () => {
  if (screen === 'playing' && !document.pointerLockElement) {
    const request = canvas.requestPointerLock();
    if (request) void request.catch(() => toast('Có thể dùng phím ← →; nhấn giữ chuột để xoay camera.'));
  }
});
let dragging = false;
canvas.addEventListener('mousedown', () => { dragging = true; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (screen !== 'playing' || (!document.pointerLockElement && !dragging)) return;
  camYaw -= e.movementX * settings.sensitivity;
  camPitch = Math.max(-0.2, Math.min(0.95, camPitch + e.movementY * settings.sensitivity));
});

function onEvents(events: GameEvent[]): void {
  for (const ev of events) {
    audio.sfx(ev.name);
    if (ev.name === 'paused') show('pause');
    else if (ev.name === 'resumed') { show('playing'); canvas.focus(); }
    else if (ev.name === 'lantern_lit') {
      const lines = ['Một đốm lửa mở đường về bến.', 'Ánh sáng vẽ lại lối Mây đi.', 'Sương lùi, tiếng gió bỗng dịu hơn.',
        'Một ngọn đèn nữa, một lời hẹn về nhà.', 'Đèn soi bóng đảo giữa biển mây.', 'Qua nhịp cầu, ánh sáng nối liền hai bờ.', 'Tiếng chuông đón bình minh.'];
      const index = Number(String(ev.data.lantern_id).slice(1)) - 1;
      toast(lines[index] ?? `Đèn ${ev.data.lantern_id} đã sáng!`);
    }
    else if (ev.name === 'charm_picked') toast('Bùa Gió · chạy nhanh, lướt không hồi chiêu trong 10 giây');
    else if (ev.name === 'drifter_steal') toast(`Gió Lạc cướp ${ev.data.amount} đom đóm! Tỏa Sáng để lấy lại.`);
    else if (ev.name === 'drifter_drop') toast('Gió Lạc đã thả lại đom đóm!');
    else if (ev.name === 'player_hit') { toast(ev.data.by === 'fall' ? 'Rơi khỏi đảo! Đang trở về điểm xuất phát…' : 'Bóng Mực chạm Mây!'); $('flash').classList.remove('hit'); void $('flash').offsetWidth; $('flash').classList.add('hit'); }
    else if (ev.name === 'pulse') renderer.showPulse(sim.player.pos.x, sim.player.pos.z, TUNING.pulse_radius, sim.player.pos.y);
    else if (ev.name === 'game_over') {
      campaign.record(sim); audio.sfx(sim.state === 'won' ? 'won' : 'lost');
      show(campaign.complete ? 'dawn' : 'result');
    }
  }
}
function hud(): void {
  $('flames').textContent = '● '.repeat(Math.max(0, sim.player.flames)).trim();
  $('score').textContent = String(sim.score);
  $('lanternCount').textContent = `${sim.lanterns.filter((l) => l.lit).length}/${sim.lanterns.length}`;
  const time = Math.max(0, Math.ceil(sim.timeLeft()));
  $('time').textContent = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('danger', time <= 30);
  $('carryCount').textContent = `${sim.player.carried}/10`;
  Array.from($('slots').children).forEach((slot, i) => slot.classList.toggle('filled', i < sim.player.carried));
  const p = sim.snapshot().player;
  $('dashCd').textContent = p.dash_cd_s > 0 ? `${p.dash_cd_s.toFixed(1)}s` : 'Sẵn sàng';
  $('pulseCd').textContent = p.pulse_cd_s > 0 ? `${p.pulse_cd_s.toFixed(1)}s` : sim.player.carried < 3 ? 'Cần 3 đom đóm' : 'Sẵn sàng';
  $('charm').textContent = p.charm_s > 0 ? `Bùa Gió ${p.charm_s.toFixed(1)}s` : '';
  const lamp = sim.nearestUnlitLantern(sim.player.pos);
  const distance = lamp ? Math.hypot(lamp.pos.x - sim.player.pos.x, lamp.pos.z - sim.player.pos.z) : Infinity;
  $('interactHint').hidden = !lamp || distance > TUNING.interact_radius || sim.player.deadUntilTick > 0 || screen !== 'playing';
  $('interactHint').textContent = `E — Nạp ánh sáng (${lamp?.deposited ?? 0}/10)`;
  const arrow = $('direction'); arrow.hidden = !lamp || screen !== 'playing';
  if (lamp) {
    const projected = renderer.project(lamp.pos);
    arrow.hidden = projected.visible || screen !== 'playing';
    const angle = Math.atan2(lamp.pos.x - sim.player.pos.x, lamp.pos.z - sim.player.pos.z) - camYaw;
    $('arrow').style.transform = `rotate(${-angle * 180 / Math.PI}deg)`;
    $('target').textContent = `${lamp.id} · ${Math.round(distance)} m`;
  }
  $('wind').textContent = sim.wind.active ? 'Gió mạnh!' : sim.wind.warnUntilTick > sim.simSteps ? 'Gió đang tới…' : '';
}
for (let i = 0; i < 10; i++) $('slots').appendChild(document.createElement('span'));
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = now - last; last = now;
  const clocksRun = screen === 'playing' || screen === 'pause' || (screen === 'settings' && settingsReturn === 'pause');
  if (clocksRun) {
    acc += dt;
    let guard = 0;
    while (acc >= 1000 / TICK_RATE && guard++ < 120) {
      acc -= 1000 / TICK_RATE;
      const input: FrameInput = { ...defaultFrame(), move: readMoveInput(keys), cam_yaw_deg: camYaw * 180 / Math.PI,
        jump: keys.has(' '), interact: keys.has('e'), pulse: keys.has('q'), dash: keys.has('shift'), pause: pausePending };
      pausePending = false;
      const grounded = sim.player.grounded, warning = sim.wind.warnUntilTick;
      onEvents(sim.step(input));
      if (input.jump && grounded && !sim.player.grounded && sim.player.vel.y > 0) audio.sfx('jump');
      if (sim.wind.warnUntilTick !== warning && sim.wind.warnUntilTick > sim.simSteps) audio.sfx('wind');
      const seconds = Math.ceil(sim.timeLeft());
      if (screen === 'playing' && seconds <= 10 && seconds > 0 && seconds !== previousCountdown) { audio.sfx('countdown'); previousCountdown = seconds; }
      if (screen === 'result' || screen === 'dawn') { acc = 0; break; }
    }
  } else acc = 0;
  if (toastLeft > 0) { toastLeft -= dt / 1000; if (toastLeft <= 0) $('toast').classList.remove('show'); }
  renderer.sync(sim); renderer.animate(sim, sim.state === 'paused' ? 0 : Math.min(dt / 1000, 0.1));
  renderer.updateCamera(sim.player.pos, camYaw, camPitch); renderer.render(); hud();
  if (screen === 'playing') {
    metrics.frames++; metrics.milliseconds += dt;
    metrics.fps = metrics.frames * 1000 / metrics.milliseconds; metrics.drawCalls = renderer.renderer.info.render.calls;
  }
}
show('menu'); requestAnimationFrame(frame);
// Inspection hook used by local QA, excluded from game rules and headless.
Object.assign(window, { __game: {
  get sim() { return sim; }, get campaign() { return campaign; }, get renderer() { return renderer; },
  get screen() { return screen; }, get metrics() { return { ...metrics }; }, get settings() { return { ...settings }; },
  get audio() { return audio.diagnostics; },
  resetMetrics() { metrics.frames = metrics.milliseconds = metrics.fps = 0; },
  previewNight(night: number) { if (import.meta.env.DEV && [1, 2, 3].includes(night)) { campaign = new Campaign(42); campaign.night = night; prepareNight(); } },
} });
