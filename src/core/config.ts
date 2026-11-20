/**
 * Nguồn sự thật duy nhất cho mọi con số tuning: import trực tiếp từ
 * `game.contract.json` ở gốc repo. Nhờ vậy contract không bao giờ lệch với code
 * (có test assert điều này).
 *
 * Phase 2 (TICKET-02): contract v1.1 — số chuẩn do nhà sản xuất quy định.
 */
import contractJson from '../../game.contract.json';

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  score: ScoreTuning;
}

export interface Contract {
  contract_version: string;
  team: string;
  build_cmd: string;
  run_cmd: string;
  headless_cmd: string;
  tuning: Tuning;
  rules: typeof contractJson.rules;
}

export const CONTRACT = contractJson as Contract;
export const TUNING: Tuning = CONTRACT.tuning;

/** Hằng số hình học / luật còn lại (những số này PRD/Ticket mô tả bằng lời). */
export const WORLD = {
  /** Chiều cao lơ lửng của đom đóm so với mặt sàn (m). */
  moteHoverHeight: 1.1,
} as const;

// Gameplay constants live in the contract. Derived aliases retain readable names
// without duplicating standardized tuning values.
export const RULES = {
  ...contractJson.rules,
  pulse_stun_ticks: Math.round(TUNING.pulse_stun_s * 60),
  pulse_push_total_m: TUNING.pulse_push_m,
  invuln_ticks: Math.round(TUNING.invuln_s * 60),
  charm_dash_ticks: Math.round(TUNING.dash_duration_s * 60),
  safe_radius_m: TUNING.safe_radius,
};

/** Thời lượng đêm theo night index. */
export function nightDuration(night: number): number {
  if (night === 2) return TUNING.night2_duration_s;
  if (night === 3) return TUNING.night3_duration_s;
  return TUNING.night1_duration_s;
}
