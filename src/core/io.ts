/**
 * Parse & validate scenario / inputs cho headless runner (contract v1.2).
 * Mọi lỗi format đều ném `InvalidInputError` -> exit code 2.
 */
import type { FrameInput } from './types';
import { TUNING } from './config';

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export interface ScenarioLantern {
  id: string;
  pos: [number, number, number];
  deposited?: number;
  lit?: boolean;
  fuel?: number;
  ever_lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: [number, number, number];
  state?: 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
  state_ticks_left?: number;
  target_lantern_id?: string;
}

export interface ScenarioDrifter {
  id?: string;
  pos: [number, number, number];
  state?: 'idle' | 'chase' | 'flee';
  stolen?: number;
  state_ticks_left?: number;
}

export interface ScenarioCharm {
  id?: string;
  pos: [number, number, number];
  available?: boolean;
  respawn_ticks?: number;
}

export interface Scenario {
  night?: number;
  seed?: number;
  time_left_s?: number;
  player?: {
    pos?: [number, number, number];
    flames?: number;
    carried?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
    successful_lights?: number;
  };
  lanterns?: ScenarioLantern[];
  motes?: Array<[number, number, number]>;
  shades?: ScenarioShade[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
}

export interface InputFrame {
  /** Tick mà frame này bắt đầu có hiệu lực (dùng cho định dạng {frames:[...]}). */
  tick?: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

/** Định dạng file inputs: mảng trực tiếp hoặc object { frames: [...] }. */
export interface InputFile {
  frames: InputFrame[];
}

function asVec3(v: unknown, field: string): [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3) {
    throw new InvalidInputError(`${field} phải là mảng 3 số [x,y,z]`);
  }
  const out = v.map((n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new InvalidInputError(`${field} chỉ chứa số hữu hạn`);
    }
    return n;
  });
  return out as [number, number, number];
}

function asBool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new InvalidInputError(`${field} phải là boolean`);
  return v;
}

function asNumber(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new InvalidInputError(`${field} phải là số hữu hạn`);
  }
  return v;
}

function asInteger(v: unknown, field: string, min = 0): number {
  const n = asNumber(v, field);
  if (!Number.isSafeInteger(n) || n < min) throw new InvalidInputError(`${field} phải là số nguyên >= ${min}`);
  return n;
}

function asObject(v: unknown, field: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new InvalidInputError(`${field} phải là object`);
  return v as Record<string, unknown>;
}

function asId(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new InvalidInputError(`${field} phải là chuỗi không rỗng`);
  return v;
}

const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee'];

export function parseScenario(raw: unknown): Scenario {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InvalidInputError('scenario phải là object JSON');
  }
  const o = raw as Record<string, unknown>;
  const sc: Scenario = {};

  if (o.night !== undefined) {
    const n = asInteger(o.night, 'scenario.night', 1);
    if (n < 1 || n > 3) throw new InvalidInputError('scenario.night phải là 1, 2 hoặc 3');
    sc.night = n;
  }
  if (o.seed !== undefined) sc.seed = asInteger(o.seed, 'scenario.seed', Number.MIN_SAFE_INTEGER);
  if (o.time_left_s !== undefined) {
    sc.time_left_s = asNumber(o.time_left_s, 'scenario.time_left_s');
    if (sc.time_left_s < 0) throw new InvalidInputError('scenario.time_left_s phải >= 0');
  }

  if (o.player !== undefined) {
    const p = asObject(o.player, 'scenario.player');
    if (p === null || typeof p !== 'object') {
      throw new InvalidInputError('scenario.player phải là object');
    }
    const pl: NonNullable<Scenario['player']> = {};
    if (p.pos !== undefined) pl.pos = asVec3(p.pos, 'scenario.player.pos');
    if (p.flames !== undefined) pl.flames = asInteger(p.flames, 'scenario.player.flames');
    if (p.carried !== undefined) pl.carried = asInteger(p.carried, 'scenario.player.carried');
    if (p.invuln_ticks !== undefined) pl.invuln_ticks = asInteger(p.invuln_ticks, 'scenario.player.invuln_ticks');
    if (p.dash_cd_ticks !== undefined) pl.dash_cd_ticks = asInteger(p.dash_cd_ticks, 'scenario.player.dash_cd_ticks');
    if (p.pulse_cd_ticks !== undefined) pl.pulse_cd_ticks = asInteger(p.pulse_cd_ticks, 'scenario.player.pulse_cd_ticks');
    if (p.charm_ticks !== undefined) pl.charm_ticks = asInteger(p.charm_ticks, 'scenario.player.charm_ticks');
    if (p.successful_lights !== undefined) pl.successful_lights = asInteger(p.successful_lights, 'scenario.player.successful_lights');
    sc.player = pl;
  }

  if (o.lanterns !== undefined) {
    if (!Array.isArray(o.lanterns)) throw new InvalidInputError('scenario.lanterns phải là mảng');
    sc.lanterns = o.lanterns.map((raw2, i) => {
      const l = asObject(raw2, `scenario.lanterns[${i}]`);
      if (!l || typeof l !== 'object') throw new InvalidInputError(`scenario.lanterns[${i}] phải là object`);
      const out: ScenarioLantern = { id: asId(l.id ?? `L${i + 1}`, `scenario.lanterns[${i}].id`), pos: asVec3(l.pos, `scenario.lanterns[${i}].pos`) };
      if (l.deposited !== undefined) out.deposited = asInteger(l.deposited, `scenario.lanterns[${i}].deposited`);
      if (l.lit !== undefined) out.lit = asBool(l.lit, `scenario.lanterns[${i}].lit`);
      if (l.ever_lit !== undefined) out.ever_lit = asBool(l.ever_lit, `scenario.lanterns[${i}].ever_lit`);
      if (l.fuel !== undefined) {
        out.fuel = asNumber(l.fuel, `scenario.lanterns[${i}].fuel`);
        if (out.fuel < 0 || out.fuel > TUNING.fuel_max) throw new InvalidInputError(`scenario.lanterns[${i}].fuel phải trong 0..${TUNING.fuel_max}`);
      }
      return out;
    });
  }

  if (o.motes !== undefined) {
    if (!Array.isArray(o.motes)) throw new InvalidInputError('scenario.motes phải là mảng');
    sc.motes = o.motes.map((m, i) => asVec3(m, `scenario.motes[${i}]`));
  }

  if (o.shades !== undefined) {
    if (!Array.isArray(o.shades)) throw new InvalidInputError('scenario.shades phải là mảng');
    sc.shades = o.shades.map((s, i) => {
      const v = asObject(s, `scenario.shades[${i}]`);
      if (!v || typeof v !== 'object') throw new InvalidInputError(`scenario.shades[${i}] phải là object`);
      const out: ScenarioShade = { pos: asVec3(v.pos, `scenario.shades[${i}].pos`) };
      if (v.id !== undefined) out.id = asId(v.id, `scenario.shades[${i}].id`);
      if (v.target_lantern_id !== undefined) out.target_lantern_id = asId(v.target_lantern_id, `scenario.shades[${i}].target_lantern_id`);
      if (v.state !== undefined) {
        if (typeof v.state !== 'string' || !SHADE_STATES.includes(v.state)) {
          throw new InvalidInputError(
            `scenario.shades[${i}].state phải là một trong: ${SHADE_STATES.join(', ')}`,
          );
        }
        out.state = v.state as ScenarioShade['state'];
      }
      if (v.state_ticks_left !== undefined) {
        out.state_ticks_left = asInteger(v.state_ticks_left, `scenario.shades[${i}].state_ticks_left`);
      }
      return out;
    });
  }

  if (o.drifters !== undefined) {
    if (!Array.isArray(o.drifters)) throw new InvalidInputError('scenario.drifters phải là mảng');
    sc.drifters = o.drifters.map((d, i) => {
      const v = asObject(d, `scenario.drifters[${i}]`);
      if (!v || typeof v !== 'object') throw new InvalidInputError(`scenario.drifters[${i}] phải là object`);
      const out: ScenarioDrifter = { pos: asVec3(v.pos, `scenario.drifters[${i}].pos`) };
      if (v.id !== undefined) out.id = asId(v.id, `scenario.drifters[${i}].id`);
      if (v.state !== undefined) {
        if (typeof v.state !== 'string' || !DRIFTER_STATES.includes(v.state)) {
          throw new InvalidInputError(
            `scenario.drifters[${i}].state phải là một trong: ${DRIFTER_STATES.join(', ')}`,
          );
        }
        out.state = v.state as ScenarioDrifter['state'];
      }
      if (v.stolen !== undefined) out.stolen = asInteger(v.stolen, `scenario.drifters[${i}].stolen`);
      if (v.state_ticks_left !== undefined) {
        out.state_ticks_left = asInteger(v.state_ticks_left, `scenario.drifters[${i}].state_ticks_left`);
      }
      return out;
    });
  }

  if (o.charms !== undefined) {
    if (!Array.isArray(o.charms)) throw new InvalidInputError('scenario.charms phải là mảng');
    sc.charms = o.charms.map((c, i) => {
      const v = asObject(c, `scenario.charms[${i}]`);
      if (!v || typeof v !== 'object') throw new InvalidInputError(`scenario.charms[${i}] phải là object`);
      const out: ScenarioCharm = { pos: asVec3(v.pos, `scenario.charms[${i}].pos`) };
      if (v.id !== undefined) out.id = asId(v.id, `scenario.charms[${i}].id`);
      if (v.available !== undefined) out.available = asBool(v.available, `scenario.charms[${i}].available`);
      if (v.respawn_ticks !== undefined) {
        out.respawn_ticks = asInteger(v.respawn_ticks, `scenario.charms[${i}].respawn_ticks`);
      }
      return out;
    });
  }

  if (o.random_motes !== undefined) sc.random_motes = asBool(o.random_motes, 'scenario.random_motes');
  if (o.random_shades !== undefined) sc.random_shades = asBool(o.random_shades, 'scenario.random_shades');
  if (o.random_drifters !== undefined) sc.random_drifters = asBool(o.random_drifters, 'scenario.random_drifters');
  if (o.wind_enabled !== undefined) sc.wind_enabled = asBool(o.wind_enabled, 'scenario.wind_enabled');

  for (const key of ['lanterns', 'shades', 'drifters', 'charms'] as const) {
    const ids = (sc[key] ?? []).map((v, i) => v.id ?? `${key[0].toUpperCase()}${i + 1}`);
    if (new Set(ids).size !== ids.length) throw new InvalidInputError(`scenario.${key} có id trùng`);
  }
  return sc;
}

export function parseInputs(raw: unknown): InputFile {
  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).frames)) {
    list = (raw as Record<string, unknown>).frames as unknown[];
  } else {
    throw new InvalidInputError('inputs phải là mảng hoặc object { frames: [...] }');
  }
  const frames = list.map((raw2, i) => {
    const v = raw2 as Record<string, unknown>;
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      throw new InvalidInputError(`inputs[${i}] phải là object`);
    }
    const out: InputFrame = {};
    if (v.tick !== undefined) out.tick = asInteger(v.tick, `inputs[${i}].tick`);
    if (v.move !== undefined) {
      if (!Array.isArray(v.move) || v.move.length !== 2) {
        throw new InvalidInputError(`inputs[${i}].move phải là [x,z]`);
      }
      out.move = [
        asNumber(v.move[0], `inputs[${i}].move[0]`),
        asNumber(v.move[1], `inputs[${i}].move[1]`),
      ];
    }
    if (v.cam_yaw_deg !== undefined) out.cam_yaw_deg = asNumber(v.cam_yaw_deg, `inputs[${i}].cam_yaw_deg`);
    if (v.jump !== undefined) out.jump = asBool(v.jump, `inputs[${i}].jump`);
    if (v.interact !== undefined) out.interact = asBool(v.interact, `inputs[${i}].interact`);
    if (v.pulse !== undefined) out.pulse = asBool(v.pulse, `inputs[${i}].pulse`);
    if (v.dash !== undefined) out.dash = asBool(v.dash, `inputs[${i}].dash`);
    if (v.pause !== undefined) out.pause = asBool(v.pause, `inputs[${i}].pause`);
    return out;
  });
  // Tick phải tăng nghiêm ngặt.
  const timed = frames.filter((f) => f.tick !== undefined).length;
  if (timed !== 0 && timed !== frames.length) throw new InvalidInputError('không trộn frame có tick và không tick');
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1].tick;
    const cur = frames[i].tick;
    if (prev !== undefined && cur !== undefined && cur <= prev) {
      throw new InvalidInputError(`inputs[${i}].tick phải tăng nghiêm ngặt so với inputs[${i - 1}].tick`);
    }
  }
  return { frames };
}

export function toFrame(input: InputFrame): FrameInput {
  return {
    move: input.move ?? [0, 0],
    cam_yaw_deg: input.cam_yaw_deg ?? 0,
    jump: input.jump ?? false,
    interact: input.interact ?? false,
    pulse: input.pulse ?? false,
    dash: input.dash ?? false,
    pause: input.pause ?? false,
  };
}
