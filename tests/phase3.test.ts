import { describe, expect, it } from 'vitest';
import { GameSim, defaultFrame } from '../src/core/sim';
import { TUNING } from '../src/core/config';
import { InvalidInputError, parseScenario, type Scenario } from '../src/core/io';
import { runHeadless } from '../src/core/runner';

const idle = defaultFrame();
function make(sc: Scenario = {}, night = 1, tuning = TUNING): GameSim {
  return new GameSim({ seed: 31, night, tuning, scenario: { random_motes: false, random_shades: false,
    random_drifters: false, wind_enabled: false, ...sc } });
}
function step(sim: GameSim, ticks: number) {
  const events = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}
const lit = (id = 'L1', fuel = 100, x = 0) => ({ id, pos: [x, 0, 0] as [number, number, number], lit: true, fuel });
const drain = (id = 'S1', x = 1) => ({ id, pos: [x, 0.8, 0] as [number, number, number], state: 'drain' as const, target_lantern_id: 'L1' });

describe('fuel state and tick precision', () => {
  it('scenario lit defaults to 100, remembers ever_lit and never grants capacity or score', () => {
    const sim = make({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] });
    expect(sim.snapshot().lanterns[0]).toMatchObject({ fuel: 100, ever_lit: true, relit_count: 0 });
    expect(sim.capacity).toBe(10); expect(sim.score).toBe(0);
  });
  it('loses exactly one fuel per sixty ticks and goes out exactly at 6000', () => {
    const sim = make({ lanterns: [lit()] });
    step(sim, 60); expect(sim.lanterns[0].fuelTicks).toBe(5940); expect(sim.fuel(sim.lanterns[0])).toBe(99);
    step(sim, 5939); expect(sim.lanterns[0].lit).toBe(true); expect(sim.lanterns[0].fuelTicks).toBe(1);
    expect(sim.step().find((e) => e.name === 'lantern_out')?.data).toEqual({ lantern_id: 'L1' });
    expect(sim.snapshot().lanterns[0]).toMatchObject({ lit: false, fuel: 0, deposited: 0, ever_lit: true });
    expect(step(sim, 60).filter((e) => e.name === 'lantern_out')).toHaveLength(0);
  });
  it('fuel stays still during pause and after the terminal tick', () => {
    const sim = make({ lanterns: [lit()], time_left_s: 1 / 60 });
    sim.step({ ...idle, pause: true }); step(sim, 100);
    expect(sim.lanterns[0].fuelTicks).toBe(6000);
    sim.step({ ...idle, pause: true }); sim.step();
    expect(sim.state).toBe('lost'); expect(sim.lanterns[0].fuelTicks).toBe(5999);
    step(sim, 100); expect(sim.lanterns[0].fuelTicks).toBe(5999);
  });
  it('a dark scenario lamp always exposes zero fuel', () => {
    const sim = make({ lanterns: [{ ...lit(), lit: false, ever_lit: true }] });
    expect(sim.snapshot().lanterns[0]).toMatchObject({ fuel: 0, ever_lit: true, relit_count: 0 });
  });
  it.each([-1, 101, '20', null])('rejects malformed fuel %s', (fuel) => {
    expect(() => parseScenario({ lanterns: [{ ...lit(), fuel }] })).toThrow(InvalidInputError);
  });
  it('validates the new counter, target and boolean fields', () => {
    expect(() => parseScenario({ player: { successful_lights: -1 } })).toThrow(InvalidInputError);
    expect(() => parseScenario({ lanterns: [{ ...lit(), ever_lit: 1 }] })).toThrow(InvalidInputError);
    expect(() => parseScenario({ shades: [{ ...drain(), target_lantern_id: 3 }] })).toThrow(InvalidInputError);
    expect(parseScenario({ shades: [drain()], player: { successful_lights: 2 } }).shades?.[0].state).toBe('drain');
  });
});

describe('refuel, relight and capacity', () => {
  it.each([[90, 2], [90 + 1 / 60, 1], [99, 1]])('ceil refuel at fuel %f consumes %i', (fuel, amount) => {
    const sim = make({ lanterns: [lit('L1', fuel)], player: { carried: 4 } });
    const events = sim.step({ ...idle, interact: true });
    expect(events.find((e) => e.name === 'refuel')?.data).toEqual({ lantern_id: 'L1', amount, fuel: 100 });
    expect(sim.player.carried).toBe(4 - amount); expect(sim.score).toBe(5 * amount);
    expect(sim.capacity).toBe(10); expect(sim.player.successfulLights).toBe(0);
  });
  it('refuel is limited by carried motes and uses the same edge trigger', () => {
    const sim = make({ lanterns: [lit('L1', 40)], player: { carried: 2 } });
    sim.step({ ...idle, interact: true }); expect(sim.player.carried).toBe(0);
    expect(sim.lanterns[0].fuelTicks).toBe(3599); expect(sim.score).toBe(10);
    sim.player.carried = 2;
    expect(sim.step({ ...idle, interact: true }).some((e) => e.name === 'refuel')).toBe(false);
  });
  it('full lamps are excluded, even when closer; full-only input does nothing', () => {
    const tuning = { ...TUNING, fuel_decay_per_s: 0 };
    const sim = make({ lanterns: [lit('L1', 100, 1), { id: 'L2', pos: [2, 0, 0] }], player: { carried: 1 } }, 1, tuning);
    expect(sim.step({ ...idle, interact: true }).find((e) => e.name === 'deposit')?.data.lantern_id).toBe('L2');
    const fullOnly = make({ lanterns: [lit('L1', 100, 1)], player: { carried: 1 } }, 1, tuning);
    expect(fullOnly.step({ ...idle, interact: true }).map((e) => e.name)).toEqual(['night_start']);
    expect(fullOnly.score).toBe(0); expect(fullOnly.player.carried).toBe(1);
  });
  it('receivable lit and dark lamps tie by id', () => {
    const sim = make({ lanterns: [lit('L2', 20, -1), { id: 'L1', pos: [1, 0, 0] }], player: { carried: 1 } });
    expect(sim.step({ ...idle, interact: true }).find((e) => e.name === 'deposit')?.data.lantern_id).toBe('L1');
  });
  it('lights first for ten, relights for five, keeps progress and grows capacity', () => {
    const sim = make({ lanterns: [{ id: 'L1', pos: [0, 0, 1] }], player: { carried: 10 } });
    expect(sim.step({ ...idle, interact: true }).find((e) => e.name === 'lantern_lit')?.data.relight).toBe(false);
    expect(sim.score).toBe(150); expect(sim.capacity).toBe(12);
    sim.lanterns[0].fuelTicks = 1; sim.step();
    sim.player.carried = 2; sim.step({ ...idle, interact: true });
    expect(sim.lanterns[0].lit).toBe(false); expect(sim.lanterns[0].deposited).toBe(2);
    sim.step(); sim.player.carried = 3;
    expect(sim.step({ ...idle, interact: true }).find((e) => e.name === 'lantern_lit')?.data.relight).toBe(true);
    expect(sim.score).toBe(215); expect(sim.capacity).toBe(14); expect(sim.lanterns[0].relitCount).toBe(1);
    expect(sim.fuel(sim.lanterns[0])).toBe(100);
  });
  it('can extinguish and relight in the same tick, in event order', () => {
    const sim = make({ lanterns: [lit('L1', 1 / 60)], player: { carried: 5 } });
    const events = sim.step({ ...idle, interact: true }).filter((e) => e.name !== 'night_start');
    expect(events.map((e) => e.name)).toEqual(['lantern_out', 'deposit', 'lantern_lit']);
    expect(sim.score).toBe(65); expect(sim.fuel(sim.lanterns[0])).toBe(100);
    expect(sim.lanterns[0].relitCount).toBe(1); expect(sim.capacity).toBe(12);
  });
  it.each([[0,10],[1,12],[3,16],[5,20],[12,20]])('counter %i gives capacity %i and new nights reset it', (successful_lights, capacity) => {
    const sim = make({ player: { successful_lights }, motes: Array.from({ length: 25 }, () => [0, 0, 0] as [number,number,number]) });
    sim.step(); expect(sim.snapshot().player.capacity).toBe(capacity); expect(sim.player.carried).toBe(capacity);
    expect(make({}, 2).capacity).toBe(10);
  });
});

describe('weak lantern targeting, drain and safety', () => {
  it('two drainers add to natural decay and log each sixty drain ticks in id order', () => {
    const sim = make({ lanterns: [lit('L1', 29)], player: { pos: [20, 0, 0] }, shades: [drain('S2', -1), drain('S1')] });
    const events = step(sim, 60).filter((e) => e.name === 'fuel_drain');
    expect(sim.lanterns[0].fuelTicks).toBe(18 * 60);
    expect(events.map((e) => e.data)).toEqual([
      { lantern_id: 'L1', shade_id: 'S1', fuel: 18 }, { lantern_id: 'L1', shade_id: 'S2', fuel: 18 },
    ]);
  });
  it('wander selects the closest weak lamp then drains only from the next tick', () => {
    const sim = make({ lanterns: [lit('L1', 29), lit('L2', 10, -8)], player: { pos: [30, 0, 0] }, shades: [{ pos: [2, 0.8, 0], state: 'wander' }] });
    sim.step(); expect(sim.shades[0].state).toBe('drain'); expect(sim.shades[0].targetLanternId).toBe('L1');
    expect(sim.lanterns[0].fuelTicks).toBe(1739);
    sim.step(); expect(sim.lanterns[0].fuelTicks).toBe(1733);
  });
  it('equal-distance weak lamps tie by id and chase does not retarget a lamp', () => {
    const sim = make({ lanterns: [lit('L2', 20, -3), lit('L1', 20, 3)], player: { pos: [30,0,0] }, shades: [{ pos: [0,0.8,0], state: 'wander' }] });
    sim.step(); expect(sim.shades[0].targetLanternId).toBe('L1'); expect(sim.shades[0].pos.x).toBeGreaterThan(0);
    const chasing = make({ lanterns: [lit('L1', 20)], player: { pos: [10,0,0] }, shades: [{ pos: [0,0.8,0], state: 'chase' }] });
    chasing.step(); expect(chasing.shades[0].state).toBe('chase'); expect(chasing.shades[0].targetLanternId).toBeUndefined();
  });
  it('without weak lamps, wander heads toward the nearest dark lamp', () => {
    const sim = make({ lanterns: [{ id: 'L1', pos: [5,0,0] }], player: { pos: [30,0,0] }, shades: [{ pos: [0,0.8,0], state: 'wander' }] });
    sim.step(); expect(sim.shades[0].targetLanternId).toBe('L1'); expect(sim.shades[0].pos.x).toBeGreaterThan(0);
  });
  it.each(['off', 'far', 'unknown'] as const)('drain returns to wander for %s target', (kind) => {
    const shade = { ...drain(), ...(kind === 'far' ? { pos: [3,0.8,0] as [number,number,number] } : {}), ...(kind === 'unknown' ? { target_lantern_id: 'missing' } : {}) };
    const sim = make({ lanterns: [{ ...lit('L1', 20), lit: kind !== 'off' }], player: { pos: [20,0,0] }, shades: [shade] });
    sim.step(); expect(sim.shades[0].state).toBe('wander');
  });
  it('drain turns to chase when the player enters six metres', () => {
    const sim = make({ lanterns: [lit('L1', 20)], player: { pos: [7,0,0] }, shades: [drain()] });
    sim.step(); expect(sim.shades[0].state).toBe('chase');
  });
  it('exactly thirty is safe, then normal decay crosses below it', () => {
    const sim = make({ lanterns: [lit('L1', 30)] });
    expect(sim.inSafeZone({ x: 0, y: 0, z: 0 })).toBe(true);
    sim.step(); expect(sim.inSafeZone({ x: 0, y: 0, z: 0 })).toBe(false);
  });
  it('refuel to exactly thirty restores safety and ejects a drainer without a hit', () => {
    const sim = make({ lanterns: [lit('L1', 20.1)], shades: [drain()], player: { carried: 1 } });
    const events = sim.step({ ...idle, interact: true });
    expect(sim.lanterns[0].fuelTicks).toBe(1800); expect(sim.shades[0].state).toBe('recoil');
    expect(sim.shades[0].pos.x).toBe(6); expect(events.some((e) => e.name === 'player_hit')).toBe(false);
  });
  it('pulse awards total fifteen only for a previously draining shade, then five when stunned', () => {
    const sim = make({ lanterns: [lit('L1', 20)], shades: [drain()], player: { carried: 6 } });
    sim.step({ ...idle, pulse: true }); expect(sim.score).toBe(15); expect(sim.shades[0].state).toBe('stunned');
    sim.step(); sim.player.pulseCdUntilTick = 0;
    sim.step({ ...idle, pulse: true }); expect(sim.score).toBe(20);
    step(sim, 120); expect(sim.shades[0].state).not.toBe('stunned');
  });
  it('pause freezes fuel and drain event cadence together', () => {
    const sim = make({ lanterns: [lit('L1', 29)], shades: [drain()], player: { pos: [20,0,0] } });
    step(sim, 59); sim.step({ ...idle, pause: true });
    const fuel = sim.lanterns[0].fuelTicks; expect(step(sim, 100).some((e) => e.name === 'fuel_drain')).toBe(false);
    expect(sim.lanterns[0].fuelTicks).toBe(fuel);
    sim.step({ ...idle, pause: true }); expect(sim.step().some((e) => e.name === 'fuel_drain')).toBe(true);
  });
});

describe('dawn victory and replacement score', () => {
  it.each([[1,3],[2,4],[3,5]])('night %i requires %i lamps', (night, needed) => {
    const mapSim = make({}, night);
    expect(mapSim.requiredLitCount).toBe(needed);
    const lanterns = mapSim.map.lanterns.slice(0, needed).map((l) => lit(l.id, 100, l.pos.x));
    const win = make({ time_left_s: 1 / 60, lanterns }, night);
    expect(win.step().find((e) => e.name === 'game_over')?.data).toEqual({ result: 'won', reason: 'dawn_survived' });
    const lose = make({ time_left_s: 1 / 60, lanterns: lanterns.slice(1) }, night);
    expect(lose.step().find((e) => e.name === 'game_over')?.data).toEqual({ result: 'lost', reason: 'dawn' });
  });
  it('all lamps lit never ends a night early', () => {
    const sim = make({ lanterns: Array.from({ length: 5 }, (_, i) => lit(`L${i+1}`)) });
    step(sim, 120); expect(sim.state).toBe('playing'); expect(sim.score).toBe(0);
  });
  it('last-tick extinction loses even if the previous snapshot had enough lamps', () => {
    const sim = make({ time_left_s: 1 / 60, lanterns: [lit('L1'),lit('L2'),lit('L3',1/60)] });
    const events = sim.step();
    expect(events.filter((e) => e.name === 'lantern_out' || e.name === 'game_over').map((e) => e.name)).toEqual(['lantern_out','game_over']);
    expect(sim.state).toBe('lost'); expect(sim.score).toBe(0);
  });
  it('last-tick lighting counts, while zero flames always loses', () => {
    const sc: Scenario = { time_left_s: 1/60, lanterns: [lit('L2',100,10),lit('L3',100,-10), { id:'L1', pos:[0,0,1], deposited:9 }], player: { carried:1 } };
    const win = make(sc); win.step({ ...idle, interact: true }); expect(win.state).toBe('won'); expect(win.score).toBe(703);
    const lose = make({ ...sc, player: { flames: 0, carried: 1 } });
    expect(lose.step({ ...idle, interact: true }).find((e) => e.name === 'game_over')?.data.reason).toBe('no_flames');
  });
  it('dawn uses true floor(fuel) even when one-decimal output rounds up', () => {
    const sim = make({ time_left_s: 1/60, lanterns:[lit('L1'),lit('L2'),lit('L3')] });
    sim.step(); expect(sim.snapshot().lanterns[0].fuel).toBe(100);
    expect(sim.score).toBe(597); // 3*(50+99) + 3*50; no time bonus.
  });
  it('snapshot zero has v1.2 fields and replay is byte-identical', () => {
    const options = { seed:3, night:1, ticks:120, snapshotEvery:1, scenario: parseScenario({ lanterns:[lit('L1',29)], shades:[drain()], player:{pos:[20,0,0],successful_lights:2} }) };
    const a = runHeadless(options), b = runHeadless(options);
    expect(a.lines).toEqual(b.lines);
    const first = JSON.parse(a.lines[0]); expect(first.player.capacity).toBe(14);
    expect(first.lanterns[0]).toMatchObject({fuel:29,ever_lit:true,relit_count:0}); expect(first.shades[0].state).toBe('drain');
  });
});
