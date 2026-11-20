# Nghiệm thu Phase 3 — Đèn cạn dầu / Contract v1.2

Nguồn yêu cầu: Ticket-03 do người dùng cung cấp. Thiết kế:
`docs/adr/003-lantern-fuel-and-dawn.md`. Các breaking changes và lý do thay
test cũ: `CHANGELOG.md`, `docs/notes/assumptions-phase-3.md`.

| Mục | Bằng chứng thật | Kết quả |
|---|---|---|
| Dầu1/s chính xác, tắt đúng6000, ever_lit | run-oil-expiry.jsonl; phase3 tests | Đạt |
| Refuel ceil/cap100, chọn eligible/gần/id | run-lit.jsonl, run-refuel-safe.jsonl; phase3 tests | Đạt |
| Tắt rồi thắp lại cùng tick, cost5, relit_count | run-relight.jsonl; ảnh lantern-out/relit | Đạt, score65 |
| Ngưỡng30 và khôi phục vùng an toàn | run-refuel-safe.jsonl; boundary tests | Đạt; refuel đúng30, bóng ra6m/recoil, không hit |
| Drain cộng dồn, cadence60, target và chuyển trạng thái | run-drain.jsonl, run-weak-target.jsonl; phase3 tests | Đạt;2 bóng làm hao11/s, log tick60/120 |
| Pulse drain thưởng tổng15, còn lại5 | run-drain-pulse.jsonl; phase3 tests | Đạt |
| Không thắng sớm, ngưỡng3/5-4/6-5/7 ở bình minh | phase3 tests; GUI checks | Đạt |
| Tick cuối: out làm thua; đủ đèn thắng; hết lửa ưu tiên | run-dawn-win/out/hit.jsonl | Đạt; reason dawn_survived/dawn/no_flames |
| Điểm mới, floor dầu thật, bỏ thời gian | tests.json; run-dawn-win.jsonl | Đạt; scenario thắng537 |
| Túi10+2 mỗi lần thắp, cap20, reset từng đêm | run-capacity.jsonl; phase3 tests; ảnh lantern-relit | Đạt; scenario18→20 |
| Fuel bar/nhấp nháy1Hz; đèn tắt xẹp20% và rách | GUI checks; ảnh low-fuel-blink, lantern-out | Đạt code/ảnh/GUI |
| Bảng màu lưu; viền/mắt cyan, cảnh báo trắng+⚠ | settings tests; GUI checks; ảnh accessible-* | Đạt, kiểm tra RGB chính xác |
| Hồi quy physics/maps/pause/bùa/Gió Lạc/input/CLI | unit-tests.txt, tests.json, verify-output.txt | Đạt144 test, không skip |
| Headlessv1.2, determinism3 đêm, exit2 | verify-output.txt, JSONL scenario | Đạt23 scenario và định dạng mới |
| Hiệu năng | performance-headless.json, performance-gui.json | Full-night18.000 sim tick≤30s; GUI≥30FPS trong Chrome headless |
| Bàn giao/harness | ADR, changelog, spec, AGENTS, skills/verify-phase3 | Đã cập nhật |

## Cách kiểm chứng và giới hạn

`npm test` → `bash scripts/verify.sh` đã chạy thật (Git Bash trên Windows).
`npm run test:gui` mở profile Chrome mới, viewport1280×720, dùng input bàn
phím/chuột và Scenario core. Các fixture timer/ngọn lửa/đèn có chủ đích để
kiểm tra chuyển màn; không phải bằng chứng chơi tay đủ cả chiến dịch.

Log/JSONL/ảnh do harness sinh, không sửa tay. FPS đo RAF thời gian thật,
có máy/GPU/trình duyệt và thời lượng trong báo cáo. Chưa đo FPS cửa sổ thường,
chưa nghe âm thanh bằng tai hoặc chạy Docker. Test ẩn chưa được cung cấp.
Proof và tag Phase2 giữ nguyên; không sửa kết quả lịch sử để khớp luật mới.

Chạy lại: `npm ci`, `npm run verify`. GUI: mở `npm run dev`, terminal khác
chạy `npm run test:gui` (Node22+, Chrome/Edge đã cài). JSONL phải tái lập từng
byte; thời gian đo và FPS thay đổi theo tải máy.
