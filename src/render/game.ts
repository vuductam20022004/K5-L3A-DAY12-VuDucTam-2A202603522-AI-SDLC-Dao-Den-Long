import { GameSim, TICK_RATE, defaultFrame } from '../core/sim';
import { parseScenario } from '../core/io';
import { Campaign } from '../core/campaign';
import { TUNING } from '../core/config';
import type { FrameInput, GameEvent } from '../core/types';
import { Renderer } from './renderer';
import { readMoveInput } from './input';
import { Audio } from './audio';
import { loadSettings, saveSettings } from './settings';
import { ACTION_LABELS, DEFAULT_BINDINGS, keyLabel, setBinding, type Action } from './bindings';
import { validateEntry, type LeaderboardEntry } from '../shared/leaderboard';


const $ = (id: string) => document.getElementById(id)!;
const renderer = new Renderer($('app'));
$('boot').remove();
const canvas = renderer.renderer.domElement;
canvas.tabIndex = 0;
const audio = new Audio();
const settings = loadSettings(); audio.setVolume(settings.volume);
renderer.setAccessiblePalette(settings.accessiblePalette);
document.body.dataset.accessible = String(settings.accessiblePalette);
function applyPreferences():void{
  document.body.dataset.accessible=String(settings.accessiblePalette);
  document.body.dataset.reducedMotion=String(settings.reducedMotion);
  document.body.dataset.largeText=String(settings.largeText);
  renderer.setAccessiblePalette(settings.accessiblePalette);renderer.setReducedMotion(settings.reducedMotion);
}
applyPreferences();
let campaign = new Campaign(Date.now() % 100000);
let sim = campaign.startNight();
type Screen = 'menu' | 'intro' | 'playing' | 'pause' | 'settings' | 'result' | 'dawn' | 'leaderboard';
let screen: Screen = 'menu';
let settingsReturn: Screen = 'menu';
let camYaw = 0, camPitch = 0.28;
let acc = 0, last = performance.now();
let toastLeft = 0;
let previousCountdown = 11;
const keys = new Set<string>();
let pausePending = false;
let editingBinding:Action|undefined;
let scoreSaved=false;
const spawnCues:Array<{id:string;pos:{x:number;y:number;z:number};until:number}>=[];
const metrics = { frames: 0, milliseconds: 0, fps: 0, drawCalls: 0 };

function clearInput(): void { keys.clear(); pausePending = false; }
function toast(text: string): void { $('toast').textContent = text; $('toast').classList.add('show'); toastLeft = 3; }
function button(id: string, fn: () => void): void { $(id).onclick = fn; }
function controlGuide(): string {
  const b=settings.bindings,k=keyLabel;
  return `${[b.forward,b.left,b.backward,b.right].map(k).join('/')} di chuyển · Chuột xoay camera<br />${k(b.jump)} nhảy · ${k(b.dash)} lướt · ${k(b.interact)} nạp · ${k(b.pulse)} tỏa sáng · ${k(b.pause)} tạm dừng`;
}
function releasePointer(): void { if (document.pointerLockElement) document.exitPointerLock(); }
function show(next: Screen): void {
  screen = next;
  $('panel').hidden = next === 'playing';
  $('hud').hidden = !(['playing','pause','result'].includes(next)||(next==='settings'&&settingsReturn==='pause'));
  $('bottomHud').hidden = $('hud').hidden;
  audio.setActive(next === 'playing', sim.night);
  if (next !== 'playing') { clearInput(); releasePointer(); }
  const panel = $('panel');
  if(next!=='settings')editingBinding=undefined;
  if (next === 'menu') {
    panel.innerHTML = `<div class="eyebrow">GIỮ ĐẢO SÁNG TỚI BÌNH MINH</div><h1>Đảo Đèn Lồng</h1>
      <p class="lead">Một túi đom đóm. Một đốm lửa nhỏ.<br />Cùng Mây đưa ánh sáng trở về biển mây.</p>
      <div class="islands"><span>01 · Đảo Bến</span><span>02 · Đảo Cau</span><span>03 · Đảo Chuông</span></div>
      <button id="newGame">Bắt đầu hành trình <span>→</span></button><button id="menuSettings" class="secondary">Cài đặt</button><button id="openLeaderboard" class="secondary">Bảng xếp hạng</button>
      <p class="controls">${controlGuide()}</p>`;
    button('newGame', () => { void audio.unlock(); campaign = new Campaign(Date.now() % 100000); prepareNight(); });
    button('menuSettings', () => { settingsReturn = 'menu'; show('settings'); });
    button('openLeaderboard',()=>show('leaderboard'));
  } else if(next==='leaderboard'){
    panel.innerHTML='<h1>Bảng xếp hạng</h1><p class="lead">Top 10 · Tổng điểm các Đêm đã thắng</p><div id="leaderboardRows" role="status">Đang tải…</div><button id="leaderboardBack">Về menu</button>';
    button('leaderboardBack',()=>show('menu'));
    void fetch('/api/leaderboard').then(async r=>{if(!r.ok)throw new Error('Không tải được bảng điểm');return r.json();}).then(data=>{
      if(screen!=='leaderboard')return;
      const rows=$('leaderboardRows');rows.replaceChildren();
      if(!data.entries.length){rows.textContent='Chưa có điểm. Hãy bắt đầu hành trình!';return;}
      const table=document.createElement('table');table.innerHTML='<thead><tr><th>Hạng</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th></tr></thead>';
      const body=document.createElement('tbody');
      data.entries.forEach((raw:unknown,i:number)=>{const e=validateEntry(raw),row=document.createElement('tr');for(const value of [i+1,e.name,e.score,e.nights_won]){const cell=document.createElement('td');cell.textContent=String(value);row.appendChild(cell);}body.appendChild(row);});
      table.appendChild(body);rows.appendChild(table);
    }).catch(e=>{if(screen==='leaderboard')$('leaderboardRows').textContent=(e as Error).message;});
  } else if (next === 'intro') {
    panel.innerHTML = `<div class="eyebrow">ĐÊM ${sim.night} / 3</div><h1>${sim.map.name}</h1>
      <p class="speaker">ÔNG ĐĂNG</p><p class="lead">${sim.map.og}</p>
      <div class="islands"><span>${sim.lanterns.length} đèn lồng</span><span>${sim.map.durationS / 60} phút</span><span>3 Ngọn Lửa</span></div>
      <button id="enterNight">Vào cuộc đêm →</button><button id="introMenu" class="secondary">Về menu</button>
      <p class="controls">Giữ ít nhất ${sim.requiredLitCount}/${sim.lanterns.length} đèn sáng khi hết giờ. Đèn sáng đủ vẫn phải chờ bình minh.<br />Dầu chỉ đủ 100 giây: châm dầu bằng ${keyLabel(settings.bindings.interact)}. Thắp mới cần 10 đom đóm, thắp lại cần 5.<br />Dầu dưới 30 mất vùng an toàn. Tỏa Sáng đuổi bóng hút dầu!</p>`;
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
      <label class="toggle" for="accessiblePalette"><input id="accessiblePalette" type="checkbox" /> Bảng màu dễ phân biệt</label>
      <label class="toggle" for="reducedMotion"><input id="reducedMotion" type="checkbox" /> Giảm chuyển động / tắt chớp màn hình</label>
      <label class="toggle" for="largeText"><input id="largeText" type="checkbox" /> Chữ lớn (×1.25)</label>
      <section class="binding-list" aria-label="Đổi phím"><h2>Đổi phím</h2>${(Object.keys(ACTION_LABELS) as Action[]).map(action=>`<div class="binding-row"><span>${ACTION_LABELS[action]}</span><button type="button" class="binding secondary" data-action="${action}">${keyLabel(settings.bindings[action])}</button></div>`).join('')}</section>
      <p id="bindingStatus" role="status"></p><button id="resetBindings" class="secondary">Khôi phục phím mặc định</button>
      <p class="controls">Tự động lưu trên trình duyệt này.</p><button id="settingsBack">Quay lại</button>`;
    const volume = $('volume') as HTMLInputElement, sensitivity = $('sensitivity') as HTMLInputElement;
    const palette = $('accessiblePalette') as HTMLInputElement;
    const reduced=$('reducedMotion') as HTMLInputElement,large=$('largeText') as HTMLInputElement;
    palette.checked = settings.accessiblePalette;
    reduced.checked=settings.reducedMotion;large.checked=settings.largeText;
    volume.value = String(settings.volume * 100); sensitivity.value = String(settings.sensitivity * 1000);
    const update = () => {
      settings.volume = Number(volume.value) / 100; settings.sensitivity = Number(sensitivity.value) / 1000;
      settings.accessiblePalette = palette.checked;
      settings.reducedMotion=reduced.checked;settings.largeText=large.checked;
      $('volumeValue').textContent = `${Math.round(settings.volume * 100)}%`;
      $('sensitivityValue').textContent = `${(settings.sensitivity * 1000).toFixed(1)}`;
      audio.setVolume(settings.volume); saveSettings(settings);
      applyPreferences();
    };
    update(); volume.oninput = update; sensitivity.oninput = update; palette.onchange = update;
    reduced.onchange=update;large.onchange=update;
    panel.querySelectorAll<HTMLButtonElement>('.binding').forEach(b=>b.onclick=()=>{editingBinding=b.dataset.action as Action;b.textContent='Nhấn phím…';$('bindingStatus').textContent=`Chọn phím cho ${ACTION_LABELS[editingBinding]}`;});
    button('resetBindings',()=>{settings.bindings={...DEFAULT_BINDINGS};saveSettings(settings);show('settings');$('bindingStatus').textContent='Đã khôi phục phím mặc định';});
    button('settingsBack', () => show(settingsReturn));
  } else if (next === 'result' || next === 'dawn') {
    const won = sim.state === 'won';
    panel.innerHTML = `<div class="eyebrow">${next === 'dawn' ? 'BA HÒN ĐẢO ĐÃ BỪNG SÁNG' : `ĐÊM ${sim.night} · ${sim.map.name}`}</div>
      <h1>${next === 'dawn' ? 'Bình Minh' : won ? 'Đảo đã sáng!' : 'Đêm chưa trọn'}</h1>
      <p class="lead">${next === 'dawn' ? 'Tiếng chuông ngân qua biển mây. Mây đã giữ được ánh sáng tới bình minh.' : won ? 'Bình minh đã tới, đảo vẫn sáng. Ông Đăng đang đợi bạn ở đảo tiếp theo.' : sim.player.flames <= 0 ? 'Ngọn Lửa đã tắt. Hãy thử lại và giữ ánh sáng bên mình.' : `Bình minh đã tới. Cần giữ ít nhất ${sim.requiredLitCount} đèn sáng để vượt Đêm này.`}</p>
      <div class="result-score">${next === 'dawn' ? campaign.totalScore : sim.score}<small>${next === 'dawn' ? 'TỔNG ĐIỂM' : 'ĐIỂM ĐÊM NÀY'}</small></div>
      <p class="controls">Đèn ${sim.lanterns.filter((l) => l.lit).length}/${sim.lanterns.length} · Tổng các đêm thắng: ${campaign.totalScore}</p>
      <button id="continueGame">${next === 'dawn' ? 'Một hành trình mới' : won ? 'Đêm kế tiếp →' : 'Chơi lại Đêm'}</button>
      <button id="resultMenu" class="secondary">Về menu</button>${(next==='dawn'||!won)&&!scoreSaved?'<form id="scoreForm"><label for="playerName">Lưu điểm · Tên 3–12 chữ/số/_</label><input id="playerName" name="playerName" pattern="[A-Za-z0-9_]{3,12}" minlength="3" maxlength="12" required autocomplete="off" /><button id="saveScore" type="submit">Lưu vào bảng xếp hạng</button><p id="scoreStatus" role="status"></p></form>':''}`;
    if($('scoreForm'))$('scoreForm').onsubmit=(event)=>{
      event.preventDefault();const submit=$('saveScore') as HTMLButtonElement;
      const status=$('scoreStatus'),submittedSim=sim;
      const entry:LeaderboardEntry={name:($('playerName') as HTMLInputElement).value,score:campaign.totalScore,nights_won:campaign.scores.size,achieved_at:new Date().toISOString(),seed:campaign.seed};
      try{validateEntry(entry);}catch(e){$('scoreStatus').textContent=(e as Error).message;return;}
      submit.disabled=true;
      void fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??'Không ghi được điểm trên đĩa');if(sim===submittedSim)scoreSaved=true;status.textContent='Đã lưu điểm trên máy này';}).catch(e=>{status.textContent=(e as Error).message;submit.disabled=false;});
    };
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
  scoreSaved=false;spawnCues.length=0;
  camYaw = 0; camPitch = 0.28; acc = 0; previousCountdown = 11;
  $('nightLabel').textContent = `Đêm ${sim.night} · ${sim.map.name}`;
  show('intro');
}

addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if(screen==='playing'&&Object.values(settings.bindings).includes(key))e.preventDefault();
  if(editingBinding){e.preventDefault();try{settings.bindings=setBinding(settings.bindings,editingBinding,key);saveSettings(settings);document.querySelector<HTMLButtonElement>(`.binding[data-action="${editingBinding}"]`)!.textContent=keyLabel(key);editingBinding=undefined;$('bindingStatus').textContent='Đã lưu phím';}catch(error){$('bindingStatus').textContent=(error as Error).message;}return;}
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(key) && screen === 'playing') e.preventDefault();
  if (e.repeat || (e.target instanceof HTMLInputElement)) return;
  if (key === settings.bindings.pause || key==='escape'&&!Object.values(settings.bindings).includes('escape')) {
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
      toast(ev.data.relight ? `Đèn ${ev.data.lantern_id} sáng trở lại. Giữ ánh sáng tới bình minh!` : lines[index] ?? `Đèn ${ev.data.lantern_id} đã sáng!`);
    }
    else if (ev.name === 'lantern_out') toast(`${settings.accessiblePalette ? '⚠ ' : ''}Đèn ${ev.data.lantern_id} đã tắt. Mang 5 đom đóm để thắp lại.`);
    else if (ev.name === 'refuel') toast(`Đã châm dầu cho ${ev.data.lantern_id}: ${ev.data.fuel}/100`);
    else if (ev.name === 'charm_picked') toast('Bùa Gió · chạy nhanh, lướt không hồi chiêu trong 10 giây');
    else if (ev.name === 'drifter_steal') toast(`Gió Lạc cướp ${ev.data.amount} đom đóm! Tỏa Sáng để lấy lại.`);
    else if (ev.name === 'drifter_drop') toast('Gió Lạc đã thả lại đom đóm!');
    else if (ev.name === 'player_hit') { toast(ev.data.by === 'fall' ? 'Rơi khỏi đảo! Đang trở về điểm xuất phát…' : 'Bóng Mực chạm Mây!'); if(!settings.reducedMotion){$('flash').classList.remove('hit'); void $('flash').offsetWidth; $('flash').classList.add('hit');} }
    else if(ev.name==='shade_spawned'){const shade=sim.shades.find(s=>s.id===ev.data.id);if(shade){spawnCues.push({id:shade.id,pos:{...shade.pos},until:sim.simSteps+180});toast('⚠ Bóng Mực xuất hiện! Theo mũi tên ở mép màn hình.');}}
    else if (ev.name === 'pulse') renderer.showPulse(sim.player.pos.x, sim.player.pos.z, TUNING.pulse_radius, sim.player.pos.y);
    else if (ev.name === 'game_over') {
      campaign.record(sim); audio.sfx(sim.state === 'won' ? 'won' : 'lost');
      show(campaign.complete ? 'dawn' : 'result');
    }
  }
}
function hud(): void {
  const b=settings.bindings;
  $('keyGuide').textContent=`${[b.forward,b.left,b.backward,b.right].map(keyLabel).join('/')} di chuyển · Chuột xoay · ${keyLabel(b.jump)} nhảy · ${keyLabel(b.pause)} tạm dừng`;
  $('flames').textContent = '● '.repeat(Math.max(0, sim.player.flames)).trim();
  $('score').textContent = String(sim.score);
  $('lanternCount').textContent = `${sim.lanterns.filter((l) => l.lit).length}/${sim.lanterns.length}`;
  $('goalLabel').textContent = `Giữ ≥${sim.requiredLitCount} đèn tới bình minh`;
  const time = Math.max(0, Math.ceil(sim.timeLeft()));
  $('time').textContent = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('danger', time <= 30);
  $('dangerMarker').hidden = !settings.accessiblePalette || time > 30;
  $('carryCount').textContent = `${sim.player.carried}/${sim.capacity}`;
  if ($('slots').children.length !== sim.capacity) {
    $('slots').replaceChildren(...Array.from({ length: sim.capacity }, () => document.createElement('span')));
  }
  Array.from($('slots').children).forEach((slot, i) => slot.classList.toggle('filled', i < sim.player.carried));
  const p = sim.snapshot().player;
  $('dashCd').textContent = p.dash_cd_s > 0 ? `${p.dash_cd_s.toFixed(1)}s` : 'Sẵn sàng';
  $('pulseCd').textContent = p.pulse_cd_s > 0 ? `${p.pulse_cd_s.toFixed(1)}s` : sim.player.carried < 3 ? 'Cần 3 đom đóm' : 'Sẵn sàng';
  $('charm').textContent = p.charm_s > 0 ? `Bùa Gió ${p.charm_s.toFixed(1)}s` : '';
  const receiver = sim.nearestReceivableLantern(sim.player.pos);
  const distance = receiver ? Math.hypot(receiver.pos.x - sim.player.pos.x, receiver.pos.z - sim.player.pos.z) : Infinity;
  $('interactHint').hidden = !receiver || distance > TUNING.interact_radius || sim.player.deadUntilTick > 0 || screen !== 'playing';
  $('interactHint').textContent = receiver?.lit ? `E — Châm dầu (${sim.fuel(receiver).toFixed(1)}/100)` :
    `${keyLabel(settings.bindings.interact)} — ${receiver?.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${receiver?.deposited ?? 0}/${receiver ? sim.lanternCost(receiver) : 10})`;
  if(receiver?.lit)$('interactHint').textContent=`${keyLabel(settings.bindings.interact)} — Châm dầu (${sim.fuel(receiver).toFixed(1)}/100)`;
  const weak = sim.lanterns.filter((l) => l.lit && l.fuelTicks < TUNING.low_fuel_threshold * TICK_RATE).sort((a,b) => a.fuelTicks - b.fuelTicks || a.id.localeCompare(b.id))[0];
  $('fuelStatus').textContent = weak ? `${settings.accessiblePalette ? '⚠ ' : ''}${weak.id} sắp hết dầu · ${sim.fuel(weak).toFixed(1)}/100` : 'Dầu ≥30 giữ vùng an toàn';
  $('fuelStatus').classList.toggle('danger', !!weak);
  const lamp = sim.nearestUnlitLantern(sim.player.pos);
  const arrow = $('direction'); arrow.hidden = !lamp || screen !== 'playing';
  if (lamp) {
    const projected = renderer.project(lamp.pos);
    arrow.hidden = projected.visible || screen !== 'playing';
    const angle = Math.atan2(lamp.pos.x - sim.player.pos.x, lamp.pos.z - sim.player.pos.z) - camYaw;
    $('arrow').style.transform = `rotate(${-angle * 180 / Math.PI}deg)`;
    $('target').textContent = `${lamp.id} · ${Math.round(Math.hypot(lamp.pos.x - sim.player.pos.x, lamp.pos.z - sim.player.pos.z))} m`;
  }
  $('wind').textContent = sim.wind.active ? `${settings.accessiblePalette ? '⚠ ' : ''}Gió mạnh!` : sim.wind.warnUntilTick > sim.simSteps ? `${settings.accessiblePalette ? '⚠ ' : ''}Gió đang tới…` : '';
  $('countdownCaption').textContent=time<=10&&screen==='playing'?`⚠ Còn ${time} giây tới bình minh`:'';
  $('dashKey').textContent=keyLabel(settings.bindings.dash);$('pulseKey').textContent=keyLabel(settings.bindings.pulse);
  const cueRoot=$('spawnCues');cueRoot.replaceChildren();
  for(const cue of spawnCues.filter(c=>c.until>sim.simSteps).slice(-2)){
    if(screen!=='playing')continue;
    const angle=Math.atan2(cue.pos.x-sim.player.pos.x,cue.pos.z-sim.player.pos.z)-camYaw;
    const x=-Math.sin(angle),y=-Math.cos(angle),divisor=Math.max(Math.abs(x),Math.abs(y),0.01);
    const node=document.createElement('div');node.className='spawn-cue';node.style.left=`${Math.max(124,Math.min(innerWidth-124,innerWidth*(0.5+0.46*x/divisor)))}px`;node.style.top=`${Math.max(120,Math.min(innerHeight-120,innerHeight*(0.5+0.37*y/divisor)))}px`;
    const arrow=document.createElement('span');arrow.textContent='↑';arrow.style.transform=`rotate(${-angle*180/Math.PI}deg)`;
    const label=document.createElement('span');label.textContent=`⚠ Bóng Mực ${cue.id}`;node.append(arrow,label);cueRoot.append(node);
  }
  while(spawnCues[0]&&spawnCues[0].until<=sim.simSteps)spawnCues.shift();
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
      const input: FrameInput = { ...defaultFrame(), move: readMoveInput(keys,settings.bindings), cam_yaw_deg: camYaw * 180 / Math.PI,
        jump: keys.has(settings.bindings.jump), interact: keys.has(settings.bindings.interact), pulse: keys.has(settings.bindings.pulse), dash: keys.has(settings.bindings.dash), pause: pausePending };
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
  renderer.updateCamera(sim.player.pos, camYaw, camPitch);
  renderer.sync(sim); renderer.animate(sim, sim.state === 'paused' ? 0 : Math.min(dt / 1000, 0.1));
  renderer.render(); hud();
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
  loadScenario(scenario: unknown) {
    if (!import.meta.env.DEV) return;
    sim = new GameSim({ seed: 42, night: campaign.night, scenario: parseScenario(scenario) });
    renderer.clearDynamic(); clearInput(); previousCountdown = 11; acc = 0;
  },
  previewNight(night: number) { if (import.meta.env.DEV && [1, 2, 3].includes(night)) { campaign = new Campaign(42); campaign.night = night; prepareNight(); } },
} });
