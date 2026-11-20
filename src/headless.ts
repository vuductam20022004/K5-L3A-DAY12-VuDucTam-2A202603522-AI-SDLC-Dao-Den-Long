#!/usr/bin/env node
/**
 * Entry point headless theo Test Contract v1.1.
 *
 *   node dist/headless.js --seed <int> --night <1|2|3> [--scenario <file.json>]
 *                         [--inputs <file.json>] --ticks <int> --out <file.jsonl>
 *                         [--snapshot-every <int, mặc định 10>]
 *
 * Exit code: 0 = thành công, 2 = file inputs/scenario sai định dạng,
 *            khác 0 = lỗi khác (ghi message ra stderr).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { runHeadless } from './core/runner';
import { InvalidInputError, parseInputs, parseScenario } from './core/io';

interface Args {
  seed: number;
  night: number;
  ticks: number;
  out: string;
  snapshotEvery: number;
  scenario?: string;
  inputs?: string;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
  const allowed = new Set(['--seed', '--night', '--ticks', '--out', '--snapshot-every', '--scenario', '--inputs']);
  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!allowed.has(key) || seen.has(key)) throw new UsageError(`tham số không hợp lệ hoặc trùng: ${key}`);
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--') || !argv[i + 1].trim()) {
      throw new UsageError(`thiếu giá trị ${key}`);
    }
    seen.add(key);
  }
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const seedRaw = get('--seed');
  const nightRaw = get('--night');
  const ticksRaw = get('--ticks');
  const out = get('--out');
  const snapRaw = get('--snapshot-every');

  if (seedRaw === undefined) throw new UsageError('thiếu --seed');
  if (nightRaw === undefined) throw new UsageError('thiếu --night');
  if (ticksRaw === undefined) throw new UsageError('thiếu --ticks');
  if (out === undefined) throw new UsageError('thiếu --out');

  const seed = Number(seedRaw);
  const night = Number(nightRaw);
  const ticks = Number(ticksRaw);
  const snapshotEvery = snapRaw === undefined ? 10 : Number(snapRaw);

  if (!Number.isInteger(seed)) throw new UsageError('--seed phải là số nguyên');
  if (!Number.isInteger(night) || night < 1 || night > 3) {
    throw new UsageError('--night phải là 1, 2 hoặc 3');
  }
  if (!Number.isInteger(ticks) || ticks < 0) throw new UsageError('--ticks phải là số nguyên >= 0');
  if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
    throw new UsageError('--snapshot-every phải là số nguyên >= 1');
  }

  return {
    seed,
    night,
    ticks,
    out,
    snapshotEvery,
    scenario: get('--scenario'),
    inputs: get('--inputs'),
  };
}

function readJsonFile(path: string, label: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new InvalidInputError(`không đọc được file ${label} "${path}": ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
  } catch (err) {
    throw new InvalidInputError(`file ${label} "${path}" không phải JSON hợp lệ: ${(err as Error).message}`);
  }
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));

  const scenario = args.scenario ? parseScenario(readJsonFile(args.scenario, 'scenario')) : undefined;
  const inputs = args.inputs ? parseInputs(readJsonFile(args.inputs, 'inputs')) : undefined;

  const result = runHeadless({
    seed: args.seed,
    night: args.night,
    ticks: args.ticks,
    snapshotEvery: args.snapshotEvery,
    scenario,
    inputs,
  });

  writeFileSync(args.out, result.lines.join('\n') + '\n', 'utf8');
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  if (err instanceof InvalidInputError) {
    process.stderr.write(`[contract] input/scenario sai định dạng: ${err.message}\n`);
    process.exitCode = 2;
  } else if (err instanceof UsageError) {
    process.stderr.write(`[contract] ${err.message}\n`);
    process.exitCode = 2;
  } else {
    process.stderr.write(`[contract] lỗi: ${(err as Error).stack ?? String(err)}\n`);
    process.exitCode = 1;
  }
}
