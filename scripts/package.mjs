#!/usr/bin/env node
/** Dependency-free reproducible STORE ZIP with CRC32 and a SHA256 manifest. */
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './lib/browser.mjs';
const directory=resolve(ROOT,'artifacts/release');mkdirSync(directory,{recursive:true});
const files=new Map();
function include(path){const full=resolve(ROOT,path);for(const item of readdirSync(full,{withFileTypes:true})){const name=`${path}/${item.name}`;item.isDirectory()?include(name):files.set(name,readFileSync(resolve(ROOT,name)));}}
include('dist');
for(const path of ['LICENSE','CREDITS.md','CHANGELOG.md','game.contract.json','scripts/bench.mjs','scripts/lib/browser.mjs'])files.set(path,readFileSync(resolve(ROOT,path)));
files.set('THIRD_PARTY/three-LICENSE.txt',readFileSync(resolve(ROOT,'node_modules/three/LICENSE')));
files.set('README.md',Buffer.from(`# Đảo Đèn Lồng v1.0.0\n\nBản web tĩnh + server Node, Contract 1.3. Cần Node.js 22+ và trình duyệt WebGL2.\nGiải nén ZIP, mở terminal tại thư mục này rồi chạy:\n\n\x60\x60\x60bash\nnode dist/server.js\n\x60\x60\x60\n\nMở http://127.0.0.1:5173. Không cần npm install. Server chỉ lắng nghe localhost.\nWASD / mũi tên di chuyển, Space nhảy, Shift lướt, E nạp/châm dầu, Q Tỏa Sáng, P/Esc tạm dừng.\nCó đổi phím, bảng màu dễ phân biệt, giảm chuyển động và chữ lớn trong Cài đặt.\nGiữ ít nhất 3/5, 4/6, 5/7 đèn sáng ở bình minh để thắng ba Đêm.\n\nBảng điểm ghi vào data/leaderboard.json (cần quyền ghi thư mục), cài đặt lưu trong trình duyệt.\nNếu nâng cấp, giữ lại thư mục data/.\n\n\x60\x60\x60bash\nnode dist/server.js --export-leaderboard out.json\nnode dist/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl\nnode scripts/bench.mjs --seed 42 --duration 30 --out bench.json\nnode --jitless --expose-gc dist/soak.js --seed 7 --nights 10 --out soak.json\n\x60\x60\x60\n\nBenchmark cần Chrome/Edge; đặt CHROME_PATH nếu không tự tìm thấy. Launcher mở cửa sổ riêng1280×720, tắt giới hạn FPS/vsync bằng flags Chromium. Web báo RSS=null. Soak dùng interpreter V8 và GC tại hai mốc đo RSS.\nMã nguồn và tài liệu đầy đủ nằm trong repo của bản Release. LICENSE MIT; xem CREDITS/THIRD_PARTY.\n`));
files.set('package.json',Buffer.from(JSON.stringify({name:'dao-den-long-release',version:'1.0.0',private:true,type:'module',engines:{node:'>=22'},scripts:{start:'node dist/server.js',headless:'node dist/headless.js',bench:'node scripts/bench.mjs',soak:'node --jitless --expose-gc dist/soak.js'}},null,2)+'\n'));
const hashes=Object.fromEntries([...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,data])=>[name,createHash('sha256').update(data).digest('hex')]));
files.set('MANIFEST.sha256.json',Buffer.from(JSON.stringify(hashes,null,2)+'\n'));
const table=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=data=>{let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunks=[],central=[];let offset=0;
for(const [name,data] of [...files].sort(([a],[b])=>a.localeCompare(b))){
  const filename=Buffer.from(name),crc=crc32(data),header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  chunks.push(header,filename,data);
  const row=Buffer.alloc(46);row.writeUInt32LE(0x02014b50,0);row.writeUInt16LE(20,4);row.writeUInt16LE(20,6);row.writeUInt16LE(0x800,8);row.writeUInt16LE(33,14);row.writeUInt32LE(crc,16);row.writeUInt32LE(data.length,20);row.writeUInt32LE(data.length,24);row.writeUInt16LE(filename.length,28);row.writeUInt32LE(offset,42);central.push(row,filename);offset+=header.length+filename.length+data.length;
}
const end=Buffer.alloc(22),directoryBytes=Buffer.concat(central);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(directoryBytes.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...chunks,directoryBytes,end]),name='dao-den-long-v1.0.0.zip';writeFileSync(resolve(directory,name),zip);
writeFileSync(resolve(directory,'SHA256SUMS.txt'),`${createHash('sha256').update(zip).digest('hex')}  ${name}\n`);
console.log(JSON.stringify({file:relative(ROOT,resolve(directory,name)),bytes:zip.length,files:files.size,sha256:createHash('sha256').update(zip).digest('hex')}));
