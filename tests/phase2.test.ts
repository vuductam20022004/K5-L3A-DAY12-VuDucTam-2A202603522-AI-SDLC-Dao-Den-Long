import { describe, expect, it } from 'vitest';
import { GameSim, defaultFrame } from '../src/core/sim';
import { TUNING } from '../src/core/config';
import { InvalidInputError, parseInputs, parseScenario, type Scenario } from '../src/core/io';
import { runHeadless } from '../src/core/runner';
import { Campaign } from '../src/core/campaign';

const idle = defaultFrame();
function make(scenario: Scenario = {}, night = 1) {
  return new GameSim({ seed: 42, night, scenario: {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, ...scenario,
  } });
}
function step(sim: GameSim, n: number, frame = idle) {
  for (let i = 0; i < n; i++) sim.step(frame);
}

describe('Ticket-02 standardized tuning', () => {
  it('uses the producer values exactly', () => {
    expect(TUNING).toEqual({
      player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5,
      pickup_radius: 1, interact_radius: 2, pulse_cost: 3, pulse_radius: 5,
      night1_duration_s: 300, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5,
      pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
      shade_speed: 4, shade_hit_radius: 1, fall_enabled: true,
      dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
      night2_duration_s: 330, night3_duration_s: 360,
      score: { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 },
    });
  });
  it('accelerates and stops in six ticks, including air control', () => {
    const sim = make();
    step(sim, 6, { ...idle, move: [0, 1] });
    expect(sim.player.vel.z).toBe(6);
    step(sim, 6);
    expect(sim.player.vel.z).toBe(0);
    sim.step({ ...idle, jump: true });
    step(sim, 6, { ...idle, move: [1, 0] });
    expect(sim.player.vel.x).toBe(6);
    expect(sim.player.pos.y).toBeGreaterThan(0);
  });
  it('dash covers 2.8 m in twelve ticks and holding the button cannot retrigger', () => {
    const sim = make();
    step(sim, 12, { ...idle, dash: true });
    expect(sim.player.pos.z).toBeCloseTo(2.8, 9);
    step(sim, 100, { ...idle, dash: true });
    expect(sim.player.dashing).toBe(false);
    expect(sim.player.pos.z).toBeLessThan(5);
    sim.step(idle);
    expect(sim.step({ ...idle, dash: true }).some((e) => e.name === 'dash')).toBe(true);
  });
  it('dash maintains height in air and normalizes analog movement', () => {
    const sim = make({ player: { pos: [0, 3, 0] } });
    step(sim, 12, { ...idle, move: [0.1, 0], dash: true });
    expect(sim.player.pos.y).toBe(3);
    expect(sim.player.pos.x).toBeCloseTo(2.8, 9);
    sim.step(idle);
    expect(sim.player.pos.y).toBeLessThan(3);
  });
  it('an idle dash stays at fourteen m/s after turning with analog input', () => {
    const sim = make({ player: { charm_ticks: 600 } });
    sim.step({ ...idle, dash: true });
    sim.step({ ...idle, move: [0.1, 0] });
    step(sim, 10);
    sim.step({ ...idle, dash: true });
    expect(sim.player.vel.x).toBe(14);
    expect(sim.player.vel.z).toBe(0);
  });
  it('pickup does not score; deposit scores each unit and remembers progress', () => {
    const sim = make({ motes: [[0, 0, 0]], lanterns: [{ id: 'L1', pos: [0, 0, 2] }] });
    sim.step(idle);
    expect(sim.score).toBe(0);
    sim.step({ ...idle, interact: true });
    expect(sim.score).toBe(10);
    expect(sim.lanterns[0].deposited).toBe(1);
  });
  it('capacity actually stops pickup at ten', () => {
    const sim = make({ motes: Array.from({ length: 15 }, () => [0, 0, 0] as [number, number, number]) });
    sim.step(idle);
    expect(sim.player.carried).toBe(10);
    expect(sim.motes.filter((m) => m.active)).toHaveLength(5);
  });
  it('equal-distance lamps use the smaller id', () => {
    const sim = make({ player: { carried: 1 }, lanterns: [
      { id: 'L2', pos: [-2, 0, 0] }, { id: 'L1', pos: [2, 0, 0] },
    ] });
    const deposit = sim.step({ ...idle, interact: true }).find((e) => e.name === 'deposit');
    expect(deposit?.data.lantern_id).toBe('L1');
  });
  it('has twenty distinct initial motes and spawns only on 240k', () => {
    const sim = make({ random_motes: true });
    expect(new Set(sim.motes.map((m) => JSON.stringify(m.pos))).size).toBe(20);
    step(sim, 239);
    expect(sim.motes.filter((m) => m.active)).toHaveLength(20);
    sim.step(idle);
    expect(sim.motes.filter((m) => m.active)).toHaveLength(21);
  });
  it('random_motes false disables later spawns too', () => {
    const sim = make(); step(sim, 960);
    expect(sim.motes).toHaveLength(0);
  });
});

describe('shade schedule, pulse and damage', () => {
  it('spawns only two at 300 then one at 780', () => {
    const sim = make({ random_shades: true });
    step(sim, 299); expect(sim.shades).toHaveLength(0);
    sim.step(); expect(sim.shades).toHaveLength(2);
    step(sim, 479); expect(sim.shades).toHaveLength(2);
    sim.step(); expect(sim.shades).toHaveLength(3);
    expect(sim.shades.map((s) => s.id)).toEqual(['S1', 'S2', 'S3']);
  });
  it('night 3 uses 4.5 m/s', () => {
    const sim = make({ shades: [{ pos: [10, 0, -10] }], player: { pos: [0, 0, -10] } }, 3);
    sim.step(); expect(sim.shades[0].pos.x).toBeCloseTo(9.925, 9);
  });
  it('locks 3D pulse targets, pushes 4 m over 15 steps, stuns for 120', () => {
    const sim = make({ shades: [{ id: 'S1', pos: [3, 0.8, 0] }, { id: 'S2', pos: [0, 6, 0] }], player: { carried: 3 } });
    const events = sim.step({ ...idle, pulse: true });
    expect(events.find((e) => e.name === 'pulse')?.data.stunned_ids).toEqual(['S1']);
    expect(sim.shades[0].pos.x).toBeCloseTo(3 + 4 / 15);
    step(sim, 14); expect(sim.shades[0].pos.x).toBeCloseTo(7, 9);
    step(sim, 104); expect(sim.shades[0].state).toBe('stunned');
    sim.step(); expect(sim.shades[0].state).toBe('stunned');
    sim.step(); expect(sim.shades[0].state).not.toBe('stunned');
    expect(sim.player.flames).toBe(3);
    expect(sim.score).toBe(5);
  });
  it('cannot pulse without three motes', () => {
    const sim = make({ player: { carried: 2 } });
    expect(sim.step({ ...idle, pulse: true }).some((e) => e.name === 'pulse')).toBe(false);
    expect(sim.player.carried).toBe(2);
    expect(sim.snapshot().player.pulse_cd_s).toBe(0);
  });
  it('recoil moves the shade, leaves player in place, and drops floor(carried/2)', () => {
    const sim = make({ player: { carried: 9 }, shades: [{ pos: [0.5, 0, 0] }] });
    sim.step();
    expect(sim.player.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(sim.shades[0].state).toBe('recoil');
    expect(sim.player.carried).toBe(5);
    expect(sim.motes.filter((m) => m.kind === 'dropped')).toHaveLength(4);
    const x = sim.shades[0].pos.x;
    step(sim, 59);
    expect(sim.shades[0].pos.x).toBeCloseTo(x + 59 * 2 / 60, 6);
  });
  it('blocks at a safe zone and pushes an inside shade out without damage', () => {
    const sim = make({ shades: [{ pos: [0.5, 0, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] });
    sim.step();
    expect(Math.hypot(sim.shades[0].pos.x, sim.shades[0].pos.z)).toBeCloseTo(6);
    expect(sim.player.flames).toBe(3);
  });
  it('expired drops vanish even when carrying a full bag', () => {
    const sim = make({ player: { carried: 10 } });
    sim.motes.push({ id: 'M1', pos: { x: 0, y: 0, z: 0 }, active: true, kind: 'dropped', ttlTicks: 1 });
    sim.step(); expect(sim.snapshot().motes_active).toBe(0);
  });
});

describe('fall, charms, drifters and wind', () => {
  it('fall ignores invulnerability, prevents pickup, and respawns after sixty ticks', () => {
    const sim = make({ player: { pos: [41, -10.1, 0], carried: 8, invuln_ticks: 999 }, motes: [[41, -10, 0]] });
    const hit = sim.step().find((e) => e.name === 'player_hit');
    expect(hit?.data).toEqual({ by: 'fall', flames: 2, dropped: 0, lost: 8 });
    step(sim, 59, { ...idle, move: [1, 0], pulse: true });
    expect(sim.player.pos.y).toBe(-10);
    expect(sim.player.carried).toBe(0);
    sim.step();
    expect(sim.player.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(sim.player.vel).toEqual({ x: 0, y: 0, z: 0 });
    expect(sim.snapshot().player.invuln).toBe(1.5);
  });
  it('a fatal fall finishes once, without respawn or later gameplay', () => {
    const sim = make({ player: { pos: [41, -11, 0], flames: 1 } });
    expect(sim.step().filter((e) => e.name === 'game_over')).toHaveLength(1);
    step(sim, 100); expect(sim.state).toBe('lost'); expect(sim.simSteps).toBe(1);
  });
  it('charm gives 7.2 m/s, free dash cooldown and respawns at 2700', () => {
    const sim = make({ charms: [{ pos: [0, 0, 0] }] }, 2);
    const ev = sim.step().find((e) => e.name === 'charm_picked');
    expect(ev?.data.charm_ticks).toBe(600);
    step(sim, 6, { ...idle, move: [1, 0] }); expect(sim.player.vel.x).toBe(7.2);
    sim.step({ ...idle, dash: true }); expect(sim.snapshot().player.dash_cd_s).toBe(0);
    expect(sim.step({ ...idle, dash: false }).filter((e) => e.name === 'dash')).toHaveLength(0);
    expect(sim.step({ ...idle, dash: true }).filter((e) => e.name === 'dash')).toHaveLength(0);
    sim.player.pos = { x: 10, y: 0, z: 0 };
    step(sim, 2701 - sim.simSteps);
    expect(sim.charms[0].available).toBe(true);
    expect(sim.snapshot().player.charm_s).toBe(0);
  });
  it('drifter steals despite invulnerability then leaves permanently', () => {
    const sim = make({ player: { carried: 8, invuln_ticks: 100 }, drifters: [{ id: 'D1', pos: [0.5, 1, 0], state: 'chase' }] }, 2);
    const steal = sim.step().find((e) => e.name === 'drifter_steal');
    expect(steal?.data).toEqual({ drifter_id: 'D1', amount: 3, carried: 5 });
    expect(sim.player.flames).toBe(3);
    step(sim, 240); expect(sim.drifters).toHaveLength(0);
  });
  it('pulse makes a thief return all motes and leave after 120 ticks', () => {
    const sim = make({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [2, 1, 0], state: 'flee', stolen: 3, state_ticks_left: 240 }] }, 2);
    const drop = sim.step({ ...idle, pulse: true }).find((e) => e.name === 'drifter_drop');
    expect(drop?.data).toEqual({ drifter_id: 'D1', amount: 3 });
    expect(sim.motes.filter((m) => m.kind === 'dropped')).toHaveLength(3);
    step(sim, 120); expect(sim.drifters).toHaveLength(0);
  });
  it('drifters never spawn on night one', () => {
    const sim = make({ random_drifters: true }); step(sim, 2400);
    expect(sim.drifters).toHaveLength(0);
  });
  it('wind warns two seconds before onset and stops after five seconds', () => {
    const sim = make({ wind_enabled: true }, 3);
    step(sim, 1680); expect(sim.wind.warnUntilTick).toBe(1800);
    step(sim, 120); expect(sim.wind.active).toBe(true);
    const start = { ...sim.player.pos };
    step(sim, 60);
    expect(Math.hypot(sim.player.pos.x - start.x, sim.player.pos.z - start.z)).toBeCloseTo(2, 6);
    step(sim, 240); expect(sim.wind.active).toBe(false);
    expect(Math.hypot(sim.player.pos.x, sim.player.pos.z)).toBeCloseTo(10, 6);
  });
  it('scenario wind_enabled false suppresses night three wind', () => {
    const sim = make({}, 3); step(sim, 1800); expect(sim.wind.active).toBe(false);
  });
});

describe('contract ticks, pause and campaign', () => {
  it('all_lit wins on the exact dawn tick, but no_flames always loses', () => {
    const lamps: NonNullable<Scenario['lanterns']> = Array.from({ length: 5 }, (_, i) => ({ id: `L${i + 1}`, pos: [0, 0, 0], lit: true }));
    const won = make({ time_left_s: 1 / 60, lanterns: lamps });
    expect(won.step().find((e) => e.name === 'game_over')?.data).toEqual({ result: 'won', reason: 'all_lit' });
    const lost = make({ time_left_s: 1 / 60, lanterns: lamps, player: { flames: 0 } });
    expect(lost.step().find((e) => e.name === 'game_over')?.data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
  it('a dash does not grant invulnerability', () => {
    const sim = make({ shades: [{ pos: [0, 0, 0.5] }] });
    sim.step({ ...idle, dash: true });
    expect(sim.player.flames).toBe(2);
  });
  it('pulse push stops at the bell tower instead of crossing it', () => {
    const sim = make({ player: { pos: [7, 6, 0], carried: 3 }, shades: [{ pos: [3, 6.8, 0] }] }, 3);
    sim.step({ ...idle, pulse: true }); step(sim, 14);
    expect(sim.shades[0].pos.x).toBeGreaterThanOrEqual(2);
    expect(sim.shades[0].pos.x).toBeLessThan(3);
  });
  it('pulse refreshes stun and push for an already stunned target', () => {
    const sim = make({ player: { carried: 3 }, shades: [{ pos: [3, 0.8, 0], state: 'stunned', state_ticks_left: 240 }] });
    sim.step({ ...idle, pulse: true });
    expect(sim.shades[0].stateTicksLeft).toBe(120);
    expect(sim.shades[0].pushTicksLeft).toBe(14);
    expect(sim.score).toBe(5);
  });
  it('freezes every gameplay clock while paused and resumes on an edge', () => {
    const sim = make({ player: { pulse_cd_ticks: 120 }, charms: [{ pos: [10, 0, 0], available: false, respawn_ticks: 100 }] });
    sim.step({ ...idle, pause: true });
    step(sim, 300);
    expect(sim.steps).toBe(301); expect(sim.simSteps).toBe(0);
    expect(sim.snapshot().player.pulse_cd_s).toBe(2);
    expect(sim.charms[0].respawnTicks).toBe(100);
    expect(sim.step({ ...idle, pause: true }).map((e) => e.name)).toEqual(['resumed']);
    sim.step(); expect(sim.simSteps).toBe(1);
  });
  it('runs exactly N clock steps after a win without scoring twice', () => {
    const sc: Scenario = { random_motes: false, random_shades: false, random_drifters: false,
      lanterns: Array.from({ length: 5 }, (_, i) => ({ id: `L${i + 1}`, pos: [0, 0, 0], lit: true })) };
    const r = runHeadless({ seed: 1, night: 1, ticks: 200, snapshotEvery: 10, scenario: sc });
    expect(r.ticks).toBe(200); expect(r.state).toBe('won'); expect(r.score).toBe(748);
    expect(r.lines.filter((l) => l.includes('"game_over"'))).toHaveLength(1);
  });
  it('array frames apply in order instead of applying all at tick zero', () => {
    const r = runHeadless({ seed: 1, night: 1, ticks: 2, snapshotEvery: 1,
      inputs: parseInputs([{ move: [1, 0] }, { move: [0, 1] }]) });
    const snap = JSON.parse(r.lines.filter((l) => JSON.parse(l).type === 'snapshot')[1]);
    expect(snap.player.pos[0]).toBeGreaterThan(0); expect(snap.player.pos[2]).toBe(0);
  });
  it.each([ { player: [] }, { night: 1.5 }, { player: { carried: -1 } }, { charms: [{ pos: [0, 0, 0], respawn_ticks: 1.5 }] } ])('rejects malformed scenario %j', (sc) => {
    expect(() => parseScenario(sc)).toThrow(InvalidInputError);
  });
  it.each([[{ tick: -1 }], [{ tick: 1.5 }], [{ tick: 0 }, {}]])('rejects invalid timeline %j', (...frames) => {
    expect(() => parseInputs(frames)).toThrow(InvalidInputError);
  });
  it('only wins contribute to total and repeated recording never doubles a night', () => {
    const campaign = new Campaign(1);
    const sim = campaign.startNight(); sim.state = 'lost'; sim.score = 123;
    campaign.record(sim); expect(campaign.totalScore).toBe(0); expect(campaign.nextNight()).toBe(false);
    for (let night = 1; night <= 3; night++) {
      const won = campaign.startNight(); won.state = 'won'; won.score = night * 100;
      campaign.record(won); campaign.record(won);
      if (night < 3) expect(campaign.nextNight()).toBe(true);
    }
    expect(campaign.complete).toBe(true); expect(campaign.totalScore).toBe(600);
    expect(campaign.nextNight()).toBe(false);
  });
});
