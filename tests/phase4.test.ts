import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { benchmarkScene } from '../src/core/benchmark';
import { frameStatistics } from '../src/shared/benchmark-stats';
import { rankEntries, validateEntry } from '../src/shared/leaderboard';
import { LeaderboardStore } from '../src/server/leaderboard-store';
import { DEFAULT_BINDINGS,parseBindings,setBinding } from '../src/render/bindings';
import { readMoveInput } from '../src/render/input';
import { parseSettings } from '../src/render/settings';

describe('accessible persistent controls',()=>{
  it('rebinds movement and removes the former key',()=>{
    const b=setBinding({...DEFAULT_BINDINGS},'forward','i');
    expect(readMoveInput(new Set(['i']),b)).toEqual([0,1]);expect(readMoveInput(new Set(['w']),b)).toEqual([0,0]);
  });
  it('rejects duplicate assignments including case-normalized saved data',()=>{
    expect(()=>setBinding({...DEFAULT_BINDINGS},'jump','W')).toThrow('Trùng');
    expect(parseBindings({...DEFAULT_BINDINGS,jump:'W'})).toEqual(DEFAULT_BINDINGS);
  });
  it('migrates settings and persists motion, font and bindings',()=>{
    const saved={volume:0.2,reducedMotion:true,largeText:true,bindings:setBinding({...DEFAULT_BINDINGS},'pulse','x')};
    expect(parseSettings(JSON.stringify(saved))).toMatchObject(saved);
    expect(parseSettings('{"volume":0.2}').bindings).toEqual(DEFAULT_BINDINGS);
  });
});

describe('canonical benchmark isolation',()=>{
  it('has exact counts and freezes player, oil, interactions and ending',()=>{
    const sim=benchmarkScene(42);const initial=sim.snapshot();
    expect(sim.shades).toHaveLength(200);expect(sim.motes).toHaveLength(100);
    expect(sim.lanterns).toHaveLength(5);
    expect(sim.lanterns.filter(l=>!l.lit).map(l=>l.id)).toEqual(['L4','L5']);
    expect(sim.lanterns.filter(l=>l.lit).map(l=>l.id)).toEqual(['L1','L2','L3']);
    for(let i=0;i<600;i++)sim.step({move:[1,1],cam_yaw_deg:90,interact:true,pulse:true,jump:true});
    expect(sim.shades.every(s=>s.state==='wander')).toBe(true);
    expect(sim.snapshot().player.pos).toEqual([0,0,0]);expect(sim.player.carried).toBe(0);
    expect(sim.lanterns.filter(l=>l.lit).every(l=>l.fuelTicks===6000)).toBe(true);
    expect(sim.state).toBe('playing');expect(sim.motes).toHaveLength(100);expect(sim.shades).toHaveLength(200);
    expect(sim.snapshot().shades).not.toEqual(initial.shades);
  });
  it('scene generation and updates are seed deterministic',()=>{
    const a=benchmarkScene(42),b=benchmarkScene(42);for(let i=0;i<60;i++){a.step();b.step();}
    expect(a.snapshot()).toEqual(b.snapshot());expect(benchmarkScene(43).snapshot()).not.toEqual(benchmarkScene(42).snapshot());
  });
});
describe('benchmark definitions',()=>{
  it('uses the worst ceil(1%) frames and nearest-rank p95',()=>{
    const dt=[...Array(99).fill(10),100];
    expect(frameStatistics(dt)).toEqual({avg_fps:100000/1090,p1_low_fps:10,frame_ms_p95:10,frames:100});
    const result=frameStatistics([...dt,200]);expect(result.p1_low_fps).toBeCloseTo(1000/150);
  });
  it('rejects empty, zero and nonfinite samples',()=>{
    for(const samples of [[],[0],[NaN]])expect(()=>frameStatistics(samples)).toThrow();
  });
});
const entry=(name='May',score=1,time='2026-11-20T10:00:00.000Z')=>({name,score,nights_won:1,achieved_at:time,seed:7});
describe('local leaderboard',()=>{
  it('keeps top ten and breaks ties by actual instant including timezone',()=>{
    const rows=Array.from({length:15},(_,i)=>entry(`May_${i}`,i));
    rows.push(entry('early',14,'2026-11-20T11:00:00+07:00'));
    const ranked=rankEntries(rows);expect(ranked).toHaveLength(10);expect(ranked[0].name).toBe('early');expect(ranked[1].name).toBe('May_14');
  });
  it.each(['ab','too_long_name_123','<script>','Mây','has space'])('rejects invalid name %s',(name)=>{expect(()=>validateEntry(entry(name))).toThrow();});
  it('rejects invalid scores, counts, dates and seeds',()=>{
    for(const raw of [{...entry(),score:-1},{...entry(),nights_won:4},{...entry(),achieved_at:'2026-11-20T10:00:00'},{...entry(),seed:0.5}])expect(()=>validateEntry(raw)).toThrow();
  });
  it('persists through a new store instance and exports the same ordered entries',()=>{
    const dir=mkdtempSync(join(tmpdir(),'lantern-leaderboard-'));
    try{const a=new LeaderboardStore(dir);a.add(entry('Tam',100));a.add(entry('May',200));
      const b=new LeaderboardStore(dir);expect(b.read().map(e=>e.name)).toEqual(['May','Tam']);
      const out=join(dir,'export.json');b.export(out);expect(JSON.parse(readFileSync(out,'utf8'))).toEqual({entries:b.read()});
    }finally{expect(realpathSync(dir).startsWith(realpathSync(tmpdir())+sep)).toBe(true);rmSync(dir,{recursive:true,force:true});}
  });
});
