# Bằng chứng Phase 4 / Contract 1.3

Các file là output lệnh và ảnh của chương trình thật, không phải số liệu mẫu.
Không ghi đè bằng chứng Phase1–3. Tuning/luậtv1.2 giữ nguyên.

| Yêu cầu | Bằng chứng thực |
|---|---|
| Unit/contract/architecture | unit-tests.txt, tests.json:160/160test,12file; không skip |
| Scenario gameplay | verify-output.txt và23run-*.jsonl có assertion |
| Hồi quy/tất định | verify:24trace Phase3 khớp từngbyte;3Đêm hai lần giống byte |
| Tốc độ headless | performance-headless.json:18.000simtick, dưới30giây |
| Benchmark cửa sổ thật | [bench.json](../../../bench.json), [rawdt](../../../bench.frames.json), [metadata](../../../bench.metadata.json), [ảnh](../../../bench.png) |
| Soak10Đêm | [soak.json](../../../soak.json), bản sao ở đây; crashes0, RSS<1,2× |
| GUI/accessibility | gui-output.txt, gui-checks.json:58check; screenshots/ |
| Lưu điểm/CLI | export-leaderboard.json, package-export.json và package-validation.txt |
| Cài sạch≤3lệnh | clean-install.txt: npm ci → npm run build → npm start; web/API200 |
| ZIP không node_modules | package-validation.txt: native unzip/manifest, input/game, restart server, export/headless/soak |
| Demo<5phút | [demoMP4](../../demo/demo.mp4), metadata/validation JSON và ảnh decode demo-*s |
| Retro1–2trang | [HTML2trangA4](../../retro.html), retro-layout.json và ảnhretro-page-* |

## Cách tái hiện

```bash
npm test
npm run build
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
bash scripts/verify.sh
npm run test:gui
npm run test:clean
npm run package
node scripts/validate-package.mjs
npm run demo
node scripts/validate-video.mjs
```

Không chạy quay video/test khác đồng thời với benchmark để tránh ảnh hưởng phép đo.
GUI/fixture có ghi nhãn: đặt core Scenario cho drain/relight/capacity và tick
bình minh; không giả là đã tự chơi thắng ba Đêm bằng tay. Phần chơi đầu video
dùng input bàn phím thật vào game. Test audio xác nhận AudioContext/SFX dispatch,
chưa có đánh giá bằng tai. Test ẩn của giảng viên không có để tự chạy.

## Phương pháp đo

Benchmark visibleChrome,1280×720, warmup3s rồi đúng30s, vsync/frame-limitflags
trong metadata. Đủ5đèn, L1–L3sáng100dầu,200wander/100motes; Mây0 đứng yên.
Đo rawdt tạiRAF, p1-low từceil(1%N)dt lớn nhất, p95 nearest-rank; cắt dt tại
hai ranh thời gian. RSSnull vì web nhiều tiến trình. Máy local i5-11400H,
Windows11build26200, Chrome157, IntelUHD quaANGLE; số liệu không thay máy chấm.

Soak1process,10nights seed7+i/index0, vòng1→2→3, input PRNG theo ticket.
Lệnh công khai `node --jitless --expose-gc dist/soak.js`: interpreter V8 tránh
RSS JIT, GC tại2mốc đo. Không trừ RSS hoặc bơm baseline.10kết quả lost là
kết thúc thực của input ngẫu nhiên; không ép won. Xem assumptions-phase-4.

## Trạng thái phát hành

ZIP chạy được trong `artifacts/release/dao-den-long-v1.0.0.zip` và SHA256SUMS.txt.
Workflow `.github/workflows/release.yml` chuẩn bị đính kèm ZIP/demo/bench/soak
khi tagv1.0.0 được push lên repo cá nhân. **Chưa xuất bản GitHub Release**:
remote hiện là repo mẫu `VinUni-AI20k/K5-L3-LAB-Day12-AI-SDLC`, chưa nhận URL
repo cá nhân/kết nối có quyền ghi. Không push nhầm repo lớp hoặc giả URLrelease.
Tag local và artifact không chứng minh repo cá nhân đã public hay Actions đã chạy.
