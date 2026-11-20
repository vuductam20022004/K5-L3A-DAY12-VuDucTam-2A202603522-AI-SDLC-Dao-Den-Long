# Phase 3 — Đèn cạn dầu

Ticket-03 thay các luật đèn/điểm/thắng của Phase 2. Quyết định chi tiết và lý
do cập nhật test: `docs/adr/003-lantern-fuel-and-dawn.md`.

- Nhiên liệu scenario được lượng tử hóa đến 1/60 gần nhất; nhận giá trị hữu
  hạn 0..100. Đèn tắt luôn có fuel=0; lit=true mặc định fuel=100, ever_lit=true.
- Scenario successful_lights là counter phục hồi trực tiếp; đèn lit sẵn không
  tự tăng counter. relit_count ban đầu 0 vì ticket không thêm trường scenario này.
- fuel_drain theo mỗi 60 lần hút liên tiếp của từng bóng, reset khi bỏ drain/
  đổi mục tiêu; pause đóng băng bộ đếm. Event ghi fuel sau tổng hao tick đó.
- Khi fuel tắt ở bước 2, có thể thắp lại ở bước 5 cùng tick nếu đủ 5 đom đóm.
- Pulse thưởng đúng tổng 15 cho bóng đang drain trước trúng; không cộng 5+15.
- Đúng 30 còn vùng an toàn; sau hao xuống dưới 30 thì mất ngay trong tick đó.
- Nhấp nháy 1 Hz dùng sim_tick, nên dừng khi pause. UI/cài đặt không đổi core.
- Đèn tắt xẹp 20% ở phần giấy đèn, có vết rách tương phản ở cả hai bảng màu.
- Giữ giả định v1.1 về invuln và input timeline trừ các mục ticket thay thế.

Nghiệm thu: `docs/spec/phase-3.md`. Bằng chứng chỉ ghi `docs/proof/phase-3/`;
giữ tag phase-2 và các thư mục proof cũ nguyên vẹn.
