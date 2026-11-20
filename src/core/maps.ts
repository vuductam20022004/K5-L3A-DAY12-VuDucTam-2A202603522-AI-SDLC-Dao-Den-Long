/**
 * Bản đồ chuẩn cho 3 Đêm (TICKET-02, Phần 2).
 *
 * Quy ước góc: đo từ trục +X, ngược chiều kim đồng hồ khi nhìn từ trên xuống,
 * trên mặt phẳng XZ. Vậy điểm ở góc θ có:
 *   x = r·cos(θ) ; z = r·sin(θ)
 */

import type { Vec3 } from './types';
import { RULES, TUNING, nightDuration } from './config';

/** Một mặt sàn có thể đứng lên. */
export interface Surface {
  id: string;
  /** Serializable geometry shared by collision and rendering. */
  shape:
    | { kind: 'disk'; cx: number; cz: number; radius: number; y: number }
    | { kind: 'rect'; x0: number; x1: number; z0: number; z1: number; y: number }
    | { kind: 'annulus'; inner: number; outer: number; y: number }
    | { kind: 'ramp'; deg: number; bottom: number; top: number; y: number; width: number };
  /** Mặt sàn có chứa điểm (x, z) không. */
  contains(x: number, z: number): boolean;
  /** Cao độ của mặt sàn tại (x, z). */
  yAt(x: number, z: number): number;
}

/** Bục nhảy (kỳ lân) đưa người chơi bắn sang đảo/ tầng khác. */
export interface SpringDef {
  id: string;
  pos: Vec3;
  radius: number;
  /** Vận tốc Y lúc bắn (m/s). */
  vy: number;
  /** Vận tốc ngang (m/s). */
  horizontal: number;
  /** Hướng ngang (đơn vị, trên XZ). */
  dir: [number, number];
}

/** Bùa Gió. */
export interface CharmDef {
  id: string;
  pos: Vec3;
}

/** Vật cản đứng (không leo được): hình tròn trên một mặt sàn. */
export interface BlockerDef {
  id: string;
  x: number;
  z: number;
  radius: number;
  /** Cao độ mặt sàn mà vật cản nằm trên đó. */
  y: number;
  height: number;
}

export interface NightMap {
  night: number;
  /** Tên đảo. */
  name: string;
  /** Lời của Ông Đăng khi giới thiệu đêm. */
  og: string;
  durationS: number;
  surfaces: Surface[];
  blockers: BlockerDef[];
  lanterns: Array<{ id: string; pos: Vec3 }>;
  /** Các điểm sinh đom đóm (nguồn cho 20 con đầu và các lượt sinh sau). */
  motePoints: Vec3[];
  /** Các điểm sinh Bóng Mực. */
  shadePoints: Vec3[];
  charms: CharmDef[];
  springs: SpringDef[];
  windEnabled: boolean;
  shadeSpeed: number;
  /** Chu kỳ sinh Bóng Mực (tick). */
  shadeIntervalTicks: number;
  maxShades: number;
  /** Chu kỳ sinh Gió Lạc (tick). */
  drifterIntervalTicks: number;
}

const DEG = Math.PI / 180;

function polar(r: number, deg: number): Vec3 {
  const a = deg * DEG;
  return { x: r * Math.cos(a), y: 0, z: r * Math.sin(a) };
}

function disk(id: string, cx: number, cz: number, radius: number, y: number): Surface {
  return {
    id,
    shape: { kind: 'disk', cx, cz, radius, y },
    contains: (x, z) => Math.hypot(x - cx, z - cz) <= radius,
    yAt: () => y,
  };
}

function rect(id: string, x0: number, x1: number, z0: number, z1: number, y: number): Surface {
  return {
    id,
    shape: { kind: 'rect', x0, x1, z0, z1, y },
    contains: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
    yAt: () => y,
  };
}

/** Vành khăn: bán kính trong..ngoài, giới hạn z > 0 (nửa phía Bắc). */
function halfAnnulus(
  id: string,
  rInner: number,
  rOuter: number,
  y: number,
): Surface {
  return {
    id,
    shape: { kind: 'annulus', inner: rInner, outer: rOuter, y },
    contains: (x, z) => {
      const r = Math.hypot(x, z);
      return r >= rInner && r <= rOuter && z > 0;
    },
    yAt: () => y,
  };
}

/**
 * Dốc thẳng rộng `width` m, dọc theo bán kính tại góc `deg`:
 * chân dốc ở bán kính `rBottom` (y = 0), đỉnh dốc ở `rTop` (y = yTop).
 */
function radialRamp(
  id: string,
  deg: number,
  rBottom: number,
  rTop: number,
  yTop: number,
  width: number,
): Surface {
  const centre = deg * DEG;
  const halfArc = width / 2; // mét trên cung tròn
  return {
    id,
    shape: { kind: 'ramp', deg, bottom: rBottom, top: rTop, y: yTop, width },
    contains: (x, z) => {
      const r = Math.hypot(x, z);
      if (r < rTop || r > rBottom) return false;
      let diff = (Math.atan2(z, x) - centre) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) * r <= halfArc;
    },
    yAt: (x, z) => {
      const r = Math.hypot(x, z);
      const t = (rBottom - r) / (rBottom - rTop);
      return Math.max(0, Math.min(1, t)) * yTop;
    },
  };
}

function norm(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

// ---------------------------------------------------------------- Đêm 1

const NIGHT1_MOTE_POINTS: Vec3[] = [
  ...Array.from({ length: 8 }, (_, i) => polar(12, i * 45)),
  ...Array.from({ length: 16 }, (_, i) => polar(33, i * 22.5)),
];

const NIGHT1_SHADE_POINTS: Vec3[] = Array.from({ length: 12 }, (_, i) =>
  polar(37, 15 + i * 30),
);

const NIGHT1: NightMap = {
  night: 1,
  name: 'Đảo Bến',
  og: 'Đêm nay sương đen đã nuốt hết ánh sáng của Đảo Bến. Mây, đi gom đom đóm và thắp lại năm Đèn Lồng Lớn giúp ta nhé.',
  durationS: nightDuration(1),
  surfaces: [disk('dao-ben', 0, 0, 40, 0)],
  blockers: [],
  lanterns: [
    { id: 'L1', pos: { x: 0, y: 0, z: 25 } },
    { id: 'L2', pos: { x: 23.8, y: 0, z: 7.7 } },
    { id: 'L3', pos: { x: 14.7, y: 0, z: -20.2 } },
    { id: 'L4', pos: { x: -14.7, y: 0, z: -20.2 } },
    { id: 'L5', pos: { x: -23.8, y: 0, z: 7.7 } },
  ],
  motePoints: NIGHT1_MOTE_POINTS,
  shadePoints: NIGHT1_SHADE_POINTS,
  charms: [],
  springs: [],
  windEnabled: false,
  shadeSpeed: TUNING.shade_speed,
  shadeIntervalTicks: RULES.shade_intervals[0],
  maxShades: RULES.shade_limits[0],
  drifterIntervalTicks: RULES.drifter_spawn_interval_ticks,
};

// ---------------------------------------------------------------- Đêm 2

const ISLAND_B_X = 70;
const ISLAND_B_R = 28;

const NIGHT2_MOTE_POINTS: Vec3[] = [
  ...Array.from({ length: 4 }, (_, i) => polar(10, i * 90)),
  ...Array.from({ length: 8 }, (_, i) => polar(22, i * 45)),
  ...Array.from({ length: 4 }, (_, i) => {
    const p = polar(10, i * 90);
    return { x: p.x + ISLAND_B_X, y: 0, z: p.z };
  }),
  ...Array.from({ length: 8 }, (_, i) => {
    const p = polar(22, i * 45);
    return { x: p.x + ISLAND_B_X, y: 0, z: p.z };
  }),
];

const NIGHT2_SHADE_POINTS: Vec3[] = [
  ...Array.from({ length: 8 }, (_, i) => polar(26, 22.5 + i * 45)),
  ...Array.from({ length: 8 }, (_, i) => {
    const p = polar(26, 22.5 + i * 45);
    return { x: p.x + ISLAND_B_X, y: 0, z: p.z };
  }),
];

const NIGHT2: NightMap = {
  night: 2,
  name: 'Đảo Cau',
  og: 'Hai hòn đảo nối bằng cây cầu tre. Bục nhảy ở giữa sẽ bắn Mây sang đảo bên kia — đừng ngã xuống biển mây!',
  durationS: nightDuration(2),
  surfaces: [
    disk('dao-cau-a', 0, 0, 28, 0),
    disk('dao-cau-b', ISLAND_B_X, 0, ISLAND_B_R, 0),
    rect('cau-tre', 26, 44, -2, 2, 0),
  ],
  blockers: [],
  lanterns: [
    { id: 'L1', pos: { x: 0, y: 0, z: 20 } },
    { id: 'L2', pos: { x: 17, y: 0, z: -10 } },
    { id: 'L3', pos: { x: -17, y: 0, z: -10 } },
    { id: 'L4', pos: { x: 70, y: 0, z: 20 } },
    { id: 'L5', pos: { x: 87, y: 0, z: -10 } },
    { id: 'L6', pos: { x: 53, y: 0, z: -10 } },
  ],
  motePoints: NIGHT2_MOTE_POINTS,
  shadePoints: NIGHT2_SHADE_POINTS,
  charms: [{ id: 'C1', pos: { x: 35, y: 0, z: 0 } }],
  springs: [
    {
      id: 'SP1',
      pos: { x: 20, y: 0, z: 18 },
      radius: RULES.spring_radius,
      vy: RULES.night2_spring_vy,
      horizontal: RULES.night2_spring_horizontal,
      dir: norm(ISLAND_B_X - 20, 0 - 18),
    },
    {
      id: 'SP2',
      pos: { x: 50, y: 0, z: -18 },
      radius: RULES.spring_radius,
      vy: RULES.night2_spring_vy,
      horizontal: RULES.night2_spring_horizontal,
      dir: norm(0 - 50, 0 - -18),
    },
  ],
  windEnabled: false,
  shadeSpeed: TUNING.shade_speed,
  shadeIntervalTicks: RULES.shade_intervals[1],
  maxShades: RULES.shade_limits[1],
  drifterIntervalTicks: RULES.drifter_spawn_interval_ticks,
};

// ---------------------------------------------------------------- Đêm 3

const NIGHT3_MOTE_POINTS: Vec3[] = [
  ...Array.from({ length: 18 }, (_, i) => polar(34, i * 20)),
  ...Array.from({ length: 8 }, (_, i) => {
    const p = polar(18, 20 + i * 20);
    return { x: p.x, y: 3, z: p.z };
  }),
  ...Array.from({ length: 4 }, (_, i) => {
    const p = polar(5, 45 + i * 90);
    return { x: p.x, y: 6, z: p.z };
  }),
];

const NIGHT3_SHADE_POINTS: Vec3[] = Array.from({ length: 16 }, (_, i) =>
  polar(43, i * 22.5),
);

const NIGHT3: NightMap = {
  night: 3,
  name: 'Đảo Chuông',
  og: 'Ba tầng, một tháp chuông ở đỉnh. Gió mạnh sẽ đẩy Mây trôi — hãy nhảy bục lên tầng trên cùng trước khi gió tới.',
  durationS: nightDuration(3),
  surfaces: [
    disk('tang-0', 0, 0, 45, 0),
    halfAnnulus('tang-1', 12, 24, 3),
    disk('tang-2', 0, 0, 8, 6),
    radialRamp('doc-30', 30, 30, 24, 3, 3),
    radialRamp('doc-150', 150, 30, 24, 3, 3),
  ],
  blockers: [{ id: 'thap-chuong', x: 0, z: 0, radius: 2, y: 6, height: 8 }],
  lanterns: [
    { id: 'L1', pos: { x: 0, y: 6, z: 6 } },
    { id: 'L2', pos: { x: 18, y: 3, z: 10 } },
    { id: 'L3', pos: { x: -18, y: 3, z: 10 } },
    { id: 'L4', pos: { x: 35, y: 0, z: -10 } },
    { id: 'L5', pos: { x: -35, y: 0, z: -10 } },
    { id: 'L6', pos: { x: 20, y: 0, z: -35 } },
    { id: 'L7', pos: { x: -20, y: 0, z: -35 } },
  ],
  motePoints: NIGHT3_MOTE_POINTS,
  shadePoints: NIGHT3_SHADE_POINTS,
  charms: [
    { id: 'C1', pos: { x: 30, y: 0, z: 25 } },
    { id: 'C2', pos: { x: -30, y: 0, z: 25 } },
  ],
  springs: [
    {
      id: 'SP1',
      pos: { x: 0, y: 3, z: 13 },
      radius: RULES.spring_radius,
      vy: RULES.night3_spring_vy,
      horizontal: RULES.night3_spring_horizontal,
      dir: [0, -1],
    },
  ],
  windEnabled: true,
  shadeSpeed: RULES.night3_shade_speed,
  shadeIntervalTicks: RULES.shade_intervals[2],
  maxShades: RULES.shade_limits[2],
  drifterIntervalTicks: RULES.drifter_spawn_interval_ticks,
};

export const MAPS: Record<number, NightMap> = { 1: NIGHT1, 2: NIGHT2, 3: NIGHT3 };

export function getMap(night: number): NightMap {
  return MAPS[night] ?? NIGHT1;
}

/**
 * Cao độ mặt sàn cao nhất tại (x, z) nhưng không vượt quá `ceiling`.
 * Trả về null nếu không có mặt sàn nào (rơi xuống biển mây).
 */
export function supportY(map: NightMap, x: number, z: number, ceiling: number): number | null {
  let best: number | null = null;
  for (const s of map.surfaces) {
    if (!s.contains(x, z)) continue;
    const y = s.yAt(x, z);
    if (y > ceiling + 1e-6) continue;
    if (best === null || y > best) best = y;
  }
  return best;
}

/** Mặt sàn cao nhất tại (x,z) bất kể ceiling (dùng để render). */
export function topSurfaceY(map: NightMap, x: number, z: number): number | null {
  let best: number | null = null;
  for (const s of map.surfaces) {
    if (!s.contains(x, z)) continue;
    const y = s.yAt(x, z);
    if (best === null || y > best) best = y;
  }
  return best;
}
