import type { IncomingMessage, ServerResponse } from 'node:http';
import { LeaderboardStore } from './leaderboard-store';

export function localApi(store: LeaderboardStore) {
  return (req: IncomingMessage,res: ServerResponse,next?: () => void): void => {
    if (req.url?.split('?')[0] !== '/api/leaderboard') { if(next) next(); else { res.statusCode=404; res.end(); } return; }
    res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store');
    const origin=req.headers.origin;
    try{if (origin && new URL(origin).host !== req.headers.host) throw new Error();}
    catch{res.statusCode=403;res.end(JSON.stringify({error:'Origin không hợp lệ'}));return;}
    if(req.method==='GET') {try{res.end(JSON.stringify({entries:store.read()}));}catch(e){res.statusCode=500;res.end(JSON.stringify({error:(e as Error).message}));} return;}
    if(req.method!=='POST'){res.statusCode=405;res.end(JSON.stringify({error:'Chỉ GET/POST'}));return;}
    const chunks: Buffer[]=[]; let size=0;
    req.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size<=16384)chunks.push(chunk);});
    req.on('end',()=>{try{
      if(size>16384)throw new Error('Dữ liệu quá dài');
      const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const entries=store.add({...raw,achieved_at:new Date().toISOString()});
      res.statusCode=201;res.end(JSON.stringify({entries}));
    }catch(e){res.statusCode=400;res.end(JSON.stringify({error:(e as Error).message}));}});
  };
}
