import { describe, expect, it } from 'vitest';
import { getMap, supportY } from '../src/core/maps';
import { defaultFrame, GameSim } from '../src/core/sim';

describe('three canonical maps and physical traversal', () => {
  it.each([[1, 5, 24], [2, 6, 24], [3, 7, 30]])('night %i has %i lanterns and %i mote sites', (night, lamps, motes) => {
    const map = getMap(night);
    expect(map.lanterns).toHaveLength(lamps); expect(map.motePoints).toHaveLength(motes);
    expect(map.lanterns.map((l) => l.id)).toEqual(Array.from({ length: lamps }, (_, i) => `L${i + 1}`));
  });
  it('night one has the exact lamp coordinates and forty metre edge', () => {
    expect(getMap(1).lanterns.map((l) => Object.values(l.pos))).toEqual([
      [0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7],
    ]);
    expect(supportY(getMap(1), 40, 0, 0)).toBe(0);
    expect(supportY(getMap(1), 40.01, 0, 0)).toBe(null);
  });
  it('night two bridge has no support outside its two metre width', () => {
    const map = getMap(2);
    expect(supportY(map, 35, 2, 0)).toBe(0);
    expect(supportY(map, 35, 2.01, 0)).toBe(null);
    expect(supportY(map, 70, 0, 0)).toBe(0);
  });
  it.each([[20, 18, true], [50, -18, false]])('spring at %i,%i lands in destination', (x, z, outbound) => {
    const sim = new GameSim({ seed: 1, night: 2, scenario: { player: { pos: [x as number, 0, z as number] }, random_motes: false, random_shades: false, random_drifters: false } });
    const idle = defaultFrame();
    for (let i = 0; i < 86; i++) sim.step(idle);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.flames).toBe(3);
    expect(Math.hypot(sim.player.pos.x - (outbound ? 70 : 0), sim.player.pos.z)).toBeLessThanOrEqual(28);
  });
  it('walks up both ramps without climbing vertical tier walls', () => {
    for (const deg of [30, 150]) {
      const a = deg * Math.PI / 180;
      const sim = new GameSim({ seed: 1, night: 3, scenario: { player: { pos: [30 * Math.cos(a), 0, 30 * Math.sin(a)] }, random_motes: false, random_shades: false, random_drifters: false } });
      for (let i = 0; i < 70; i++) sim.step({ ...defaultFrame(), move: [-Math.cos(a), -Math.sin(a)] });
      expect(sim.player.pos.y).toBeCloseTo(3, 6);
      expect(sim.player.grounded).toBe(true);
    }
    const sim = new GameSim({ seed: 1, night: 3, scenario: { player: { pos: [0, 0, 25] }, random_motes: false, random_shades: false } });
    for (let i = 0; i < 60; i++) sim.step({ ...defaultFrame(), move: [0, -1] });
    expect(sim.player.pos.z).toBeGreaterThanOrEqual(24);
    expect(sim.player.pos.y).toBe(0);
  });
  it('spring on tier one reaches tier two and tower blocks traversal', () => {
    const sim = new GameSim({ seed: 1, night: 3, scenario: { player: { pos: [0, 3, 13] }, random_motes: false, random_shades: false, random_drifters: false } });
    for (let i = 0; i < 60; i++) sim.step(defaultFrame());
    expect(sim.player.pos.y).toBe(6); expect(sim.player.grounded).toBe(true);
    for (let i = 0; i < 60; i++) sim.step({ ...defaultFrame(), move: [0, -1] });
    expect(Math.hypot(sim.player.pos.x, sim.player.pos.z)).toBeGreaterThanOrEqual(2);
  });
});
