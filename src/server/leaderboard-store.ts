import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { rankEntries, validateEntry, type LeaderboardEntry } from '../shared/leaderboard';

export class LeaderboardStore {
  readonly file: string;
  constructor(directory = process.env.DAO_DATA_DIR??resolve(process.cwd(), 'data')) { this.file = resolve(directory,'leaderboard.json'); }
  read(): LeaderboardEntry[] {
    let raw: string;
    try { raw=readFileSync(this.file,'utf8'); }
    catch(e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
    const value = JSON.parse(raw);
    if (!Array.isArray(value.entries)) throw new Error('File bảng xếp hạng bị hỏng; giữ nguyên file để khôi phục');
    return rankEntries(value.entries);
  }
  add(raw: unknown): LeaderboardEntry[] {
    const entry=validateEntry(raw);
    const entries=rankEntries([...this.read(),entry]);
    mkdirSync(dirname(this.file),{recursive:true});
    const temporary=`${this.file}.${process.pid}.tmp`;
    writeFileSync(temporary,JSON.stringify({entries},null,2)+'\n','utf8');
    renameSync(temporary,this.file);
    return entries;
  }
  export(out: string): void { writeFileSync(out,JSON.stringify({entries:this.read()},null,2)+'\n','utf8'); }
}
