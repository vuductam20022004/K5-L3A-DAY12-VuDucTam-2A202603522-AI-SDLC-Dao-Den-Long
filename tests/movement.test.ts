import { describe, expect, it } from 'vitest';
import { GameSim } from '../src/core/sim';

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

describe('di chuyển theo cam_yaw', () => {
  it('yaw = 0 thi move [0,1] la duong +Z', () => {
    const sim = simWith({ player: { pos: [0, 0, 0] } });
    sim.step({ ...idle, move: [0, 1] });
    expect(sim.player.pos.z).toBeGreaterThan(0);
    expect(Math.abs(sim.player.pos.x)).toBeLessThan(1e-9);
  });

  it('yaw = 0 thi move [1,0] la duong +X', () => {
    const sim = simWith({ player: { pos: [0, 0, 0] } });
    sim.step({ ...idle, move: [1, 0] });
    expect(sim.player.pos.x).toBeGreaterThan(0);
    expect(Math.abs(sim.player.pos.z)).toBeLessThan(1e-9);
  });

  it('yaw = 90 do quay vector theo cong thuc contract', () => {
    const sim = simWith({ player: { pos: [0, 0, 0] } });
    // theta = 90 deg: x' = x*cos + z*sin = z ; z' = -x*sin + z*cos = -x
    sim.step({ ...idle, move: [1, 0], cam_yaw_deg: 90 });
    expect(Math.abs(sim.player.pos.x)).toBeLessThan(1e-9);
    expect(sim.player.pos.z).toBeLessThan(0);
  });

  it('vector move dai hon 1 duoc chuan hoa ve do dai 1', () => {
    const a = simWith({ player: { pos: [0, 0, 0] } });
    a.step({ ...idle, move: [1, 0] });
    const b = simWith({ player: { pos: [0, 0, 0] } });
    b.step({ ...idle, move: [3, 0] });
    expect(b.player.pos.x).toBeCloseTo(a.player.pos.x, 9);
  });
});
