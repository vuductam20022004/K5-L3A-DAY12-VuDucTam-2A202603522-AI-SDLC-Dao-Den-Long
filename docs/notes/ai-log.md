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
