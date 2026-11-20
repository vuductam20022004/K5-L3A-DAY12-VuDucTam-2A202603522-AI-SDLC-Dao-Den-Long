# AGENTS.md — Đảo Đèn Lồng

Harness cho agent (Cursor/Claude Code/Codex). **Đọc file này trước khi sửa code.**
Giữ file này ngắn: mỗi dòng tốn ngữ cảnh ở mọi lần chạy. Chỉ thêm dòng khi agent sai lặp lại.

## Dự án

Game 3D "Đảo Đèn Lồng" (TypeScript + Three.js + Vite). Kiến trúc cốt lõi:

- `src/core/**` — **logic game thuần TypeScript**. KHÔNG import `three`, KHÔNG dùng DOM, KHÔNG dùng `Math.random`.
  Đây là nơi duy nhất được phép chạy trong chế độ headless và là nguồn sự thật cho mọi test.
- `src/render/**` + `src/main.ts` — GUI web (three.js). Chỉ đọc state từ `core`, không được quyết định luật game.
- `src/headless.ts` — entrypoint headless theo Test Contract v1.3 (Ticket-04); giữ nguyên luật v1.2.
- `game.contract.json` — **nguồn duy nhất** cho mọi con số tuning. `src/core/config.ts` import file này.

## Lệnh

```bash
npm ci                 # cài phụ thuộc
npm run build          # build ra dist/ (cả headless.js)
npm run dev            # chạy GUI web (http://localhost:5173)
npm test               # unit test (vitest) + test contract
npm run headless -- --seed 1 --night 1 --ticks 600 --out out.jsonl
bash scripts/verify.sh # kiểm chứng đầy đủ (test + scenario + tất định)
npm run bench -- --seed 42 --duration 30 --out bench.json # cửa sổ thật
npm run soak -- --seed 7 --nights 10 --out soak.json
npm run package        # ZIP chạy được, không cần node_modules
```

## Test Contract v1.3 — quy tắc bắt buộc (không được phá)

- 60 tick/giây cố định. 1 tick = 1/60 s. Không nhảy tick.
- `time_left_s = night_duration_s - sim_tick / 60`; pause chỉ tăng `tick`.
- Snapshot tick 0 = trạng thái **sau khi dựng scenario, trước khi áp input**.
- Bước thứ k (k = 0..N-1) đọc input của tick k và tạo state k+1. Sự kiện ghi ở `tick = k+1`.
  `--ticks N` = đúng N bước.
- Mặt đất đảo ở Y = 0. Trục Y hướng lên. Player xuất phát (0,0,0).
- `player.pos` = chân nhân vật; `shade.pos` = tâm Bóng Mực; `lantern.pos` = chân cột đèn.
- Khoảng cách đo XZ, bán kính gồm mép; riêng Pulse đo **3D** từ chân Mây +0.8 tới tâm bóng.
- Di chuyển: `x' = x·cosθ + z·sinθ`, `z' = −x·sinθ + z·cosθ` với θ = `cam_yaw_deg` (đổi sang radian).
  Vector move dài hơn 1 phải chuẩn hóa về độ dài 1.
- Input: `jump|interact|pulse|dash|pause` là boolean, **false → true** (edge trigger).
- Output JSONL: dòng `snapshot` / `event` / `end`. Dòng `end` là dòng cuối và **bắt buộc**.
- Tọa độ làm tròn **3 chữ số thập phân**.
- Exit code: `0` = bình thường; `2` = file inputs/scenario sai định dạng; khác `0` = lỗi khác (in ra stderr).
- **Tất định**: cùng `--seed` + cùng scenario + cùng inputs ⇒ output giống hệt từng byte.

Tên event chuẩn (dùng đúng, không đổi): `mote_picked`, `deposit`, `lantern_lit`, `pulse`,
`player_hit`, `shade_spawned`, `game_over`.
Event v1.1: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`.
Điểm nạp **+5**, lần đầu **+100**, thắp lại **+40**. Pulse tốn 3 đom đóm; trúng drain thưởng tổng **15**, còn lại **5**.
Fuel lưu nguyên đơn vị 1/60: bước 2 trừ hao + drain rồi xét tắt, trước tương tác; chỉ làm tròn khi xuất.
Chỉ thắng ở bình minh với ≥ceil(0.6×n) đèn, reason `dawn_survived`; no_flames ưu tiên, không còn all_lit/thưởng thời gian.
Capacity dẫn xuất từ successful_lights; renderer dùng helper core cho cost/chọn đèn, không tự đặt luật nạp.
`game.contract.json.rules` chứa các hằng số gameplay phụ; bản đồ dùng chung geometry cho sim/render.
Kiểm chứng hiện tại: `skills/verify-phase4/SKILL.md`; giữ nguyên tag/proof các phase trước.
Benchmark riêng: đủ5 đèn (L1–L3 sáng),200wander/100motes; không sửa gameplay để tăng FPS. Giữ raw dt và cấu hình máy.
Điểm lưu bằng server vào data/leaderboard.json; GUI và CLI export dùng cùng store. Không ghi dữ liệu QA vào data người dùng.
Không đẩy Release lên repo mẫu của lớp; xác định đúng repo cá nhân trước khi push.

## Cấm

1. Không dùng `Math.random()` / `Date.now()` trong `src/core/**` — dùng `src/core/rng.ts` (seeded).
2. Không sửa `src/core/**` chỉ để render đẹp.
3. Không `console.log` trong headless path (stdout phải sạch; chỉ ghi file `--out`).
4. Không thêm tính năng sáng tạo làm **đổi output headless** (thực thể thêm phải tắt khi headless).
5. Không đổi số trong `game.contract.json` mà không cập nhật `src/core/config.ts` và test.

## Quy trình mỗi thay đổi logic

1. Cập nhật `docs/notes/assumptions-phase-N.md` nếu thay đổi luật/giả định.
2. Chạy `npm test` rồi `bash scripts/verify.sh`.
3. Dán **kết quả thật** (output lệnh) vào commit message và lưu vào `docs/proof/phase-N/`.
4. Commit nhỏ, một việc mỗi commit. Gắn tag `phase-N` khi phase xong.

## Bàn giao mỗi phase

- `game.contract.json` khớp đúng số game đang dùng.
- Bằng chứng thật trong `docs/proof/phase-N/` (output headless, test report, ảnh).
- README cập nhật (cài/chạy ≤ 3 lệnh, điều khiển, cách tính điểm, mục "Sáng tạo của tôi").
- `docs/notes/ai-log.md` cập nhật (AI sai ở đâu, cách phát hiện, ước tính token).
