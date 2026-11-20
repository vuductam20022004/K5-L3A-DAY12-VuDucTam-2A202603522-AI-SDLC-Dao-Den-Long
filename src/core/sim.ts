/**
 * Core simulation của Đảo Đèn Lồng — contract v1.2 (TICKET-03).
 *
 * Thuần TypeScript: không DOM, không three, không Math.random.
 * Mô hình tick cố định 60 tick/giây.
 *
 * Thứ tự xử lý trong một tick (TICKET-02, cập nhật TICKET-03):
 *   1. Đọc input (xử lý pause trước).
 *   2. Trừ dầu tự hao + drain, tắt đèn cạn, giảm các bộ đếm.
 *   3. Di chuyển Mây, kiểm tra rơi khỏi đảo.
 *   4. Nhặt đom đóm và bùa.
 *   5. Tương tác với đèn.
 *   6. Cập nhật vùng an toàn.
 *   7. Tỏa Sáng.
 *   8. Di chuyển Bóng Mực và Gió Lạc.
 *   9. Chạm (Gió Lạc trước, rồi Bóng Mực theo id tăng dần).
 *  10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch.
 *  11. Xét thắng/thua.
 */

import { RULES, TUNING, nightDuration, type Tuning } from './config';
import { Rng } from './rng';
import { getMap, supportY, type NightMap } from './maps';
import type {
  Charm,
  Drifter,
  FrameInput,
  GameEvent,
  GameState,
  Lantern,
  Mote,
  Player,
  Shade,
  ShadeState,
  Snapshot,
  Vec3,
} from './types';
import type { Scenario } from './io';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export interface GameSimOptions {
  seed: number;
  night: number;
  scenario?: Scenario;
  tuning?: Tuning;
}

export function defaultFrame(): FrameInput {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
}

export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function distXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class GameSim {
  readonly tuning: Tuning;
  readonly night: number;
  readonly map: NightMap;
  readonly rng: Rng;

  /** Số bước đã chạy (tick đồng hồ). */
  steps = 0;
  /** Số bước gameplay đã chạy (tick bị đóng băng khi tạm dừng). */
  simSteps = 0;
  state: GameState = 'playing';
  score = 0;

  player: Player = {
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    facing: [0, 1],
    grounded: true,
    flames: 0,
    carried: 0,
    successfulLights: 0,
    invulnUntilTick: -1,
    dashCdUntilTick: -1,
    pulseCdUntilTick: -1,
    charmUntilTick: -1,
    dashing: false,
    dashEndTick: -1,
    launched: false,
    deadUntilTick: -1,
    dashSavedVy: 0,
    launchVelocity: [0, 0],
  };

  motes: Mote[] = [];
  lanterns: Lantern[] = [];
  shades: Shade[] = [];
  drifters: Drifter[] = [];
  charms: Charm[] = [];

  /** Gió mạnh (Đêm 3). */
  wind = { active: false, dirDeg: 0, untilTick: -1, nextTick: 0, warnUntilTick: -1 };

  private initialTimeLeft: number;
  private nextMoteId = 1;
  private nextShadeId = 1;
  private nextDrifterId = 1;
  private pendingEvents: GameEvent[] = [];
  private prevButtons = { jump: false, interact: false, pulse: false, dash: false, pause: false };
  private shadeSpawnedCount = 0;
  private nextMoteSpawnTick = 0;
  private motePointCursor = 0;
  private randomDrifters = true;
  private randomShades = true;
  private randomMotes = true;
  private windEnabled = false;
  private nightStarted = false;

  constructor(opts: GameSimOptions) {
    this.tuning = opts.tuning ?? TUNING;
    this.night = opts.night;
    this.map = getMap(opts.night);
    this.rng = new Rng(opts.seed);
    const sc = opts.scenario ?? {};
    this.randomMotes = sc.random_motes !== false;
    this.randomShades = sc.random_shades !== false && sc.shades === undefined;
    this.randomDrifters = this.night >= 2 && sc.random_drifters !== false && sc.drifters === undefined;
    this.windEnabled = sc.wind_enabled ?? this.map.windEnabled;

    this.initialTimeLeft = sc.time_left_s ?? nightDuration(opts.night);

    this.player.flames = sc.player?.flames ?? this.tuning.flames;
    this.player.carried = sc.player?.carried ?? 0;
    this.player.successfulLights = sc.player?.successful_lights ?? 0;
    this.player.facing = [0, 1];
    if (sc.player?.pos) {
      this.player.pos = { x: sc.player.pos[0], y: sc.player.pos[1], z: sc.player.pos[2] };
    }
    this.player.grounded = supportY(this.map, this.player.pos.x, this.player.pos.z,
      this.player.pos.y + 1e-6) === this.player.pos.y;
    if (sc.player?.invuln_ticks !== undefined) {
      this.player.invulnUntilTick = this.simSteps + sc.player.invuln_ticks;
    }
    if (sc.player?.dash_cd_ticks !== undefined) {
      this.player.dashCdUntilTick = this.simSteps + sc.player.dash_cd_ticks;
    }
    if (sc.player?.pulse_cd_ticks !== undefined) {
      this.player.pulseCdUntilTick = this.simSteps + sc.player.pulse_cd_ticks;
    }
    if (sc.player?.charm_ticks !== undefined) {
      this.player.charmUntilTick = this.simSteps + sc.player.charm_ticks;
    }

    this.buildLanterns(sc);
    this.buildMotes(sc);
    this.buildShades(sc);
    this.buildDrifters(sc);
    this.buildCharms(sc);

    this.nextMoteSpawnTick = RULES.mote_spawn_interval_ticks;
    this.wind.nextTick = RULES.wind_interval_ticks;

  }

  // ---------------------------------------------------------------- setup

  private buildLanterns(sc: Scenario): void {
    const byId = new Map<string, Lantern>();
    for (const l of this.map.lanterns) {
      byId.set(l.id, { id: l.id, pos: { ...l.pos }, lit: false, deposited: 0, fuelTicks: 0, everLit: false, relitCount: 0 });
    }
    for (const sl of sc.lanterns ?? []) {
      const existing = byId.get(sl.id);
      const lantern: Lantern = existing ?? {
        id: sl.id,
        pos: { x: sl.pos[0], y: sl.pos[1], z: sl.pos[2] },
        lit: false,
        deposited: 0,
        fuelTicks: 0, everLit: false, relitCount: 0,
      };
      lantern.pos = { x: sl.pos[0], y: sl.pos[1], z: sl.pos[2] };
      lantern.deposited = sl.deposited ?? 0;
      // `lit: true` trong scenario không phát sự kiện và không cộng điểm.
      lantern.lit = sl.lit ?? false;
      lantern.fuelTicks = lantern.lit ? Math.round((sl.fuel ?? this.tuning.fuel_max) * TICK_RATE) : 0;
      lantern.everLit = lantern.lit || (sl.ever_lit ?? false);
      byId.set(sl.id, lantern);
    }
    this.lanterns = [...byId.values()];
  }

  private buildMotes(sc: Scenario): void {
    if (sc.motes) {
      this.motes = sc.motes.map((p, i) => ({
        id: `M${i + 1}`,
        pos: { x: p[0], y: p[1], z: p[2] },
        active: true,
        kind: 'random' as const,
        ttlTicks: -1,
      }));
      this.nextMoteId = this.motes.length + 1;
      return;
    }
    this.motes = [];
    if (sc.random_motes === false) return;
    for (let i = 0; i < RULES.initial_motes; i++) this.spawnMoteAtMapPoint();
  }

  private spawnMoteAtMapPoint(): boolean {
    const pts = this.map.motePoints;
    if (pts.length === 0) return false;
    for (let attempt = 0; attempt < pts.length; attempt++) {
      const idx = (this.motePointCursor + attempt) % pts.length;
      const p = pts[idx];
      const occupied = this.motes.some((m) => m.active && distXZ(m.pos, p) < 1.0);
      if (occupied) continue;
      this.motePointCursor = (idx + 1) % pts.length;
      this.motes.push({
        id: `M${this.nextMoteId++}`,
        pos: { x: p.x, y: p.y, z: p.z },
        active: true,
        kind: 'random',
        ttlTicks: -1,
      });
      return true;
    }
    return false;
  }

  private buildShades(sc: Scenario): void {
    if (sc.shades) {
      this.shades = sc.shades.map((s, i) => {
        const state = (s.state ?? 'chase') as ShadeState;
        return {
          id: s.id ?? `S${i + 1}`,
          pos: { x: s.pos[0], y: s.pos[1], z: s.pos[2] },
          state,
          stateTicksLeft: s.state_ticks_left ?? (state === 'stunned' ? RULES.pulse_stun_ticks : state === 'spawning' ? RULES.shade_spawn_ticks : state === 'recoil' ? RULES.hit_recoil_ticks : 0),
          stunUntilTick: -1,
          wanderDir: this.randomUnit(),
          pushDir: [1, 0],
          pushTicksLeft: 0,
          pushPerTick: 0,
          targetLanternId: s.target_lantern_id,
          drainTicks: 0,
        };
      });
      this.nextShadeId = this.shades.length + 1;
      this.shadeSpawnedCount = this.shades.length;
      return;
    }
    this.shades = [];
    this.shadeSpawnedCount = 0;
    this.randomShades = sc.random_shades !== false;
  }

  private buildDrifters(sc: Scenario): void {
    if (sc.drifters) {
      this.drifters = sc.drifters.map((d, i) => ({
        id: d.id ?? `D${i + 1}`,
        pos: { x: d.pos[0], y: d.pos[1], z: d.pos[2] },
        state: (d.state ?? 'idle') as Drifter['state'],
        stolen: d.stolen ?? 0,
        stateTicksLeft: d.state_ticks_left ?? 0,
      }));
      this.nextDrifterId = this.drifters.length + 1;
      this.randomDrifters = false;
      return;
    }
    this.drifters = [];
    this.randomDrifters = this.night >= 2 && sc.random_drifters !== false;
  }

  private buildCharms(sc: Scenario): void {
    if (sc.charms) {
      this.charms = sc.charms.map((c, i) => ({
        id: c.id ?? `C${i + 1}`,
        pos: { x: c.pos[0], y: c.pos[1], z: c.pos[2] },
        available: c.available ?? true,
        respawnTicks: c.respawn_ticks ?? 0,
      }));
      return;
    }
    this.charms = this.map.charms.map((c) => ({
      id: c.id,
      pos: { ...c.pos },
      available: true,
      respawnTicks: 0,
    }));
  }

  private randomUnit(): [number, number] {
    const a = this.rng.range(0, Math.PI * 2);
    return [Math.cos(a), Math.sin(a)];
  }

  // ------------------------------------------------------------- helpers

  /** Điểm xuất phát (0,0,0) — dùng khi hồi sinh sau khi rơi. */
  private spawnPoint(): Vec3 {
    return { x: 0, y: 0, z: 0 };
  }

  private litCount(): number {
    return this.lanterns.reduce((n, l) => n + (l.lit ? 1 : 0), 0);
  }

  get capacity(): number {
    return Math.min(this.tuning.capacity_max, this.tuning.carry_capacity + RULES.capacity_per_light * this.player.successfulLights);
  }

  get requiredLitCount(): number { return Math.ceil(this.tuning.win_ratio * this.lanterns.length); }

  lanternCost(lantern: Lantern): number { return lantern.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost; }

  fuel(lantern: Lantern): number { return Math.round(lantern.fuelTicks / TICK_RATE * 10) / 10; }

  nearestReceivableLantern(pos: Vec3): Lantern | null {
    return this.nearestLantern(pos, (l) => !l.lit || l.fuelTicks < this.tuning.fuel_max * TICK_RATE);
  }

  private nearestLantern(pos: Vec3, eligible: (l: Lantern) => boolean): Lantern | null {
    let best: Lantern | null = null, distance = Infinity;
    for (const lamp of this.lanterns) {
      if (!eligible(lamp)) continue;
      const d = distXZ(pos, lamp.pos);
      if (d < distance - 1e-9 || (Math.abs(d - distance) < 1e-9 && (!best || lamp.id < best.id))) {
        best = lamp; distance = d;
      }
    }
    return best;
  }

  /** Đèn chưa sáng gần nhất (bằng nhau thì id nhỏ hơn). */
  nearestUnlitLantern(pos: Vec3): Lantern | null {
    let best: Lantern | null = null;
    let bestD = Infinity;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const d = distXZ(pos, l.pos);
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) < 1e-9 && best && l.id < best.id)) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }

  /** Vùng an toàn: có đèn sáng nào trong bán kính không. */
  inSafeZone(pos: Vec3): boolean {
    for (const l of this.lanterns) {
      if (!l.lit || l.fuelTicks < this.tuning.low_fuel_threshold * TICK_RATE) continue;
      if (distXZ(pos, l.pos) < this.tuning.safe_radius - 1e-9) return true;
    }
    return false;
  }

  /** Đẩy vị trí ra khỏi vùng an toàn (nếu đang ở trong). */
  private pushOutOfSafeZone(pos: Vec3): Vec3 {
    for (const l of this.lanterns) {
      if (!l.lit || l.fuelTicks < this.tuning.low_fuel_threshold * TICK_RATE) continue;
      const d = distXZ(pos, l.pos);
      if (d < this.tuning.safe_radius) {
        const nx = d > 1e-6 ? (pos.x - l.pos.x) / d : 1;
        const nz = d > 1e-6 ? (pos.z - l.pos.z) / d : 0;
        const r = this.tuning.safe_radius;
        return { x: l.pos.x + nx * r, y: pos.y, z: l.pos.z + nz * r };
      }
    }
    return pos;
  }

  private playerSpeed(): number {
    return this.player.charmUntilTick > this.simSteps ? RULES.charm_speed : this.tuning.player_speed;
  }

  // ---------------------------------------------------------------- step

  /**
   * Chạy một bước. Input của tick k tạo ra trạng thái k+1.
   * Khi đang tạm dừng: tick vẫn tăng nhưng sim_tick / thời gian / hồi chiêu /
   * spawn / TTL đều đứng yên.
   */
  step(input: FrameInput = defaultFrame()): GameEvent[] {
    this.pendingEvents = [];
    this.steps += 1;

    if (!this.nightStarted) {
      this.nightStarted = true;
      this.pendingEvents.push({ name: 'night_start', data: { night: this.night } });
    }

    // 1. Pause xử lý trước.
    const pausePressed = !!input.pause && !this.prevButtons.pause;
    const jumpPressed = !!input.jump && !this.prevButtons.jump;
    const interactPressed = !!input.interact && !this.prevButtons.interact;
    const pulsePressed = !!input.pulse && !this.prevButtons.pulse;
    const dashPressed = !!input.dash && !this.prevButtons.dash;
    this.prevButtons = {
      jump: !!input.jump,
      interact: !!input.interact,
      pulse: !!input.pulse,
      dash: !!input.dash,
      pause: !!input.pause,
    };
    if (pausePressed && (this.state === 'playing' || this.state === 'paused')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.pendingEvents.push({ name: 'paused', data: {} });
      } else {
        this.state = 'playing';
        this.pendingEvents.push({ name: 'resumed', data: {} });
      }
      return this.pendingEvents;
    }
    if (this.state !== 'playing') {
      return this.pendingEvents;
    }

    this.simSteps += 1;
    const tick = this.simSteps;

    // 2. Giảm các bộ đếm.
    this.updateCounters(tick);

    // 3. Di chuyển Mây.
    this.movePlayer(input, jumpPressed, dashPressed);
    this.checkFall();

    // 4. Nhặt đom đóm và bùa.
    if (this.player.deadUntilTick < 0 && this.player.flames > 0) {
      this.pickupMotes();
      this.pickupCharms();

    // 5. Tương tác với đèn.
      if (interactPressed) this.doInteract();
    }

    // 6. Cập nhật vùng an toàn (đẩy bóng đang ở trong ra mép).
    this.updateSafeZone();

    // 7. Tỏa Sáng.
    if (pulsePressed && this.player.deadUntilTick < 0 && this.player.flames > 0) this.doPulse();

    // 8. Di chuyển Bóng Mực và Gió Lạc.
    this.updateShades(tick);
    this.updateDrifters(tick);

    // 9. Chạm: Gió Lạc trước, rồi Bóng Mực theo id tăng dần.
    this.updateDrifterContacts();
    this.updateShadeContacts();

    // 10. Sinh theo lịch.
    if (this.state === 'playing') this.runSpawnSchedule(tick);

    // 11. Xét thắng/thua.
    this.checkGameOver();

    return this.pendingEvents;
  }

  /** Step 2: aggregate all drains before extinction and before player actions. */
  private updateFuel(): void {
    const draining = [...this.shades].filter((s) => s.state === 'drain').sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    for (const lamp of this.lanterns) {
      if (!lamp.lit) continue;
      const contributors = draining.filter((s) => s.targetLanternId === lamp.id &&
        lamp.fuelTicks < this.tuning.low_fuel_threshold * TICK_RATE && distXZ(s.pos, lamp.pos) <= RULES.drain_radius);
      lamp.fuelTicks = Math.max(0, lamp.fuelTicks - this.tuning.fuel_decay_per_s - contributors.length * this.tuning.drain_per_s);
      for (const shade of contributors) {
        shade.drainTicks += 1;
        if (shade.drainTicks % TICK_RATE === 0) {
          this.pendingEvents.push({ name: 'fuel_drain', data: { lantern_id: lamp.id, shade_id: shade.id, fuel: this.fuel(lamp) } });
        }
      }
      if (lamp.fuelTicks <= 0) {
        lamp.lit = false; lamp.deposited = 0;
        this.pendingEvents.push({ name: 'lantern_out', data: { lantern_id: lamp.id } });
      }
    }
  }

  private updateCounters(tick: number): void {
    this.updateFuel();
    // TTL đom đóm rơi.
    for (const m of this.motes) {
      if (m.ttlTicks > 0) {
        m.ttlTicks -= 1;
        if (m.ttlTicks === 0) m.active = false;
      }
    }
    // Retire inactive objects; ids remain monotonically increasing.
    this.motes = this.motes.filter((m) => m.active);
    for (const s of this.shades) {
      if (s.stateTicksLeft > 0) {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft === 0 && s.state !== 'chase' && s.state !== 'wander' && s.state !== 'drain') {
          s.state = 'wander';
          s.pushTicksLeft = 0;
        }
      }
    }
    for (const d of this.drifters) {
      if (d.state === 'flee') d.stateTicksLeft -= 1;
    }
    this.drifters = this.drifters.filter((d) => d.state !== 'flee' || d.stateTicksLeft > 0);
    // Bùa Gió hồi sinh.
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks -= 1;
        if (c.respawnTicks === 0) c.available = true;
      }
    }
    // Gió mạnh.
    if (this.wind.warnUntilTick > 0 && tick >= this.wind.warnUntilTick) {
      this.wind.warnUntilTick = -1;
    }
    if (this.wind.active && tick >= this.wind.untilTick) {
      this.wind.active = false;
    }
    if (this.windEnabled) {
      if (tick >= this.wind.nextTick - RULES.wind_warn_ticks && tick < this.wind.nextTick) {
        this.wind.warnUntilTick = this.wind.nextTick;
      }
      if (tick >= this.wind.nextTick) {
        this.wind.active = true;
        this.wind.dirDeg = this.rng.range(0, 360);
        this.wind.untilTick = tick + RULES.wind_duration_ticks;
        this.wind.nextTick = tick + RULES.wind_interval_ticks;
        this.wind.warnUntilTick = -1;
      }
    }
  }

  private movePlayer(input: FrameInput, jumpPressed: boolean, dashPressed: boolean): void {
    const p = this.player;

    // Chờ hồi sinh sau khi rơi khỏi đảo.
    if (p.deadUntilTick > 0) {
      if (this.simSteps >= p.deadUntilTick) {
        p.deadUntilTick = -1;
        p.pos = this.spawnPoint();
        p.vel = { x: 0, y: 0, z: 0 };
        p.grounded = true;
        p.launched = false;
        p.invulnUntilTick = this.simSteps + Math.round(this.tuning.invuln_s * TICK_RATE);
        return;
      } else {
        return;
      }
    }

    // Hướng di chuyển trong không gian camera.
    let mx = input.move[0];
    let mz = input.move[1];
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const theta = (input.cam_yaw_deg * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const dirX = mx * cos + mz * sin;
    const dirZ = -mx * sin + mz * cos;

    if (p.dashing && this.simSteps >= p.dashEndTick) {
      p.dashing = false;
      p.vel.y = p.dashSavedVy;
      if (p.launched) [p.vel.x, p.vel.z] = p.launchVelocity;
    }

    // Lướt.
    const charmActive = p.charmUntilTick > this.simSteps;
    if (dashPressed && !p.dashing && (charmActive || this.simSteps >= p.dashCdUntilTick)) {
      if (!(charmActive && p.dashing)) {
        p.dashing = true;
        p.dashSavedVy = p.vel.y;
        const ticks = charmActive
          ? RULES.charm_dash_ticks
          : Math.round(this.tuning.dash_duration_s * TICK_RATE);
        p.dashEndTick = this.simSteps + ticks;
        // Bùa Gió: Lướt không hồi chiêu.
        p.dashCdUntilTick = charmActive
          ? this.simSteps
          : this.simSteps + Math.round(this.tuning.dash_cooldown_s * TICK_RATE);
        // Hướng lướt: hướng đang di chuyển, nếu đứng yên thì hướng đang quay mặt.
        const norm = Math.hypot(dirX, dirZ) || 1;
        const hx = len > 1e-6 ? dirX / norm : p.facing[0];
        const hz = len > 1e-6 ? dirZ / norm : p.facing[1];
        p.vel.x = hx * this.tuning.dash_speed;
        p.vel.z = hz * this.tuning.dash_speed;
        p.facing = [hx, hz];
        this.pendingEvents.push({ name: 'dash', data: {} });
      }
    }

    // Quán tính: tăng tốc/dừng trong ≤ 0.1 s, cả khi có Bùa Gió.
    const speed = this.playerSpeed();
    if (!p.launched) {
      if (p.dashing) {
        // Giữ vận tốc lướt.
        if (len > 1e-6) {
          const norm = Math.hypot(dirX, dirZ);
          p.facing = [dirX / norm, dirZ / norm];
        }
      } else {
        const targetX = dirX * speed;
        const targetZ = dirZ * speed;
        const ddx = targetX - p.vel.x;
        const ddz = targetZ - p.vel.z;
        const maxDelta = RULES.accel * DT;
        const dl = Math.hypot(ddx, ddz);
        if (dl > maxDelta && dl > 1e-9) {
          p.vel.x += (ddx / dl) * maxDelta;
          p.vel.z += (ddz / dl) * maxDelta;
        } else {
          p.vel.x = targetX;
          p.vel.z = targetZ;
        }
        if (len > 1e-6) {
          const norm = Math.hypot(dirX, dirZ);
          p.facing = [dirX / norm, dirZ / norm];
        }
      }
    }

    // Nhảy (chỉ khi chạm đất).
    if (jumpPressed && p.grounded && !p.launched && !p.dashing) {
      p.vel.y = RULES.jumpVelocity;
      p.grounded = false;
    }

    // Bục nhảy.
    if (!p.launched && p.grounded) {
      for (const s of this.map.springs) {
        if (distXZ(p.pos, s.pos) <= s.radius && Math.abs(p.pos.y - s.pos.y) <= 0.5) {
          p.vel.y = s.vy;
          p.vel.x = s.dir[0] * s.horizontal;
          p.vel.z = s.dir[1] * s.horizontal;
          p.launchVelocity = [p.vel.x, p.vel.z];
          p.grounded = false;
          p.launched = true;
          p.dashing = false;
          break;
        }
      }
    }

    // Gió mạnh đẩy người chơi.
    // Tích phân vị trí.
    const old = { ...p.pos };
    const w = this.wind.dirDeg * Math.PI / 180;
    const wx = this.wind.active ? Math.cos(w) * RULES.wind_force : 0;
    const wz = this.wind.active ? Math.sin(w) * RULES.wind_force : 0;
    p.pos.x += (p.vel.x + wx) * DT;
    p.pos.z += (p.vel.z + wz) * DT;

    // A ramp may raise a grounded foot; vertical ledges may not.
    let floor = supportY(this.map, p.pos.x, p.pos.z, old.y + 0.15);
    const top = supportY(this.map, p.pos.x, p.pos.z, Infinity);
    const oldTop = supportY(this.map, old.x, old.z, Infinity);
    const crossesWall = top !== null && top > old.y + 0.15 &&
      (oldTop === null || top > oldTop + 0.15);
    const blocked = this.map.blockers.some((b) => old.y >= b.y - 0.1 && old.y < b.y + b.height &&
      Math.hypot(p.pos.x - b.x, p.pos.z - b.z) < b.radius);
    if (crossesWall || blocked) {
      p.pos.x = old.x;
      p.pos.z = old.z;
      floor = supportY(this.map, old.x, old.z, old.y + 0.15);
    }
    if (p.grounded && floor !== null && Math.abs(floor - old.y) <= 0.15) p.pos.y = floor;

    // Trọng lực + mặt sàn.
    if (!p.dashing && (!p.grounded || p.vel.y > 0)) {
      p.vel.y -= RULES.gravity * DT;
    }
    if (!p.dashing) p.pos.y += p.vel.y * DT;

    const ground = supportY(this.map, p.pos.x, p.pos.z, Math.max(old.y, p.pos.y) + 0.15);
    if (ground !== null && p.pos.y <= ground + 0.02 && p.vel.y <= 0) {
      p.pos.y = ground;
      p.vel.y = 0;
      p.grounded = true;
      p.launched = false;
    } else {
      p.grounded = false;
    }
  }

  private checkFall(): void {
    const p = this.player;
    if (!this.tuning.fall_enabled) return;
    if (p.deadUntilTick > 0) return;
    if (p.pos.y >= RULES.fall_y) return;

    // Rơi khỏi đảo: xảy ra đúng 1 lần, bỏ qua bất tử.
    p.flames -= 1;
    const lost = p.carried;
    p.carried = 0;
    p.pos.y = RULES.fall_y;
    p.vel = { x: 0, y: 0, z: 0 };
    p.dashing = false;
    p.launched = false;
    p.grounded = false;
    p.deadUntilTick = this.simSteps + RULES.fall_respawn_delay_ticks;
    this.pendingEvents.push({
      name: 'player_hit',
      data: { by: 'fall', flames: p.flames, dropped: 0, lost },
    });
    if (p.flames <= 0) {
      this.finish('lost', 'no_flames');
    }
  }

  private pickupMotes(): void {
    const p = this.player;
    if (p.carried >= this.capacity) return;
    for (const m of this.motes) {
      if (!m.active) continue;
      if (m.ttlTicks === 0) {
        m.active = false;
        continue;
      }
      if (distXZ(p.pos, m.pos) > this.tuning.pickup_radius) continue;
      // Chênh cao giữa chân Mây và mặt đất nơi đặt đom đóm.
      if (Math.abs(p.pos.y - m.pos.y) > RULES.pickupHeightDiff) continue;
      m.active = false;
      p.carried += 1;
      this.pendingEvents.push({ name: 'mote_picked', data: { carried: p.carried } });
      if (p.carried >= this.capacity) break;
    }
  }

  private pickupCharms(): void {
    const p = this.player;
    for (const c of this.charms) {
      if (!c.available) continue;
      if (distXZ(p.pos, c.pos) > this.tuning.pickup_radius) continue;
      if (Math.abs(p.pos.y - c.pos.y) > RULES.pickupHeightDiff) continue;
      c.available = false;
      c.respawnTicks = RULES.charm_respawn_ticks;
      p.charmUntilTick = this.simSteps + RULES.charm_duration_ticks;
      p.dashCdUntilTick = this.simSteps;
      this.pendingEvents.push({
        name: 'charm_picked',
        data: { charm_id: c.id, charm_ticks: RULES.charm_duration_ticks },
      });
    }
  }

  private doInteract(): void {
    const p = this.player;
    if (p.carried <= 0) return;
    const target = this.nearestReceivableLantern(p.pos);
    if (!target) return;
    if (distXZ(p.pos, target.pos) > this.tuning.interact_radius) return;

    if (target.lit) {
      const max = this.tuning.fuel_max * TICK_RATE;
      const amount = Math.min(p.carried, Math.ceil((max - target.fuelTicks) / (this.tuning.fuel_per_mote * TICK_RATE)));
      if (amount <= 0) return;
      p.carried -= amount;
      target.fuelTicks = Math.min(max, target.fuelTicks + amount * this.tuning.fuel_per_mote * TICK_RATE);
      this.score += amount * this.tuning.score.per_mote;
      this.pendingEvents.push({ name: 'refuel', data: { lantern_id: target.id, amount, fuel: this.fuel(target) } });
      return;
    }

    const amount = Math.min(p.carried, this.lanternCost(target) - target.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    target.deposited += amount;
    this.score += amount * this.tuning.score.per_mote;
    this.pendingEvents.push({
      name: 'deposit',
      data: { lantern_id: target.id, amount, deposited: target.deposited },
    });
    if (target.deposited >= this.lanternCost(target) && !target.lit) {
      const relight = target.everLit;
      target.lit = true;
      target.fuelTicks = this.tuning.fuel_max * TICK_RATE;
      target.everLit = true;
      if (relight) target.relitCount += 1;
      p.successfulLights += 1;
      this.score += relight ? this.tuning.score.per_relight : this.tuning.score.per_lantern;
      this.pendingEvents.push({ name: 'lantern_lit', data: { lantern_id: target.id, relight } });
    }
  }

  private updateSafeZone(): void {
    for (const s of this.shades) {
      if (s.state !== 'chase' && s.state !== 'wander' && s.state !== 'drain') continue;
      if (!this.inSafeZone(s.pos)) continue;
      // Bóng đang ở trong lúc đèn vừa thắp bị đẩy ra mép trong tối đa 30 tick
      // và không gây sát thương trong lúc đó.
      s.state = 'recoil';
      s.stateTicksLeft = RULES.safe_push_max_ticks;
      s.pushTicksLeft = 0;
      s.drainTicks = 0;
      s.pos = this.pushOutOfSafeZone(s.pos);
    }
  }

  private doPulse(): void {
    const p = this.player;
    if (this.simSteps < p.pulseCdUntilTick) return;
    if (p.carried < this.tuning.pulse_cost) return;

    p.carried -= this.tuning.pulse_cost;
    p.pulseCdUntilTick = this.simSteps + Math.round(this.tuning.pulse_cooldown_s * TICK_RATE);

    // Tâm hiệu ứng = chân Mây + 0.8 m.
    const centre = { x: p.pos.x, y: p.pos.y + RULES.pulse_center_height, z: p.pos.z };
    const stunned: string[] = [];
    for (const s of this.shades) {
      if (s.state === 'spawning') continue;
      if (dist3(centre, s.pos) > this.tuning.pulse_radius) continue;
      const draining = s.state === 'drain';
      s.state = 'stunned';
      s.drainTicks = 0;
      s.stateTicksLeft = Math.round(this.tuning.pulse_stun_s * TICK_RATE);
      s.stunUntilTick = this.simSteps + s.stateTicksLeft;
      const d = distXZ(p.pos, s.pos);
      s.pushDir = d > 1e-9 ? [(s.pos.x - p.pos.x) / d, (s.pos.z - p.pos.z) / d] : [1, 0];
      s.pushTicksLeft = RULES.pulse_push_ticks;
      s.pushPerTick = this.tuning.pulse_push_m / RULES.pulse_push_ticks;
      stunned.push(s.id);
      this.score += draining ? this.tuning.score.per_drain_stun : this.tuning.score.per_stun;
    }
    // Gió Lạc đang chase bị trúng -> flee không cướp.
    for (const d of this.drifters) {
      if (dist3(centre, d.pos) > this.tuning.pulse_radius) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.stateTicksLeft = RULES.drifter_flee_ticks;
        d.stolen = 0;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) {
          this.motes.push({
            id: `M${this.nextMoteId++}`, active: true, kind: 'dropped',
            pos: { x: d.pos.x, y: supportY(this.map, d.pos.x, d.pos.z, d.pos.y) ?? p.pos.y, z: d.pos.z },
            ttlTicks: RULES.dropped_mote_ttl_ticks,
          });
        }
        d.stolen = 0;
        d.stateTicksLeft = RULES.drifter_drop_ttl_ticks;
        this.pendingEvents.push({ name: 'drifter_drop', data: { drifter_id: d.id, amount } });
      }
    }
    this.pendingEvents.push({ name: 'pulse', data: { stunned_ids: stunned } });
  }

  private updateShades(tick: number): void {
    const p = this.player;
    const sorted = [...this.shades].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const s of sorted) {
      switch (s.state) {
        case 'spawning':
          break;
        case 'wander': {
          s.drainTicks = 0;
          const d = distXZ(p.pos, s.pos);
          if (d <= RULES.shadeDetectRadius) {
            s.state = 'chase';
          } else {
            const weak = this.nearestLantern(s.pos, (l) => l.lit && l.fuelTicks < this.tuning.low_fuel_threshold * TICK_RATE);
            const target = weak ?? this.nearestUnlitLantern(s.pos);
            s.targetLanternId = target?.id;
            if (target) {
              const distance = distXZ(s.pos, target.pos);
              if (weak && distance <= RULES.drain_radius) { s.state = 'drain'; break; }
              const delta = Math.min(this.map.shadeSpeed * DT, distance);
              if (distance > 1e-9) this.moveShade(s, { x: s.pos.x + (target.pos.x - s.pos.x) / distance * delta,
                y: s.pos.y, z: s.pos.z + (target.pos.z - s.pos.z) / distance * delta });
              if (weak && distXZ(s.pos, weak.pos) <= RULES.drain_radius) s.state = 'drain';
              break;
            }
            // Đi lang, đổi hướng thỉnh thoảng.
            if (tick % RULES.shade_wander_turn_ticks === 0) s.wanderDir = this.randomUnit();
            const step = this.map.shadeSpeed * RULES.shade_wander_speed_ratio * DT;
            const next = {
              x: s.pos.x + s.wanderDir[0] * step,
              y: s.pos.y,
              z: s.pos.z + s.wanderDir[1] * step,
            };
            if (!this.moveShade(s, next)) {
              s.wanderDir = this.randomUnit();
            }
          }
          break;
        }
        case 'drain': {
          const lamp = this.lanterns.find((l) => l.id === s.targetLanternId);
          if (!lamp?.lit || lamp.fuelTicks >= this.tuning.low_fuel_threshold * TICK_RATE || distXZ(s.pos, lamp.pos) > RULES.drain_radius) {
            s.state = 'wander'; s.drainTicks = 0; s.targetLanternId = undefined;
          } else if (distXZ(s.pos, p.pos) <= RULES.drain_alert_radius) {
            s.state = 'chase'; s.drainTicks = 0;
          }
          break;
        }
        case 'chase': {
          const d = distXZ(p.pos, s.pos);
          if (d > RULES.shadeLoseRadius) {
            s.state = 'wander';
            break;
          }
          const step = this.map.shadeSpeed * DT;
          const nx = d > 1e-6 ? (p.pos.x - s.pos.x) / d : 1;
          const nz = d > 1e-6 ? (p.pos.z - s.pos.z) / d : 0;
          const next = { x: s.pos.x + nx * step, y: s.pos.y, z: s.pos.z + nz * step };
          this.moveShade(s, next);
          break;
        }
        case 'recoil': {
          this.applyShadePush(s);
          break;
        }
        case 'stunned':
          this.applyShadePush(s);
          break;
        default:
          break;
      }
    }
  }

  private applyShadePush(s: Shade): void {
    if (s.pushTicksLeft <= 0) return;
    const moved = this.moveShade(s, {
      x: s.pos.x + s.pushDir[0] * s.pushPerTick,
      y: s.pos.y,
      z: s.pos.z + s.pushDir[1] * s.pushPerTick,
    });
    s.pushTicksLeft = moved ? s.pushTicksLeft - 1 : 0;
  }

  private moveShade(s: Shade, next: Vec3): boolean {
    const floor = supportY(this.map, next.x, next.z, s.pos.y + 0.15);
    const oldFloor = supportY(this.map, s.pos.x, s.pos.z, s.pos.y + 0.15);
    if (floor === null || (oldFloor !== null && Math.abs(floor - oldFloor) > 0.2)) return false;
    if (this.map.blockers.some((b) => s.pos.y >= b.y && s.pos.y < b.y + b.height &&
      Math.hypot(next.x - b.x, next.z - b.z) < b.radius)) return false;
    // Clamp to a lit lantern's boundary rather than stepping inside it.
    const corrected = this.pushOutOfSafeZone(next);
    s.pos.x = corrected.x;
    s.pos.z = corrected.z;
    if (oldFloor !== null && Math.abs(s.pos.y - oldFloor - 1) <= 0.2) s.pos.y = floor + 1;
    return corrected === next;
  }

  private updateDrifters(tick: number): void {
    const p = this.player;
    for (const d of this.drifters) {
      if (d.state === 'idle') {
        if (p.deadUntilTick < 0 && p.carried >= RULES.drifter_detect_carried && distXZ(p.pos, d.pos) <= RULES.drifter_detect_radius) {
          d.state = 'chase';
        } else {
          // Lượn chậm.
          d.pos.y += Math.sin(tick / 30) * 0.01;
          d.pos.x += Math.cos(tick / 90) * RULES.drifter_idle_speed * DT;
          d.pos.z += Math.sin(tick / 90) * RULES.drifter_idle_speed * DT;
        }
      } else if (d.state === 'chase') {
        if (p.carried < RULES.drifter_detect_carried || distXZ(p.pos, d.pos) > RULES.drifter_detect_radius || p.deadUntilTick > 0) {
          d.state = 'idle';
          continue;
        }
        const dd = distXZ(p.pos, d.pos);
        if (dd > 1e-6) {
          const nx = (p.pos.x - d.pos.x) / dd;
          const nz = (p.pos.z - d.pos.z) / dd;
          d.pos.x += nx * RULES.drifter_speed * DT;
          d.pos.z += nz * RULES.drifter_speed * DT;
        }
      } else {
        // flee: bay ra xa Mây 7 m/s rồi biến mất cùng số đã cướp.
        const dd = distXZ(p.pos, d.pos);
        if (dd > 1e-6) {
          const nx = (d.pos.x - p.pos.x) / dd;
          const nz = (d.pos.z - p.pos.z) / dd;
          d.pos.x += nx * RULES.drifter_speed * DT;
          d.pos.z += nz * RULES.drifter_speed * DT;
        }
        else d.pos.x += RULES.drifter_speed * DT;
      }
    }
  }

  private updateDrifterContacts(): void {
    const p = this.player;
    if (p.deadUntilTick > 0 || p.flames <= 0) return;
    for (const d of this.drifters) {
      if (d.state !== 'chase') continue;
      if (distXZ(p.pos, d.pos) > RULES.drifter_hit_radius) continue;
      const amount = Math.min(RULES.drifter_steal_max, p.carried);
      if (amount <= 0) {
        // Không có gì để cướp -> vẫn flee.
        d.state = 'flee';
        d.stateTicksLeft = RULES.drifter_flee_ticks;
        continue;
      }
      p.carried -= amount;
      d.stolen += amount;
      d.state = 'flee';
      d.stateTicksLeft = RULES.drifter_flee_ticks;
      this.pendingEvents.push({
        name: 'drifter_steal',
        data: { drifter_id: d.id, amount, carried: p.carried },
      });
    }
  }

  private updateShadeContacts(): void {
    const p = this.player;
    if (p.deadUntilTick > 0) return;
    if (this.simSteps <= p.invulnUntilTick) return;
    const sorted = [...this.shades].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const s of sorted) {
      if (s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') continue;
      if (distXZ(p.pos, s.pos) > this.tuning.shade_hit_radius) continue;
      if (Math.abs(p.pos.y - s.pos.y) > RULES.hitHeightDiff) continue;
      this.hitPlayer(s);
      break; // tối đa 1 lần mất Ngọn Lửa mỗi tick
    }
  }

  private hitPlayer(shade: Shade): void {
    const p = this.player;
    p.flames -= 1;
    p.invulnUntilTick = this.simSteps + Math.round(this.tuning.invuln_s * TICK_RATE);

    // Bóng gây hit lùi 2 m trong 60 tick (recoil).
    const d = distXZ(p.pos, shade.pos);
    shade.pushDir = d > 1e-6 ? [(shade.pos.x - p.pos.x) / d, (shade.pos.z - p.pos.z) / d] : [1, 0];
    shade.state = 'recoil';
    shade.stateTicksLeft = RULES.hit_recoil_ticks + 1;
    shade.pushTicksLeft = RULES.hit_recoil_ticks;
    shade.pushPerTick = RULES.hit_recoil_m / RULES.hit_recoil_ticks;

    // Rơi floor(đang mang / 2) đom đóm ra vành 1.5–2.5 m quanh Mây.
    const dropped = Math.floor(p.carried * this.tuning.hit_drop_ratio);
    for (let i = 0; i < dropped; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(RULES.drop_ring_min, RULES.drop_ring_max);
      this.motes.push({
        id: `M${this.nextMoteId++}`,
        pos: {
          x: round3(p.pos.x + Math.cos(a) * r),
          y: p.pos.y,
          z: round3(p.pos.z + Math.sin(a) * r),
        },
        active: true,
        kind: 'dropped',
        ttlTicks: RULES.dropped_mote_ttl_ticks,
      });
    }
    p.carried -= dropped;

    this.pendingEvents.push({
      name: 'player_hit',
      data: { by: 'shade', flames: p.flames, dropped },
    });
  }

  private runSpawnSchedule(tick: number): void {
    // Sinh thêm đom đóm mỗi 240 tick nếu dưới trần 30.
    if (tick >= this.nextMoteSpawnTick) {
      this.nextMoteSpawnTick = tick + RULES.mote_spawn_interval_ticks;
      const activeCount = this.motes.filter((m) => m.active).length;
      if (this.randomMotes && activeCount < RULES.max_motes) {
        this.spawnMoteAtMapPoint();
      }
    }

    // Bóng Mực: 2 con tại tick 300, sau đó mỗi `interval` tick.
    // Mốc sinh: 300 (lần đầu, 2 con), 300+interval (1 con), 300+2*interval, ...
    const interval = this.map.shadeIntervalTicks;
    const firstTick = RULES.first_shade_tick;
    let due = 0;
    if (tick === firstTick) due = RULES.initial_shades;
    else if (tick > firstTick && (tick - firstTick) % interval === 0) due = 1;
    for (let i = 0; i < due; i++) {
      if (!this.randomShades) break;
      if (this.shadeSpawnedCount >= this.map.maxShades) break;
      if (this.spawnShade()) this.shadeSpawnedCount += 1;
    }

    // Gió Lạc: tick 1200, 2400, ...
    if (this.randomDrifters && tick % this.map.drifterIntervalTicks === 0) {
      if (this.drifters.length < RULES.max_drifters) this.spawnDrifter();
    }

  }

  private spawnShade(): boolean {
    const pts = this.map.shadePoints;
    if (pts.length === 0) return false;
    let chosen: Vec3 | undefined;
    for (let attempt = 0; attempt < pts.length; attempt++) {
      const p = pts[(this.shadeSpawnedCount + attempt) % pts.length];
      if (distXZ(this.player.pos, p) >= RULES.shade_spawn_distance && !this.inSafeZone(p) &&
        !this.shades.some((s) => distXZ(s.pos, p) < 1)) {
        chosen = p;
        break;
      }
    }
    if (!chosen) return false;
    const id = `S${this.nextShadeId++}`;
    this.shades.push({
      id,
      pos: { x: chosen.x, y: chosen.y + 1, z: chosen.z },
      state: 'spawning',
      stateTicksLeft: RULES.shade_spawn_ticks,
      stunUntilTick: -1,
      wanderDir: this.randomUnit(),
      pushDir: [1, 0], pushTicksLeft: 0, pushPerTick: 0,
      drainTicks: 0,
    });
    this.pendingEvents.push({ name: 'shade_spawned', data: { id } });
    return true;
  }

  private spawnDrifter(): void {
    const id = `D${this.nextDrifterId++}`;
    // Điểm sương ngẫu nhiên trên bản đồ.
    const pts = this.map.motePoints;
    const base = pts.length > 0 ? pts[this.rng.int(pts.length)] : { x: 0, y: 3, z: 0 };
    this.drifters.push({
      id,
      pos: {
        x: base.x + this.rng.range(-3, 3),
        y: base.y + 3,
        z: base.z + this.rng.range(-3, 3),
      },
      state: 'idle',
      stolen: 0,
      stateTicksLeft: 0,
    });
  }

  private checkGameOver(): void {
    if (this.state !== 'playing') return;
    if (this.player.flames <= 0) {
      this.finish('lost', 'no_flames');
      return;
    }
    if (this.timeLeft() <= 0) {
      const won = this.lanterns.length > 0 && this.litCount() >= this.requiredLitCount;
      this.finish(won ? 'won' : 'lost', won ? 'dawn_survived' : 'dawn');
    }
  }

  private finish(result: 'won' | 'lost', reason: string): void {
    this.state = result;
    if (result === 'won') {
      for (const lamp of this.lanterns) {
        if (lamp.lit) this.score += this.tuning.score.per_lit_at_dawn + Math.floor(lamp.fuelTicks / TICK_RATE);
      }
      this.score += Math.max(0, this.player.flames) * this.tuning.score.per_flame_left;
    }
    this.pendingEvents.push({ name: 'game_over', data: { result, reason } });
  }

  // -------------------------------------------------------------- output

  timeLeft(): number {
    return Math.max(0, this.initialTimeLeft - this.simSteps / TICK_RATE);
  }

  /** Trạng thái Bóng Mực dùng cho snapshot. */
  snapshot(): Snapshot {
    return {
      type: 'snapshot',
      tick: this.steps,
      sim_tick: this.simSteps,
      state: this.state,
      time_left_s: round3(this.timeLeft()),
      score: this.score,
      night: this.night,
      player: {
        pos: [round3(this.player.pos.x), round3(this.player.pos.y), round3(this.player.pos.z)],
        vel: [round3(this.player.vel.x), round3(this.player.vel.y), round3(this.player.vel.z)],
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.capacity,
        invuln: round3(Math.max(0, (this.player.invulnUntilTick - this.simSteps) / TICK_RATE)),
        dash_cd_s: round3(Math.max(0, (this.player.dashCdUntilTick - this.simSteps) / TICK_RATE)),
        pulse_cd_s: round3(Math.max(0, (this.player.pulseCdUntilTick - this.simSteps) / TICK_RATE)),
        charm_s: round3(Math.max(0, (this.player.charmUntilTick - this.simSteps) / TICK_RATE)),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos.x), round3(l.pos.y), round3(l.pos.z)] as [number, number, number],
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? this.fuel(l) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.pos.x), round3(s.pos.y), round3(s.pos.z)] as [number, number, number],
        state: s.state,
      })),
      motes_active: this.motes.filter((m) => m.active).length,
      motes: this.motes
        .filter((m) => m.active)
        .map((m) => ({
          id: m.id,
          pos: [round3(m.pos.x), round3(m.pos.y), round3(m.pos.z)] as [number, number, number],
          kind: m.kind,
          ttl_s: m.ttlTicks < 0 ? -1 : round3(m.ttlTicks / TICK_RATE),
        })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: [round3(d.pos.x), round3(d.pos.y), round3(d.pos.z)] as [number, number, number],
        state: d.state,
        stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICK_RATE),
      })),
      wind: { active: this.wind.active, dir_deg: round3(this.wind.dirDeg) },
    };
  }
}
