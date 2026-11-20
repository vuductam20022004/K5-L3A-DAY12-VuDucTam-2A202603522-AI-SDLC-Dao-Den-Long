# Nghiệm thu Phase 2 — Ticket-02

Đối chiếu `docs/spec/phase-2.md` và `docs/notes/assumptions-phase-2.md`.
Các file JSONL và log trong thư mục này được sinh từ chương trình, không
sửa tay. Kết quả đo cụ thể đọc ở báo cáo JSON để tránh nhầm giữa các lượt chạy.

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| Tuning v1.1, di chuyển, nhảy, lướt | tests.json, run-dash.jsonl | Đạt test |
| Nhặt/nạp, điểm nạp, thắp đèn và thưởng thắng | run-lit.jsonl; ảnh lamp-lit.png | Đạt; scenario score 1298 |
| Spawn/AI Bóng Mực, safe zone, stun/push/recoil | run-spawn/shade/pulse.jsonl; unit-tests.txt | Đạt test |
| Rơi, bỏ túi, chờ và hồi sinh | run-fall.jsonl | Đạt; tick 61 về (0,0,0), invuln 1.5 s |
| Bản đồ 1/2/3, cầu, dốc, tháp/bục | maps.test.ts; run-spring/tier-spring.jsonl; ảnh night-*-map.png | Đạt test và ảnh |
| Gió Lạc cướp/trả/removed | run-drifter.jsonl | Đạt, có steal/drop và loại khỏi mảng |
| Bùa Gió 600 tick, hồi 2700, dash không hồi | run-charm.jsonl; unit-tests.txt | Đạt test |
| Gió đúng lịch/hướng/2m/s, cảnh báo lá và âm | run-wind.jsonl; ảnh wind-warning.png; gui-checks.json | Đạt test; wind đủ 300 bước đẩy |
| Menu/intro/result/retry/3 đêm/Bình Minh | campaign tests; gui-checks.json; ảnh result-1/result-2/dawn.png | Đạt test |
| Pause đóng băng gameplay; resume/restart/settings/menu | run-pause.jsonl; gui-checks.json; ảnh pause.png | Đạt test; menu/restart có nút và handler |
| Lưu âm lượng/độ nhạy qua reload | gui-checks.json; ảnh settings.png; settings tests | Đạt test |
| Web Audio, nhảy/lướt/pulse/thắng/thua/spawn/countdown | audio.ts; gui-checks.json | AudioContext chạy, SFX dispatch đạt; chưa nghe bằng tai |
| HUD, mũi tên, E hint, cooldown, đồng hồ đỏ | gui-checks.json; ảnh night-1.png, lamp-lit.png | Đạt kiểm tra và ảnh |
| Palette và ambient theo tiến độ | PALETTE/styles.css; GUI assert ambient 0.26 khi 1/5 đèn sáng | Đạt code/assert |
| Định dạng, chính xác N clock ticks, pause, tất định | verify-output.txt, tests.json | Đạt trên cả 3 đêm |
| Full night 21.600 sim tick ≤30 s | performance-headless.json, run-benchmark.jsonl | Đạt |
| GUI ≥30 FPS ở 1280×720 | performance-gui.json | Đạt trong Chrome headless WebGL; chưa đo cửa sổ thường |
| Harness/spec/hồi quy | AGENTS.md, skills/verify-phase2, skill-validation.txt, CI workflow | Đã bổ sung, 101 test đạt |

## Phương pháp và phạm vi bằng chứng

- `npm test` và `bash scripts/verify.sh` đã chạy thực tế. Windows dùng Git
  Bash để chạy wrapper; cùng logic với `npm run verify`.
- Test Phase 1 được giữ và đổi kỳ vọng chỉ ở các luật Ticket-02 thay thế:
  version 1.1, cost 10, pulse dùng carried, +10 khi nạp, night_start và đúng
  số clock tick. Chi tiết lý do trong spec/AI log.
- GUI harness dùng Chrome headless riêng, không profile cá nhân, RAF theo
  thời gian thật, GPU được ghi trong báo cáo, đo 8 giây/đêm sau warmup.
  Fixture đổi vị trí/đồng hồ/state đèn để kiểm tra màn hình; đây không phải
  bằng chứng người chơi đã đi bộ thắp toàn bộ đèn của cả ba Đêm.
- Ảnh do `Page.captureScreenshot` lấy từ ứng dụng thật. Mã sinh ảnh/game
  không dùng ImageGen hoặc asset bên ngoài.
- Test ẩn chưa được cung cấp, Docker và nghe âm thanh/cửa sổ thường chưa
  kiểm thử. Cần người dùng kiểm tra bổ sung trước khi nộp bài chính thức.
- Repo đầu vào chưa có tag Phase 1; chỉ giữ bằng chứng lịch sử, không tự tạo
  tag Phase 1 từ state Phase 2. Remote hiện là repo mẫu của lớp, vì vậy cần
  repo cá nhân đúng quy ước khi nộp.

## Chạy lại

```bash
npm ci
npm run verify
```

GUI: mở `npm run dev`, ở terminal khác chạy `npm run test:gui` (Node 22+,
Chrome/Edge đã cài). Hiệu năng/timestamp phụ thuộc máy và tải hệ thống;
JSONL cùng seed/input/scenario phải giống từng byte.
