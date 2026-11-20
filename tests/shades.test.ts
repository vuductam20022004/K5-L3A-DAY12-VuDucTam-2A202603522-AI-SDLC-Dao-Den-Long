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

describe('Bong Muc', () => {
  it('duoi theo nguoi choi khi khong dung', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [10, 0, 0] }],
      player: { pos: [0, 0, 0] },
    });
    const before = sim.shades[0].pos.x;
    for (let i = 0; i < 30; i++) sim.step(idle);
    expect(sim.shades[0].pos.x).toBeLessThan(before);
  });

  it('cham nguoi choi gay mat mau', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0.5, 0, 0] }],
      player: { pos: [0, 0, 0], flames: 3, carried: 3 },
    });
    const events = sim.step(idle);
    const hit = events.find((e) => e.name === 'player_hit');
    expect(hit).toBeTruthy();
    expect(hit?.data['by']).toBe('shade');
    expect(sim.player.flames).toBe(2);
  });

  it('bat tu buoc truoc khi bi cham lai', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0.5, 0, 0] }],
      player: { pos: [0, 0, 0], flames: 3 },
    });
    sim.step(idle);
    const after = sim.player.flames;
    for (let i = 0; i < 30; i++) sim.step(idle);
    expect(sim.player.flames).toBe(after);
  });

  it('toa sang choang va day Bong Muc', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [3, 0, 0] }],
      player: { pos: [0, 0, 0], flames: 3, carried: 3 },
    });
    const before = sim.shades[0].pos.x;
    const events = sim.step({ ...idle, pulse: true });
    const pulse = events.find((e) => e.name === 'pulse');
    expect(pulse).toBeTruthy();
    expect(pulse?.data['stunned_ids']).toEqual(['S1']);
    expect(sim.shades[0].state).toBe('stunned');
    expect(sim.shades[0].pos.x).toBeGreaterThan(before);
    expect(sim.player.flames).toBe(3);
    expect(sim.player.carried).toBe(3 - TUNING.pulse_cost);
  });

  it('Bong Muc khong vao duoc vung an toan quanh den da thap', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [6, 0, 0] }],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 0, lit: true }],
      player: { pos: [0, 0, 0] },
    });
    for (let i = 0; i < 120; i++) sim.step(idle);
    const d = Math.hypot(sim.shades[0].pos.x, sim.shades[0].pos.z);
    expect(d).toBeGreaterThanOrEqual(TUNING.safe_radius);
  });
});

describe('thang / thua', () => {
  it('thang khi tat ca den da sang', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 0, lit: true }],
      player: { pos: [0, 0, 0] },
    });
    // 5 den mac dinh cua Dem 1, scenario chi ghi de L1 -> 4 den con lai chua sang.
    expect(sim.lanterns.length).toBe(5);
    const events = sim.step(idle);
    expect(events.some((e) => e.name === 'game_over')).toBe(false);
    expect(sim.state).toBe('playing');
  });

  it('thang khi tat ca 5 den da sang', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 0], deposited: 0, lit: true },
        { id: 'L2', pos: [0, 0, 0], deposited: 0, lit: true },
        { id: 'L3', pos: [0, 0, 0], deposited: 0, lit: true },
        { id: 'L4', pos: [0, 0, 0], deposited: 0, lit: true },
        { id: 'L5', pos: [0, 0, 0], deposited: 0, lit: true }
      ],
      player: { pos: [0, 0, 0] },
    });
    const events = sim.step(idle);
    const over = events.find((e) => e.name === 'game_over');
    expect(over?.data['result']).toBe('won');
    expect(over?.data['reason']).toBe('all_lit');
    expect(sim.state).toBe('won');
  });

  it('thua khi het mau', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0.5, 0, 0] }],
      player: { pos: [0, 0, 0], flames: 1 },
    });
    const events = sim.step(idle);
    const over = events.find((e) => e.name === 'game_over');
    expect(over?.data['result']).toBe('lost');
    expect(over?.data['reason']).toBe('no_flames');
  });

  it('thua khi het gio (dawn)', () => {
    const sim = simWith({
      random_motes: false,
      random_shades: false,
      time_left_s: 1,
      player: { pos: [0, 0, 0] },
    });
    for (let i = 0; i < 61; i++) sim.step(idle);
    expect(sim.state).toBe('lost');
  });
});
