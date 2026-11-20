import { describe, expect, it } from 'vitest';
import { readMoveInput } from '../src/render/input';
import { GameSim } from '../src/core/sim';

const IDLE = { move: [0, 0] as [number, number], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };

describe('huong di chuyen theo phim', () => {
  it('W = di toi, S = lui, A = trai, D = phai', () => {
    expect(readMoveInput(new Set(['w']))).toEqual([0, 1]);
    expect(readMoveInput(new Set(['s']))).toEqual([0, -1]);
    expect(readMoveInput(new Set(['a']))).toEqual([1, 0]);
    expect(readMoveInput(new Set(['d']))).toEqual([-1, 0]);
  });

  it('phim mui ten hoat dong giong phim chu', () => {
    expect(readMoveInput(new Set(['arrowup']))).toEqual(readMoveInput(new Set(['w'])));
    expect(readMoveInput(new Set(['arrowleft']))).toEqual(readMoveInput(new Set(['a'])));
  });

  it('khong phim -> khong di chuyen', () => {
    expect(readMoveInput(new Set())).toEqual([0, 0]);
  });

  it('W o yaw 0 la toi ve phia camera nhin (theo +Z)', () => {
    // Camera dat sau lung nhan vat o phia -Z khi yaw = 0, nen "toi" = +Z.
    const sim = new GameSim({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
    sim.step({ ...IDLE, move: readMoveInput(new Set(['w'])) });
    expect(sim.player.pos.z).toBeGreaterThan(0);
  });

  it('W o yaw 90 la toi theo he toa do cam', () => {
    const sim = new GameSim({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
    sim.step({ ...IDLE, move: readMoveInput(new Set(['w'])), cam_yaw_deg: 90 });
    // yaw 90: vector (0,1) -> x' = sin90 = 1, z' = cos90 = 0
    expect(sim.player.pos.x).toBeGreaterThan(0);
    expect(Math.abs(sim.player.pos.z)).toBeLessThan(1e-9);
  });
});
