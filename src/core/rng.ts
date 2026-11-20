/**
 * PRNG tất định (mulberry32).
 * TUYỆT ĐỐI không dùng Math.random trong core: mọi lần random phải đi qua đây
 * để cùng --seed cho cùng output.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // seed âm cũng hợp lệ -> chuẩn hoá về uint32
    this.state = seed >>> 0;
  }

  /** Trả về số thực trong [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Số thực trong [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Số nguyên trong [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}
