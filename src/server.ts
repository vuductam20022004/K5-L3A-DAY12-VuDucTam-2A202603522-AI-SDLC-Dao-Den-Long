#!/usr/bin/env node
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LeaderboardStore } from './server/leaderboard-store';
import { localApi } from './server/local-api';

const args=process.argv.slice(2);
const value=(flag:string,fallback?:string)=>{const i=args.indexOf(flag);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Thiếu ${flag}`);return args[i+1];};
try {
  const store=new LeaderboardStore(value('--data-dir',process.env.DAO_DATA_DIR??resolve(dirname(fileURLToPath(import.meta.url)),'../data')));
  const output=value('--export-leaderboard');
  if(output) store.export(output);
  else {
    const web=resolve(dirname(fileURLToPath(import.meta.url)),'web');
    const api=localApi(store);
    const mime: Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.mp4':'video/mp4'};
    const server=createServer((req,res)=>{
      if(req.url?.startsWith('/api/')){api(req,res);return;}
      try{
        const url=new URL(req.url??'/', 'http://localhost');
        const file=resolve(web, '.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(web+sep)||!existsSync(file)||!statSync(file).isFile()){res.statusCode=404;res.end('Not found');return;}
        res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');res.end(readFileSync(file));
      }catch{res.statusCode=400;res.end('Bad request');}
    });
    server.listen(Number(value('--port','5173')),'127.0.0.1',()=>process.stdout.write(`Đảo Đèn Lồng: http://127.0.0.1:${(server.address() as {port:number}).port}\n`));
  }
} catch(e){process.stderr.write((e as Error).message+'\n');process.exitCode=2;}
