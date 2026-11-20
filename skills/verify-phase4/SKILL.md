---
name: verify-phase4
description: Kiểm chứng và đóng gói Đảo Đèn Lồng Phase 4, Contract 1.3; dùng khi thay release, benchmark, soak, accessibility hoặc leaderboard.
---

# Kiểm chứng Phase 4

Đọc AGENTS.md và docs/spec/phase-4.md. Luật gameplay vẫn là v1.2; không chỉnh
test/fixture để che sai lệch với JSONL đã lưu ở docs/proof/phase-3.

1. `npm test`, `npm run build`; PowerShell dùng npm.cmd nếu execution policy chặn.
2. `npm run bench -- --seed 42 --duration 30 --out bench.json` mở cửa sổ riêng,
   không dùng --headless cho số liệu nộp. Giữ bench.frames.json, metadata và ảnh.
   Cảnh có5 đèn, chỉ L1–L3 sáng; đủ200wander/100motes; không quay video trong lúc đo.
3. `bash scripts/verify.sh`: assertions, byte regression24 traces, soak10nights
   và tính lại công thức benchmark từ dt thật. Lệnh soak công khai có --jitless
   --expose-gc; báo RSS thật, không trừ baseline giả.
4. `npm run test:gui` dùng profile/data riêng; kiểm tra58 hành vi và xem ảnh chữ
   lớn/HUD. Không sửa proof phase cũ. `npm run demo` ghi MP4 thật có nhãn fixture.
5. `npm run package`; giải nén vào thư mục trống, thử server/headless/soak không
   node_modules. Kiểm manifest SHA256. Lưu output thật ở docs/proof/phase-4.

Chỉ tag phase-4/v1.0.0 sau kiểm chứng. Release cần repo cá nhân public đã xác định
và GitHub có quyền ghi; origin lớp không phải đích xuất bản. Không ghi đã publish
khi mới tạo artifact hoặc tag local. Workflow release.yml đính kèm ZIP và demo.
