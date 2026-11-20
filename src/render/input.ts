/**
 * Ánh xạ phím bấm -> vector di chuyển trong không gian camera.
 *
 * Quy ước (khớp với `src/core/sim.ts`):
 *   - move[0] = trục ngang (trái/phải), move[1] = trục tới/lui.
 *   - Với `cam_yaw_deg = 0`, camera nằm ở phía -Z và nhìn về +Z:
 *       W (đi tới)  -> move = [0, +1]  -> thế giới +Z (xa camera)
 *       S (lui)     -> move = [0, -1]  -> thế giới -Z (gần camera)
 *       A (trái)    -> move = [+1, 0]  -> thế giới +X
 *       D (phải)    -> move = [-1, 0]  -> thế giới -X
 *   - Core xoay vector này theo yaw bằng đúng công thức của Test Contract:
 *       x' = x·cosθ + z·sinθ ; z' = -x·sinθ + z·cosθ
 */

export type MoveKey = 'w' | 'a' | 's' | 'd' | 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright';

export function readMoveInput(keys: Set<string>): [number, number] {
  let x = 0;
  let z = 0;
  if (keys.has('w') || keys.has('arrowup')) z += 1;
  if (keys.has('s') || keys.has('arrowdown')) z -= 1;
  if (keys.has('a') || keys.has('arrowleft')) x += 1;
  if (keys.has('d') || keys.has('arrowright')) x -= 1;
  return [x, z];
}
