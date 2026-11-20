---
name: verify-phase2
description: Kiểm chứng và lưu bằng chứng Phase 2 của Đảo Đèn Lồng, gồm contract v1.1, scenario, tính tất định và hiệu năng; dùng khi sửa logic hoặc bàn giao Ticket-02.
---

Quy trình lịch sử: dùng tại tag `phase-2`. Branch Phase 3 dùng
`skills/verify-phase3/SKILL.md`, vì `npm run verify` hiện ghi proof Phase 3.

Chạy từ gốc repo. Đọc `docs/spec/phase-2.md` và giả định Phase 2 khi cần đối
chiếu hành vi. `npm run verify` chạy typecheck, test, build, assertion scenario,
so byte ba đêm, exit code và benchmark 21.600 gameplay tick. Trên PowerShell
bị chặn npm.ps1, dùng `npm.cmd`. `bash scripts/verify.sh` gọi cùng script Node.

Mọi output mới vào `docs/proof/phase-2/`; không ghi đè Phase 1. Verify trả mã
khác 0 khi có lỗi; sửa nguyên nhân rồi chạy lại. Không sửa tay JSONL/báo cáo.
Giữ test cũ trừ trường hợp ticket thay luật, ghi lý do trong assumptions/spec.

GUI: `npm run dev`, rồi `npm run test:gui` trong terminal khác. Harness mở một
Chrome headless riêng, kiểm tra menu/ba đêm/pause/settings/HUD, lưu ảnh và đo
FPS viewport 1280×720. Có thể đặt `CHROME_PATH` và `GUI_URL`; không kết nối
profile người dùng. Đọc `performance-gui.json`: báo rõ môi trường headless,
GPU và thời lượng. Không coi số FPS headless là chứng nhận FPS cửa sổ thường.

Chỉ báo đạt mục đã có bằng chứng. Báo riêng mục cần người dùng kiểm tra tai
nghe hoặc cửa sổ thường; không khẳng định test ẩn của giảng viên đã đạt.
