export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}
export function validateEntry(raw: unknown): LeaderboardEntry {
  if (!raw || typeof raw !== 'object') throw new Error('Mục điểm không hợp lệ');
  const e = raw as Record<string, unknown>;
  if (typeof e.name !== 'string' || !/^[A-Za-z0-9_]{3,12}$/.test(e.name)) throw new Error('Tên cần 3–12 ký tự A–Z, a–z, 0–9 hoặc _');
  if (!Number.isSafeInteger(e.score) || Number(e.score) < 0) throw new Error('Điểm phải là số nguyên không âm');
  if (!Number.isInteger(e.nights_won) || Number(e.nights_won) < 0 || Number(e.nights_won) > 3) throw new Error('Số đêm thắng phải trong 0–3');
  if (!Number.isSafeInteger(e.seed)) throw new Error('Seed không hợp lệ');
  if (typeof e.achieved_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(e.achieved_at) || !Number.isFinite(Date.parse(e.achieved_at))) throw new Error('Thời điểm cần ISO 8601 có múi giờ');
  return { name:e.name, score:Number(e.score), nights_won:Number(e.nights_won), achieved_at:e.achieved_at, seed:Number(e.seed) };
}
export function rankEntries(entries: unknown[]): LeaderboardEntry[] {
  return entries.map(validateEntry).sort((a,b) => b.score-a.score || Date.parse(a.achieved_at)-Date.parse(b.achieved_at)).slice(0,10);
}
