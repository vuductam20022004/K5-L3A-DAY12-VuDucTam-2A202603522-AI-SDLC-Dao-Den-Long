import { describe, expect, it } from 'vitest';
import { GameSim } from '../src/core/sim';
import { TUNING } from '../src/core/config';

const idle = {
  move: [0, 0] as [number, number],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
};

function simWith(scenario: Record<string, unknown>, seed = 1): GameSim {
  return new GameSim({ seed, night: 1, scenario: scenario as never });
}

describe('nhom dom dom', () => {
  it('dom dom trong ban kinh pickup_radius duoc nhat', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 1]],
      player: { pos: [0, 0, 0] },
    });
    const events = sim.step(idle);
    expect(events.some((e) => e.name === 'mote_picked')).toBe(true);
    expect(sim.player.carried).toBe(1);
  });

  it('dom dom ngoai ban kinh khong duoc nhat', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 10]],
      player: { pos: [0, 0, 0] },
    });
    sim.step(idle);
    expect(sim.player.carried).toBe(0);
  });

  it('khong nhat qua suc mang toi da', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]],
      player: { pos: [0, 0, 0] },
    });
    for (let i = 0; i < 10; i++) sim.step(idle);
    // Chi co 3 dom dom trong scenario -> nhat het 3, khong vuot carry_capacity.
    expect(sim.player.carried).toBe(3);
    expect(sim.player.carried).toBeLessThanOrEqual(TUNING.carry_capacity);
  });
});

describe('nap sang vao den', () => {
  it('nap du sang thi den sang va phat su kien', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 0 }],
      player: { pos: [0, 0, 0], carried: TUNING.lantern_cost },
    });
    const events = sim.step({ ...idle, interact: true });
    expect(events.some((e) => e.name === 'deposit')).toBe(true);
    expect(events.some((e) => e.name === 'lantern_lit')).toBe(true);
    expect(sim.lanterns[0].lit).toBe(true);
  });

  it('nap khong du thi den chua sang', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 0 }],
      player: { pos: [0, 0, 0], carried: 1 },
    });
    sim.step({ ...idle, interact: true });
    expect(sim.lanterns[0].lit).toBe(false);
    expect(sim.lanterns[0].deposited).toBe(1);
  });

  it('interact chi kich hoat khi chuyen false sang true', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 0 }],
      player: { pos: [0, 0, 0], carried: TUNING.lantern_cost },
    });
    sim.step({ ...idle, interact: true });
    const before = sim.lanterns[0].deposited;
    sim.step({ ...idle, interact: true });
    expect(sim.lanterns[0].deposited).toBe(before);
  });
});
