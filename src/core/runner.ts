/**
 * Bộ chạy headless theo Test Contract v1.1.
 * Tách khỏi CLI để test được bằng vitest.
 */

import { GameSim, round3 } from './sim';
import { parseInputs, parseScenario, toFrame, type InputFile, type Scenario } from './io';
import type { FrameInput, GameEvent, Snapshot } from './types';

export interface RunOptions {
  seed: number;
  night: number;
  ticks: number;
  snapshotEvery: number;
  scenario?: Scenario;
  inputs?: InputFile;
}

export interface RunResult {
  /** Các dòng JSONL theo đúng thứ tự ghi ra file. */
  lines: string[];
  state: 'playing' | 'won' | 'lost' | 'paused';
  score: number;
  ticks: number;
}

function inputReader(inputs: InputFile | undefined): (tick: number) => FrameInput {
  const base: FrameInput = {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
  let cursor = 0;
  return (tick) => {
    const frames = inputs?.frames ?? [];
    while (cursor < frames.length && (frames[cursor].tick ?? cursor) <= tick) {
      const f = frames[cursor++];
      if (f.move) base.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) base.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) base.jump = f.jump;
      if (f.interact !== undefined) base.interact = f.interact;
      if (f.pulse !== undefined) base.pulse = f.pulse;
      if (f.dash !== undefined) base.dash = f.dash;
      if (f.pause !== undefined) base.pause = f.pause;
    }
    return base;
  };
}

function eventLine(tick: number, ev: GameEvent): string {
  return JSON.stringify({ type: 'event', tick, name: ev.name, data: ev.data });
}

export function runHeadless(opts: RunOptions): RunResult {
  const sim = new GameSim({ seed: opts.seed, night: opts.night, scenario: opts.scenario });
  const lines: string[] = [];
  const every = Math.max(1, Math.floor(opts.snapshotEvery));

  // Snapshot tick 0: trạng thái sau khi dựng scenario, TRƯỚC khi áp input.
  lines.push(JSON.stringify(sim.snapshot()));
  const frameAt = inputReader(opts.inputs);

  for (let k = 0; k < opts.ticks; k++) {
    const input = frameAt(k);
    const events = sim.step(input);
    const tick = sim.steps; // = k + 1
    for (const ev of events) lines.push(eventLine(tick, ev));

    if (tick % every === 0) {
      lines.push(JSON.stringify(sim.snapshot()));
    }
  }

  const end = {
    type: 'end',
    ticks: sim.steps,
    state: sim.state,
    score: sim.score,
  };
  lines.push(JSON.stringify(end));

  return { lines, state: sim.state, score: sim.score, ticks: sim.steps };
}

/** Chạy và trả về các object đã parse (tiện cho test). */
export function runHeadlessParsed(opts: RunOptions): { objects: unknown[]; result: RunResult } {
  const result = runHeadless(opts);
  return { objects: result.lines.map((l) => JSON.parse(l) as unknown), result };
}

export { parseInputs, parseScenario, toFrame };
export type { Snapshot };
export { round3 };
