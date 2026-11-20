import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runHeadless } from '../src/core/runner';
import { parseInputs, parseScenario } from '../src/core/io';

const ROOT = resolve(__dirname, '..');

function loadScenario(name: string) {
  return parseScenario(JSON.parse(readFileSync(resolve(ROOT, 'tests/scenarios', name), 'utf8')));
}
function loadInputs(name: string) {
  return parseInputs(JSON.parse(readFileSync(resolve(ROOT, 'tests/scenarios', name), 'utf8')));
}

describe('headless theo Test Contract v1.2', () => {
  it('snapshot tick 0 ton tai va dung shape', () => {
    const r = runHeadless({ seed: 7, night: 1, ticks: 10, snapshotEvery: 10 });
    const first = JSON.parse(r.lines[0]);
    expect(first.type).toBe('snapshot');
    expect(first.tick).toBe(0);
    expect(first.sim_tick).toBe(0);
    expect(first.state).toBe('playing');
    expect(Array.isArray(first.lanterns)).toBe(true);
    expect(Array.isArray(first.shades)).toBe(true);
    expect(typeof first.motes_active).toBe('number');
  });

  it('dong end la dong cuoi cung va bat buoc', () => {
    const r = runHeadless({ seed: 7, night: 1, ticks: 30, snapshotEvery: 10 });
    const last = JSON.parse(r.lines[r.lines.length - 1]);
    expect(last.type).toBe('end');
    expect(last.ticks).toBe(30);
    expect(['playing', 'won', 'lost']).toContain(last.state);
    expect(typeof last.score).toBe('number');
  });

  it('thoi gian con lai giam dung 60 tick/giay', () => {
    const r = runHeadless({ seed: 7, night: 1, ticks: 60, snapshotEvery: 60 });
    const snap = JSON.parse(r.lines[r.lines.length - 2]);
    expect(snap.time_left_s).toBeCloseTo(239, 3);
  });

  it('tuong tac khong duoc chay neu khong co file inputs', () => {
    const r = runHeadless({
      seed: 3,
      night: 1,
      ticks: 120,
      snapshotEvery: 120,
      scenario: loadScenario('scenario-lit.json'),
    });
    expect(r.lines.map((l) => JSON.parse(l)).filter((o) => o.type === 'event').map((o) => o.name)).toEqual(['night_start']);
  });

  it('scenario nap sang/cham dau khong thang som (Ticket-03)', () => {
    const r = runHeadless({
      seed: 3,
      night: 1,
      ticks: 200,
      snapshotEvery: 50,
      scenario: loadScenario('scenario-lit.json'),
      inputs: loadInputs('inputs-lit.json'),
    });
    const events = r.lines.map((l) => JSON.parse(l)).filter((o) => o.type === 'event');
    expect(events.some((e) => e.name === 'deposit')).toBe(true);
    expect(events.some((e) => e.name === 'lantern_lit')).toBe(true);
    const end = JSON.parse(r.lines[r.lines.length - 1]);
    expect(events.some((e) => e.name === 'refuel')).toBe(true);
    expect(end.state).toBe('playing');
  });

  it('Bong Muc duoi theo nguoi choi', () => {
    const r = runHeadless({
      seed: 3,
      night: 1,
      ticks: 120,
      snapshotEvery: 60,
      scenario: loadScenario('scenario-shade.json'),
    });
    const snaps = r.lines.map((l) => JSON.parse(l)).filter((o) => o.type === 'snapshot');
    const d0 = Math.hypot(snaps[0].shades[0].pos[0], snaps[0].shades[0].pos[2]);
    const d1 = Math.hypot(snaps[1].shades[0].pos[0], snaps[1].shades[0].pos[2]);
    expect(d1).toBeLessThan(d0);
  });

  it('toa sang choang Bong Muc va ton mat anh sang', () => {
    const r = runHeadless({
      seed: 3,
      night: 1,
      ticks: 60,
      snapshotEvery: 30,
      scenario: loadScenario('scenario-pulse.json'),
      inputs: loadInputs('inputs-pulse.json'),
    });
    const events = r.lines.map((l) => JSON.parse(l)).filter((o) => o.type === 'event');
    const pulse = events.find((e) => e.name === 'pulse');
    expect(pulse).toBeTruthy();
    expect(pulse.data.stunned_ids.length).toBeGreaterThan(0);
  });

  it('tuyet doi tinh determin: cung seed, scenario, inputs -> cung output', () => {
    const opts = {
      seed: 42,
      night: 1,
      ticks: 300,
      snapshotEvery: 10,
      scenario: loadScenario('scenario-lit.json'),
      inputs: loadInputs('inputs-lit.json'),
    };
    const a = runHeadless(opts);
    const b = runHeadless(opts);
    expect(a.lines.join('\n')).toBe(b.lines.join('\n'));
  });

  it('co id sinh tu dinh giua hai lan chay', () => {
    const opts = { seed: 42, night: 1, ticks: 300, snapshotEvery: 10 };
    const a = runHeadless(opts);
    const b = runHeadless(opts);
    expect(a.lines.join('\n')).toBe(b.lines.join('\n'));
  });
});
