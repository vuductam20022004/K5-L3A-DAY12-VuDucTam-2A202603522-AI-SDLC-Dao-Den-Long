---
name: verify-phase3
description: Kiểm chứng thay đổi Đèn cạn dầu của Đảo Đèn Lồng, contract v1.2, hồi quy còn hiệu lực và bằng chứng Phase 3; dùng khi sửa fuel, drain, thắng bình minh hoặc bàn giao Ticket-03.
---

Chạy từ gốc repo; đọc `docs/adr/003-lantern-fuel-and-dawn.md` và `docs/spec/phase-3.md` để phân biệt luật
thay thế với hồi quy còn hiệu lực. `npm test` rồi `bash scripts/verify.sh`
(Windows dùng Git Bash hoặc `npm.cmd run verify`). Script trả lỗi khi bất kỳ
assertion thất bại và chỉ ghi `docs/proof/phase-3/`. Không sửa tay JSONL/log.

Kiểm tra các ranh giới: fuel thật khác fuel làm tròn, đúng30, cộng dồn drain,
cadence60 tick, tắt rồi thắp lại cùng tick, capacity tăng khi relight, và
no_flames ưu tiên tại bình minh. Không đưa all_lit/thưởng thời gian trở lại.

GUI: mở `npm run dev`, chạy `npm run test:gui` ở terminal khác (Node22+,
Chrome/Edge). Harness dùng profile riêng, viewport1280×720; kiểm tra palette,
fuel bar/nhấp nháy, hình đèn tắt, refuel/relight, túi động và chuỗi bình minh.
Đọc báo cáo để phân biệt fixture kiểm thử với chơi đầy đủ một chiến dịch.
FPS ghi rõ Chrome headless WebGL; nghe âm thanh/cửa sổ thường là kiểm tra bổ sung.

Giữ bằng chứng và tag phase-2; test cũ bị thay luật phải có lý do trong ADR/
changelog. Không skip âm thầm và không tuyên bố test ẩn đã đạt nếu chưa có test.
