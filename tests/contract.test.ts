import { describe, expect, it } from 'vitest';
import { parseInputs, parseScenario, InvalidInputError } from '../src/core/io';
import { CONTRACT, TUNING } from '../src/core/config';

describe('game.contract.json khop voi code', () => {
  it('co contract_version 1.1 va team', () => {
    expect(CONTRACT.contract_version).toBe('1.1');
    expect(CONTRACT.team).toMatch(/\S+/);
  });

  it('co du cac truong tuning bat buoc', () => {
    const required = [
      'player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1',
      'pickup_radius', 'interact_radius', 'pulse_cost', 'pulse_radius',
      'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s',
      'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed',
      'shade_hit_radius', 'fall_enabled',
      'dash_speed', 'dash_duration_s', 'dash_cooldown_s', 'night2_duration_s', 'night3_duration_s',
    ];
    for (const k of required) {
      expect(TUNING).toHaveProperty(k);
      const v = (TUNING as unknown as Record<string, unknown>)[k];
      expect(typeof v === 'boolean' || typeof v === 'number').toBe(true);
    }
  });

  it('score co day du 5 muc', () => {
    expect(TUNING.score).toHaveProperty('per_mote');
    expect(TUNING.score).toHaveProperty('per_lantern');
    expect(TUNING.score).toHaveProperty('per_stun');
    expect(TUNING.score).toHaveProperty('per_second_left');
    expect(TUNING.score).toHaveProperty('per_flame_left');
  });
});

describe('dinh dang input / scenario', () => {
  it('input tick phai tang nghiem ngat', () => {
    expect(() =>
      parseInputs({ frames: [{ tick: 10 }, { tick: 10 }] }),
    ).toThrow(InvalidInputError);
    expect(() => parseInputs({ frames: [{ tick: 10 }, { tick: 5 }] })).toThrow(InvalidInputError);
  });

  it('input sai cau truc bi tu choi', () => {
    expect(() => parseInputs({ frames: 'x' })).toThrow(InvalidInputError);
    expect(() => parseInputs({})).toThrow(InvalidInputError);
  });

  it('scenario sai cau truc bi tu choi', () => {
    expect(() => parseScenario({ motes: [[0, 0]] })).toThrow(InvalidInputError);
    expect(() => parseScenario({ shades: [{ pos: 'x' }] })).toThrow(InvalidInputError);
  });
});
