#!/usr/bin/env node
/** Seal source identity and release measurements; SHA inputs use Git-style LF. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {ROOT} from './lib/browser.mjs';
const files=[];
function scan(directory){for(const e of readdirSync(resolve(ROOT,directory),{withFileTypes:true})){const name=directory+'/'+e.name;if(e.isDirectory())scan(name);else files.push(name);}}
for(const directory of ['src','scripts','skills/verify-phase4'])scan(directory);
files.push('AGENTS.md','game.contract.json','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','docs/spec/phase-4.md','docs/notes/assumptions-phase-4.md');
const hash=data=>createHash('sha256').update(data).digest('hex');
const sources=Object.fromEntries(files.sort().map(name=>[name,hash(readFileSync(resolve(ROOT,name),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'))]));
const binary=['bench.json','bench.frames.json','bench.metadata.json','bench.png','soak.json','docs/demo/demo.mp4'];
const measurements=Object.fromEntries(binary.map(name=>[name,hash(readFileSync(resolve(ROOT,name)))]));
const summary={contract_version:'1.3',source_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),source_hash_note:'UTF-8 source normalized BOM-free LF; no binary normalization',sources,measurements,bench:JSON.parse(readFileSync(resolve(ROOT,'bench.json'),'utf8')),soak:JSON.parse(readFileSync(resolve(ROOT,'soak.json'),'utf8')),release_zip_sha256:readFileSync(resolve(ROOT,'artifacts/release/SHA256SUMS.txt'),'utf8').trim(),github_release:'Publication is verified separately in github-release.json after pushing the release tag.'};
writeFileSync(resolve(ROOT,'docs/proof/phase-4/source-and-release.json'),JSON.stringify(summary,null,2)+'\n');console.log(`Sealed ${files.length} source hashes and ${binary.length} measured artifacts`);
