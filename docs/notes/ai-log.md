# Nhat ky dung AI

## Phase 1 — PRD-0

### Cach lam

1. Doc `README.md` / `GUIDE.md` / `CHECKPOINTS.md` / `RUBRIC.md` cua lab de hieu
   quy cach cham diem va moc thoi gian.
2. Viet **ke hoach** (ke hoach 4 phase) va **AGENTS.md** truoc khi viet code.
   AGENTS.md tom tat quy uoc contract + "cam" de agent sai it lap lai.
3. **Tach sim / render ngay tu dau**: `src/core/` la TypeScript thuan, khong DOM/three.
   Day la dieu kien de (a) chay headless, (b) bao dam tinh dinh.
4. Dung mot file `game.contract.json` lam nguon su that cho moi so tuning;
   `src/core/config.ts` import truc tiep file nay -> contract khong the lech code.
5. Viet **test truoc, code sau** cho phan logic: movement, pickup, deposit, shade,
   pulse, win/lose, format input/scenario, va tinh dinh.
6. `scripts/verify.mjs` gom 5 buoc vao mot lenh: typecheck, unit test, 4 scenario
   headless, kiem tra byte-identical giua 2 lan chay, kiem tra exit code 2.

### Nhung lan AI sai (va cach phat hien)

| # | Sai gi | Phat hien | Cach sua |
|---|---|---|---|
| 1 | Vong `for` bi "dính" vao dong `if` khi sua file bang `StrReplace` (thiếu xuống dòng) | `tsc` bao loi `Property 'shadesToSpawn' has no initializer` | Sua lai tung cho; luon chay `npm run verify` sau moi lan sua file |
| 2 | Test "thang khi tat ca den sang" viet sai: scenario chi ghi de 1 den nhung game co 5 den | Test do fail, doc lai contract: "Den khong duoc nhac toi giu nguyen" | Tach thanh 2 test: 1 den sang -> van `playing`; 5 den sang -> `won` |
| 3 | Test "khong nhat qua suc mang toi da" viet 3 dom dom nhung lai expect 5 | Test fail | Sua test cho dungvoi scenario (3 dom dom -> carried = 3) |
| 4 | Scenario pulse de Bong Muc o 8 m trong khi `pulse_radius` = 6 m | `pulse` ra voi `stunned_ids: []` | Tao scenario rieng `scenario-pulse.json` voi khoang cach 3 m |
| Bai | Loi | Phat hien | Sua |
|---|---|---|---|
| 5 | `verify.sh` goi `bash` — may Windows khong co bash | `execvpe(/bin/bash) failed` | Chuyen logic sang `verify.mjs` (Node, cross-platform), giu `verify.sh` lam wrapper cho macOS/Linux |
| 6 | `execFileSync('npx.cmd', ...)` fail voi `EINVAL` tren Windows | Error `spawnSync npx.cmd EINVAL` | Dung `shell: true` cho `.cmd` tren Windows; goi truc tiep `node_modules/.bin/*.cmd` thay vi `npx` |
| 7 | Bong Moc spawn qua gan → nguoi choi dung yen bi chet trong ~5 giay | Cho chay GUI thu, doc HUD: `flames: 0` sau 26 s | Spawn o ria dao, cach nguoi choi **it nhat 18 m**; them hoi mau +1 moi 2 s; bat tu 1.5 s → 2.5 s |
| 8 | Phim W/A/S/D di chuyen **nguoc huong** so voi huong camera | Do vi tri nhan vat truoc/sau khi giu phim: W → x=+5.28, z=+2.44 (nen co x lan) | Tach `readMoveInput` sang `src/render/input.ts`; W → move `[0, +1]` (thi +Z), A → `[+1, 0]` (thi +X). Them `tests/input.test.ts` |
| 9 | Xoay camera qua cham | Cam bien `movementX` × 0.0025 | Tach hang so `CAM_SENSITIVITY = 0.006` (nhanh gap ~2.4 lan) |
| 10 | Phai bam nut moi choi duoc (nguoi choi nghi la game hong) | `__game.sim.steps === 0` ngay sau khi mo trang | Overlay khoi dong tach thanh `#intro` tu fade; game chay ngay tu `running = true` |
| 11 | Anh chup man hinh bi den (WebGL buffer bi xoa) | `readPixels` tra `[0,0,0,0]`, `drawImage` avg = 0 | Bat `preserveDrawingBuffer: true` cho WebGLRenderer |

### Uoc tinh token / chi phi

| Hang muc | So luong | Ghi chu |
|---|---|---|
| Doc tai lieu lab + PRD-0 | ~15 k input | 5 file Markdown, doc mot lan |
| Ke hoach + AGENTS.md | ~8 k output | Viet mot lan, dung lai cho 4 phase |
| Code (core + render + test) | ~45 k output | Phan lon la file nguon, viet theo tung file nho de tranh loi tool |
| Vong verify + sua loi | ~20 k output | 11 lan loi, tat ca deu do `tsc`/test/chay thu bat ngay |
| Tong uoc tinh Phase 1 | **~95 k token** | Phan lon la do viet code + sua loi kiem chung bang browser thuc te |

### Cach tiet kiem token

- Viet plan + `AGENTS.md` **mot lan** cho ca 4 phase thay vi sua lai moi phase.
- Tach `src/core/` / `src/render/` ngay tu dau -> khong phai viet lai logic khi them tinh nang.
- Dung `src/core/config.ts` import `game.contract.json` -> khong phai sua 2 noi khi doi so tuning.
- `npm run verify` bat loi ngay, khong phai debug lai tu dau bang cach doan.
- Doc file bang `Read` dung mot lan thay vi dung `cat` / `grep` nhieu lan.

### Danh gia nhanh Phase 1

| Yeu cau PRD-0 | Trang thai | Bang chung |
|---|---|---|
| Game 3D, di/nhay, camera 3D | Dat | `docs/proof/phase-1/screenshots/` |
| Dem 1 - Dao Ben, 5 Den | Dat | snapshot headless, `lanterns` = 5 |
| Dom dom rai rac, nhat duoc | Dat | `run-default.jsonl` co event `mote_picked` |
| Nap sang, thap den, thang | Dat | `run-lit.jsonl`: `deposit` → `lantern_lit` → `game_over won/all_lit` |
| Bong Muc duoi nguoi choi | Dat | `run-shade.jsonl`: khoang cach giam dan |
| Toa sang xua Bong Muc, ton anh sang | Dat | `run-pulse.jsonl`: `pulse` voi `stunned_ids` |
| Cham Bong Muc mat mau | Dat | unit test `shades.test.ts` |
| Thang/thua, diem, HUD | Dat | dong `end` co `score`; anh HUD |
| Choi lai sau khi thang/thua | Dat | nut "Choi lai" reset state (anh) |
| Contract + headless + tinh dinh | Dat | `npm run verify` xanh, byte-identical |

## Phase 2 — tiếp tục từ bản đang dở

Nguồn yêu cầu: Ticket-02 do người dùng dán trực tiếp trong hội thoại. Agent:
OpenAI Codex. Phạm vi là Phase 2, không tự suy đoán Ticket-03/04.

### Tình trạng đầu vào và cách xử lý

- Core/config đã chuyển một phần sang v1.1, còn GUI/test/README theo v1.0.
  Lần chạy đầu: build đạt; test **34 đạt, 5 lỗi / 39**. Lưu ý đây là kết quả
  quan sát trong lần tiếp tục, không phải đánh giá lại bản Phase 1 lịch sử.
- Đọc toàn bộ mã nguồn, test, cấu hình và hướng dẫn của lab trước khi sửa.
  Ghi assumptions và acceptance criteria trước phần triển khai mới.
- Giữ tách core/render; bổ sung Campaign trong core để tổng điểm chỉ tính
  đêm thắng. Dùng geometry bản đồ chung cho va chạm và renderer.
- Sửa lịch spawn, pulse đẩy lùi, recoil của bóng, rơi/respawn, TTL, tính điểm
  nạp, timer pause, wind displacement, drifter removed/drop và input timeline.
- GUI có ba Đêm, pause/menu/cài đặt, HUD, màu chuẩn, nhạc/SFX tự tổng hợp.

### Lỗi đã phát hiện trong vòng tiếp tục

| Lỗi | Cách phát hiện | Sửa / phòng lặp |
|---|---|---|
| Schedule sinh thêm bóng ở mọi tick sau 300 | Đọc vòng due và test mốc 299/300/779/780 | Dùng mốc chính xác và modulo, assert lịch event |
| Pulse không đẩy; hit lại đẩy người chơi | Đối chiếu Ticket-02 và test vị trí | Counter push riêng của bóng, test tổng 4 m/15 tick và recoil |
| Điểm đang cộng khi nhặt, fixture dùng cost 5 | Test chuẩn hóa và scenario | Cộng khi deposit; fixture cost 10, ghi lý do thay test trong spec |
| Fixture pulse chờ 30 tick, bị đánh trước khi bấm | Test headless lỗi dù unit pulse đã qua | Kích hoạt ở tick 0 để cô lập pulse, không che lỗi bằng bỏ assertion |
| Shade bị ép từ Y=6 về Y=1 ngay khi di chuyển | Test khóa mục tiêu pulse 3D làm lộ mất lửa | Chỉ bám mặt sàn khi tâm ban đầu thực sự ở sát mặt sàn |
| Wind là gia tốc và chỉ đẩy 299 bước | Test quãng đường 2 m/s và tổng 10 m | Cộng vận tốc gió; cập nhật onset trước movement, đủ 300 bước |
| Npm.ps1 bị Execution Policy chặn | Chạy lệnh thật trong PowerShell | Dùng npm.cmd, giữ nguyên chính sách hệ thống |
| Patch chứa hai thao tác trên cùng một file bị từ chối | Công cụ apply_patch báo lỗi trước khi ghi | Gom hunk theo file; kiểm tra typecheck sau chỉnh sửa |
| Kỳ vọng điểm scenario viết nhầm 1398 | Verify assert fail; tính lại 50+500+598+150 | Sửa thành 1298, không sửa output chương trình |
| CUA/browser host và native pipe không kết nối | Thử lại theo skill vẫn báo lỗi | Harness Chrome riêng bằng CDP, không dùng profile người dùng |
| Python validator không có runtime | python/py báo không có runtime | Kiểm tra frontmatter/tên/mô tả/path bằng Node, ghi rõ fallback |

### Kiểm chứng và giới hạn

- Unit/contract/architecture: 101 test đạt; không skip test cũ.
- Verify: 13 scenario có assertion; ba Đêm byte-identical; malformed input
  trả 2 và stdout sạch; full-night 21.600 sim tick dưới 30 giây.
- GUI: 31 check trong Chrome headless, ảnh thực 1280×720, FPS và cấu hình
  máy lưu trong `performance-gui.json`. Dùng fixture rõ ràng cho vị trí xem
  bản đồ, timer cảnh báo, thử thua và all-lit để kiểm tra chuỗi màn hình.
- Âm thanh kiểm tra được AudioContext chạy và SFX dispatch; chưa có đánh giá
  bằng tai. FPS cửa sổ thường và Docker chưa được đo. Không có test ẩn của
  giảng viên để xác nhận. Không tự ghi các mục này thành đạt.
- Khi bắt đầu, repo chưa có tag phase-1 hay phase-2; không dựng lại một tag
  Phase 1 giả từ mã đã chuyển sang Phase 2.

### Token và retro ngắn

Ước tính vòng tiếp tục khoảng **45–65k token**, dựa trên lượng mã/tài liệu và
các lượt công cụ; không phải thống kê hóa đơn. Giữ cấu trúc sẵn có, không
thêm dependency cho âm thanh/GUI test; dùng Node có sẵn để kiểm chứng.

Hiệu quả nhất: test các mốc tick và quãng đường cụ thể trước khi nối GUI;
test xanh chưa đủ, ảnh và input trình duyệt phát hiện sai lệch camera/HUD.
Nếu làm lại, giữ một baseline Phase 1 đã commit/tag trước khi sửa contract,
và viết fixture theo từng hành vi để tránh kẻ địch làm nhiễu test hiệu ứng.

## Phase 3 — Ticket-03: Đèn cạn dầu

Nguồn: Ticket-03 người dùng cung cấp trực tiếp. Baseline: tag `phase-2`,
commit `7119666`. Tiếp tục dùng OpenAI Codex; không triển khai Phase 4.

### Quyết định và hồi quy

- Viết ADR-003, assumptions và acceptance criteria trước khi sửa core.
- Lưu fuel bằng số nguyên đơn vị1/60. Bước2 gom hao tự nhiên + tất cả drain,
  xét out trước input nạp; chỉ làm tròn khi xuất, điểm dùng floor dầu thật.
- Đổi sang thắng tại bình minh; no_flames ưu tiên cuối tick. Refuel, cost5
  thắp lại, counter successful_lights/capacity, điểm mới đều nằm trong core.
- Scenario/JSONL lênv1.2; parse và validate thêm các trường mới.
- GUI đọc helper core cho cost, chọn đèn nhận và capacity; thêm fuel bar,
  nhấp nháy1Hz, hình đèn xẹp/rách, bảng màu dễ phân biệt lưu localStorage.
- 101 test cũ vẫn chạy, cập nhật kỳ vọng của đúng các luật ticket thay thế.
  Thêm42 test core Phase3 và1 test settings; tổng144. Không dùng skip/todo.
- Fixture nhiều đèn đặt cùng chỗ không còn phù hợp để test thắp tất cả:
  đèn vừa sáng gần nhất có thể nhận dầu, nên E sẽ châm nó. Fixture mới kiểm
  chứng deposit rồi refuel; các fixture dawn riêng kiểm chứng thắng/thua.

### Lỗi phát hiện và sửa

| Vấn đề | Bằng chứng phát hiện | Cách xử lý |
|---|---|---|
| Test "thắp tick cuối" đặt hai đèn sáng gần hơn đèn cần thắp | Test fail, event là refuel đúng luật mới | Dời hai đèn sáng ra xa; giữ assertion lựa chọn đèn, không sửa core cho khớp fixture sai |
| Điểm bình minh có nguy cơ dùng fuel đã làm tròn100 thay dầu thật99.983 | Test floor(fuel) đòi597, không600 cho3 đèn | Tính floor trực tiếp từ fuelTicks/60 |
| Drain bị generic counter coi như trạng thái có hạn | Review counter của Phase2 | Loại drain khỏi nhánh hết hạn, chỉ rời drain theo điều kiện ticket |
| Thanh dầu lệch khỏi tâm khi xoay camera | Xem ảnh GUI thật | Dùng nền sprite ở tâm, mép trái fill theo trục phải camera; cập nhật camera trước sync |
| Toast đè lời nhắc E | Ảnh lantern-out/relit | Nâng toast lên, chụp kiểm tra lại |
| BOM khiến patch README đầu file không khớp | Tool từ chối trước khi sửa | Patch đúng BOM và lưu UTF-8; không đổi execution policy |

### Kiểm chứng

- `npm.cmd test` rồi Git Bash `scripts/verify.sh`: 144 test đạt, build GUI và
  headless đạt;23 scenario có assertion, bao gồm drain/relight/refuel-safe/
  out6000/capacity và ba kết thúc bình minh; ba Đêm byte-identical; input mới
  sai trảexit2 và stdout sạch. Đêm3 chạy đủ18.000 gameplay tick dưới30 giây.
- GUI:45 kiểm tra tự động tại1280×720 trong Chrome headless WebGL, lưu ảnh
  và FPS/máy/GPU trong proof Phase3. Fixture đi qua core Scenario, có mô tả
  rõ; không giả là đã chơi trọn một chiến dịch bằng tay.
- Không có test ẩn để chạy; không khẳng định đã đạt chúng. Nghe âm thanh
  bằng tai, FPS cửa sổ thường và Docker vẫn chưa kiểm thử.
- Bằng chứng Phase1/2 giữ nguyên; changelog liệt kê breaking changes;
  AGENTS và skill mới chỉ dẫn đúng Phase3.

### Token / retro

Ước tính vòng Phase3 khoảng30–45k token (ước tính nội dung đọc, code và tool;
không phải số liệu hóa đơn). Tái dùng harness Node/Chrome, không thêm package,
không dựng lại map/physics không bị thay luật. Kiểm tra các mốc tick và lượng
dầu trước, sau đó ảnh thật giúp tìm lỗi bố cục mà unit test không thể thấy.

## Phase 4 — Ticket-04: Bình minh, phát hành v1.0.0

Baseline phase-3 tại6e22af6. Thêm contract1.3, benchmark/soak tách biệt gameplay,
top10 lưu đĩa, accessibility, ZIP/demo/retro và workflowrelease. AGENTS/skill mới
nêu đúng lệnh đo, giữ5đèn canonical và không push repo mẫu lớp.

### Lỗi phát hiện và cách sửa

| Vấn đề | Phát hiện | Xử lý |
|---|---|---|
| Bench ban đầu thay danh sách đèn bằng3đèn sáng, mất L4/L5 tắt nên wander đổi mục tiêu | Review scene với bản đồ chuẩn | Giữ đủ5đèn, thêm assertion, build và đo lại cửa sổ thật |
| Nhiều mesh riêng làm cảnh200bóng tốn drawcall | Đo renderer và FPS thực | GPU instancing cùng sphere/eyes/halo/mote, áp dụng renderer thường khi đông; không đổi core gameplay |
| Soak JIT lần đầu RSS1,203× vượt1,2 | RSS thực trước/sau reset | Lệnh công khai --jitless --expose-gc; interpreter và GC tại2mốc, không sửa số RSS |
| Binding đã lưu có W và w lọt kiểm trùng | Unit case-normalized data | Normalize trước validation, dữ liệu sai về defaults |
| UI nhỏ/chữ lớn che helper và cue cắt mép | Computedfontsize và ảnh thật1280×720 | Min18px/lớn×1.25, menu cuộn, wrapHUD, clampcue vào mép nhìn thấy |
| GUI test sinh biểu thức x--số khi tọa độ âm | Runtime syntaxerror trong harness | Ngoặc số nội suy; chạy lại58check |
| Demo chờ cả object Three.js gây Object reference chain too long | CDP Runtime.evaluate | Chỉ chờ boolean |
| MP4 đã encode nhưng backgroundtab không nạp metadata | Timeoutmetadata; HTTPvideo decode thành công91,9s | Focus recorder trước validate; thêm validatorHTTP và5ảnh giải mã |
| Sửa game khi đang quay làm Vite reload, mất nút continue | Harness null.click | Ổn định mã trước quay cuối; không sửa module game giữa lần quay |
| npm start helper để lại servercon khi killnpm | Tiến trình helper chưa kết thúc | Dọn đúng câyPID helper; script mới killtreeWindows/processgroupPOSIX |
| SaveScore trả lời sau rời màn hình có thể tham chiếuDOM đã xóa | Review asyncnavigation | Giữ node status của form, chỉ đánh dấu scoreSaved nếu còn cùng sim |

### Kiểm chứng và giới hạn

160test/12file đạt;23scenario,3Đêm tất định,24trace Phase3 cùngbyte.58GUIcheck
bao gồm rebind/duplicate/reset/persist, minfontsize, motion, spawnarrows, điểm
sau thua, reload, campaign. ZIP đã giải nén bằng công cụ native, kiểm19hash,
chạy game/input thật, restartserver giữ điểm, export/headless/soak không module.
Cài sạch chạy npmci/build/start thành công. npmci báo6advisory ở dependencytree
baseline; không dùng auditfix--force để tự ý nâng major và không ghi đã sửa chúng.

Benchmark cửa sổ thật sau sửa cảnh: avg155,4FPS, p1-low68,6, p95=10,2ms,
load1291ms. Soak10Đêm không crash, RSS khoảng1,08×, filegốc vàrawdt được lưu.
Không ghi số đo đang quay video thành benchmark chính. Hidden tests chưa có;
nghe bằng tai và máy chấm chưa kiểm. MP4 có nhãn fixtures, không giả run tay trọn
chiến dịch. Retro bảnHTML được kiểm đúng2trangA4 và không trànfooter.

GitHub đích chưa xác định: origin là repo mẫu lớp. Đã hỏi URLrepo cá nhân và
gợi ý plugin GitHub; chưa kết nối hoặc nhận URL. Hoàn thiện local artifact,
release notes/workflow trước; không ghi "Release online" khi mới có taglocal.

Ước tính Phase4 khoảng45–65k token; tổng4phase khoảng215–270k, không có hóa
đơn/telemetry để khẳng định chi phí. Tiết kiệm bằng đọc có phạm vi, dùng lại
harness, gom truy vấn độc lập và không inbase64ảnh/video vào ngữ cảnh.
