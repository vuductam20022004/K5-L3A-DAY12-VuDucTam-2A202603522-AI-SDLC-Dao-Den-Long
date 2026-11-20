/**
 * Kiểu dữ liệu dùng chung cho toàn bộ game (core + render).
 * Core KHÔNG được import three/DOM.
 *
 * Contract v1.2: giữ physics/địch Phase 2; thêm dầu, drain, sức chứa tăng dần.
 */

export type Vec3 = { x: number; y: number; z: number };

export type GameState = 'playing' | 'won' | 'lost' | 'paused';

/** Trạng thái Bóng Mực — tên chuẩn theo contract v1.2. */
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';

/** Trạng thái Gió Lạc. */
export type DrifterState = 'idle' | 'chase' | 'flee';

export interface FrameInput {
  /** Vector di chuyển trong không gian camera: x ngang, z dọc. */
  move: [number, number];
  /** Góc yaw của camera, độ. */
  cam_yaw_deg: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export type MoteKind = 'random' | 'dropped';

export interface Mote {
  id: string;
  pos: Vec3;
  active: boolean;
  kind: MoteKind;
  /** TTL tính bằng tick; -1 = vĩnh cửu (đom đóm ngẫu nhiên). */
  ttlTicks: number;
}

export interface Lantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
  /** Integer units: 60 units = 1 fuel. Never round before gameplay decisions. */
  fuelTicks: number;
  everLit: boolean;
  relitCount: number;
}

export interface Shade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  /** Số tick còn lại của trạng thái hiện tại (spawning/wander/recoil/stunned). */
  stateTicksLeft: number;
  /** Tick hết choáng. */
  stunUntilTick: number;
  /** Hướng đi khi wander (đơn vị XZ). */
  wanderDir: [number, number];
  pushDir: [number, number];
  pushTicksLeft: number;
  pushPerTick: number;
  targetLanternId?: string;
  drainTicks: number;
}

export interface Drifter {
  id: string;
  pos: Vec3;
  state: DrifterState;
  /** Số đom đóm đã cướp (chưa trả lại). */
  stolen: number;
  /** Tick còn lại ở trạng thái flee. */
  stateTicksLeft: number;
}

export interface Charm {
  id: string;
  pos: Vec3;
  /** true = có mặt trên bản đồ. */
  available: boolean;
  /** Số tick còn lại trước khi hồi sinh. */
  respawnTicks: number;
}

export interface Player {
  pos: Vec3;
  /** Vận tốc hiện tại (m/s) trên từng trục. */
  vel: Vec3;
  /** Hướng nhân vật đang quay mặt (đơn vị XZ). */
  facing: [number, number];
  grounded: boolean;
  /** Sức sống / ánh sáng còn lại. */
  flames: number;
  /** Số ánh sáng (dom đóm) đang mang. */
  carried: number;
  successfulLights: number;
  /** Tick hết bất tử. */
  invulnUntilTick: number;
  /** Tick hết hồi chiêu lướt. */
  dashCdUntilTick: number;
  /** Tick hết hồi chiêu tỏa sáng. */
  pulseCdUntilTick: number;
  /** Tick hết hiệu lực bùa gió. */
  charmUntilTick: number;
  /** Đang lướt. */
  dashing: boolean;
  dashEndTick: number;
  /** Đang bay do bục nhảy (vận tốc bị khóa). */
  launched: boolean;
  /** Chờ hồi sinh sau khi rơi khỏi đảo. */
  deadUntilTick: number;
  dashSavedVy: number;
  launchVelocity: [number, number];
}

export type EventName =
  | 'mote_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'pulse'
  | 'player_hit'
  | 'shade_spawned'
  | 'game_over'
  | 'dash'
  | 'charm_picked'
  | 'drifter_steal'
  | 'drifter_drop'
  | 'night_start'
  | 'paused'
  | 'resumed'
  | 'refuel'
  | 'lantern_out'
  | 'fuel_drain';
// New events preserve existing event names and payloads where not replaced.

export interface GameEvent {
  name: EventName;
  data: Record<string, unknown>;
}

export interface Snapshot {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: GameState;
  time_left_s: number;
  score: number;
  night: number;
  player: {
    pos: [number, number, number];
    vel: [number, number, number];
    grounded: boolean;
    flames: number;
    carried: number;
    capacity: number;
    invuln: number;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: [number, number, number];
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
  }>;
  shades: Array<{
    id: string;
    pos: [number, number, number];
    state: ShadeState;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: [number, number, number];
    kind: MoteKind;
    ttl_s: number;
  }>;
  drifters: Array<{
    id: string;
    pos: [number, number, number];
    state: DrifterState;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
  }>;
  wind: { active: boolean; dir_deg: number };
}
