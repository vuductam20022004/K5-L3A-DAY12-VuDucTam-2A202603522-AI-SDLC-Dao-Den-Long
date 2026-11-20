#!/usr/bin/env node
/** Repeatable Phase 2 verification; never overwrites Phase 1 evidence. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform, release } from 'node:os';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROOF = resolve(ROOT, 'docs/proof/phase-2');
const ART = resolve(ROOT, 'artifacts');
mkdirSync(PROOF, { recursive: true }); mkdirSync(ART, { recursive: true });
const log = [];
function report(line) { console.log(line); log.push(line); writeFileSync(resolve(PROOF, 'verify-output.txt'), log.join('\n') + '\n'); }
function run(script, args = []) {
  try { return execFileSync(process.execPath, [resolve(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 }); }
  catch (err) { report(`${err.stdout ?? ''}${err.stderr ?? ''}`); throw err; }
}
function headless(args, name, { proof = true } = {}) {
  const out = resolve(proof ? PROOF : ART, name);
  const stdout = run('dist/headless.js', [...args, '--out', out]);
  assert.equal(stdout, '', 'headless stdout must be empty');
  const bytes = readFileSync(out);
  const objects = bytes.toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(objects[0].type, 'snapshot'); assert.equal(objects[0].tick, 0);
  assert.equal(objects.at(-1).type, 'end');
  return { objects, bytes, end: objects.at(-1), snaps: objects.filter((o) => o.type === 'snapshot'),
    events: objects.filter((o) => o.type === 'event') };
}
function event(run, name) { return run.events.find((e) => e.name === name); }
function scenario(name, night, ticks, file, input, every = 1) {
  const args = ['--seed', '42', '--night', String(night), '--ticks', String(ticks), '--snapshot-every', String(every)];
  if (file) args.push('--scenario', `tests/scenarios/${file}.json`);
  if (input) args.push('--inputs', `tests/scenarios/${input}.json`);
  const result = headless(args, `run-${name}.jsonl`);
  assert.equal(result.end.ticks, ticks);
  report(`OK ${name}: ${result.end.ticks} ticks, state=${result.end.state}, score=${result.end.score}`);
  return result;
}

try {
  report('== 1/7 typecheck =='); run('node_modules/typescript/bin/tsc', ['--noEmit']); report('OK');
  report('== 2/7 unit tests and architecture ==');
  const tests = run('node_modules/vitest/vitest.mjs', ['run', '--reporter=default', '--reporter=json', '--outputFile.json=docs/proof/phase-2/tests.json']);
  writeFileSync(resolve(PROOF, 'unit-tests.txt'), tests.replace(/\u001b\[[0-9;]*m/g, ''));
  report(tests.split('\n').filter((l) => /Test Files|Tests /.test(l)).join('\n'));
  report('== 3/7 production web and headless build ==');
  const web = run('node_modules/vite/bin/vite.js', ['build']); writeFileSync(resolve(PROOF, 'build-web.txt'), web);
  await build({ entryPoints: [resolve(ROOT, 'src/headless.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile: resolve(ROOT, 'dist/headless.js') }); report('OK');
  report('== 4/7 scenarios with behavioral assertions ==');
  const base = scenario('default', 1, 600, undefined, undefined, 60);
  assert.equal(base.snaps[0].motes_active, 20); assert.equal(base.snaps[0].lanterns.length, 5);
  const lit = scenario('lit', 1, 300, 'scenario-lit', 'inputs-lit', 10);
  assert.equal(lit.end.state, 'won'); assert.equal(lit.events.filter((e) => e.name === 'lantern_lit').length, 5);
  assert.equal(lit.end.score, 1298);
  const shade = scenario('shade', 1, 60, 'scenario-shade', undefined, 10);
  assert(shade.snaps.at(-1).shades[0].pos[0] < 8);
  const pulse = scenario('pulse', 1, 120, 'scenario-pulse', 'inputs-pulse', 15);
  assert.deepEqual(event(pulse, 'pulse').data.stunned_ids, ['S1']); assert.equal(pulse.end.score, 5);
  const dash = scenario('dash', 1, 12, 'scenario-dash', 'inputs-dash');
  assert.equal(dash.snaps.at(-1).player.pos[0], 2.8); assert.equal(dash.snaps.at(-1).player.pos[1], 3);
  const fall = scenario('fall', 1, 61, 'scenario-fall');
  assert.deepEqual(event(fall, 'player_hit').data, { by: 'fall', flames: 2, dropped: 0, lost: 8 });
  assert.deepEqual(fall.snaps.at(-1).player.pos, [0, 0, 0]);
  const pause = scenario('pause', 1, 70, 'scenario-pause', 'inputs-pause');
  assert.equal(pause.snaps[60].sim_tick, 0); assert.equal(pause.snaps[60].state, 'paused');
  assert.equal(pause.snaps.at(-1).sim_tick, 8); assert(event(pause, 'resumed'));
  const charm = scenario('charm', 2, 40, 'scenario-charm', 'inputs-charm');
  assert(event(charm, 'charm_picked')); assert.equal(charm.events.filter((e) => e.name === 'dash').length, 2);
  const drifter = scenario('drifter', 2, 122, 'scenario-drifter', 'inputs-drifter');
  assert(event(drifter, 'drifter_steal')); assert.equal(event(drifter, 'drifter_drop').data.amount, 3);
  assert.equal(drifter.snaps.at(-1).drifters.length, 0);
  const spring = scenario('spring', 2, 86, 'scenario-spring', undefined, 2);
  assert.equal(spring.snaps.at(-1).player.grounded, true); assert(spring.snaps.at(-1).player.pos[0] > 42);
  const tier = scenario('tier-spring', 3, 60, 'scenario-tier-spring', undefined, 2);
  assert.equal(tier.snaps.at(-1).player.pos[1], 6); assert.equal(tier.snaps.at(-1).player.grounded, true);
  const spawn = scenario('spawn', 1, 780, 'scenario-spawn', undefined, 60);
  assert.deepEqual(spawn.events.filter((e) => e.name === 'shade_spawned').map((e) => e.tick), [300, 300, 780]);
  const wind = scenario('wind', 3, 2100, 'scenario-wind', undefined, 60);
  assert.equal(wind.snaps.find((s) => s.tick === 1800).wind.active, true); assert.equal(wind.snaps.at(-1).wind.active, false);
  report('== 5/7 byte determinism across all three nights ==');
  for (const night of [1, 2, 3]) {
    const args = ['--seed', '12345', '--night', String(night), '--ticks', '21600', '--snapshot-every', '600', '--scenario', 'tests/scenarios/scenario-benchmark.json'];
    const a = headless(args, `det-night${night}-a.jsonl`, { proof: false });
    const b = headless(args, `det-night${night}-b.jsonl`, { proof: false });
    assert(a.bytes.equals(b.bytes)); report(`OK night ${night}: byte-identical (${a.bytes.length} bytes)`);
  }
  report('== 6/7 invalid inputs, scenario and CLI => exit 2 ==');
  const invalid = [
    ['--inputs', 'bad-inputs.json', { frames: [{ tick: 5 }, { tick: 3 }] }],
    ['--scenario', 'bad-scenario.json', { player: [] }],
    ['--scenario', 'bad-json.json', '{broken'],
  ];
  for (const [flag, name, payload] of invalid) {
    const path = resolve(ART, name); writeFileSync(path, typeof payload === 'string' ? payload : JSON.stringify(payload));
    let caught;
    try { execFileSync(process.execPath, [resolve(ROOT, 'dist/headless.js'), '--seed', '1', '--night', '1', '--ticks', '10', flag, path, '--out', resolve(ART, 'bad.jsonl')], { cwd: ROOT, stdio: 'pipe' }); }
    catch (err) { caught = err; }
    assert.equal(caught?.status, 2); assert.equal(String(caught.stdout), ''); assert(String(caught.stderr).length > 0); report(`OK ${name}: exit 2, clean stdout`);
  }
  report('== 7/7 full night benchmark (21600 gameplay ticks, <=30 s) ==');
  const start = performance.now();
  const benchmark = headless(['--seed', '42', '--night', '3', '--ticks', '21600', '--snapshot-every', '600', '--scenario', 'tests/scenarios/scenario-benchmark.json'], 'run-benchmark.jsonl');
  const seconds = (performance.now() - start) / 1000;
  assert.equal(benchmark.end.ticks, 21600); assert.equal(benchmark.snaps.at(-1).sim_tick, 21600); assert(seconds <= 30);
  const perf = { seconds, limitSeconds: 30, ticks: 21600, simTicks: 21600, node: process.version, os: `${platform()} ${release()}`, cpu: cpus()[0]?.model, cores: cpus().length, renderer: 'none (headless core)' };
  writeFileSync(resolve(PROOF, 'performance-headless.json'), JSON.stringify(perf, null, 2) + '\n');
  report(`OK 21600 sim ticks: ${seconds.toFixed(3)} s <= 30 s`);
  report('== verify passed ==');
} catch (err) { report(`FAIL: ${err.stack ?? err}`); process.exitCode = 1; }
