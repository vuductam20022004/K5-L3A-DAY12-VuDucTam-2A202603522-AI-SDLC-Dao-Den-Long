# Acceptance criteria — Phase 3 / Contract v1.2

| Mục | Tiêu chí kiểm chứng |
|---|---|
| Dầu chính xác | Đèn 100 còn 99 sau 60 tick, tắt đúng tick 6000; không hao khi pause/đã kết thúc |
| Châm dầu | used=min(carried,ceil(deficit/10)); không vượt 100; loại đèn đầy; chọn gần/id; +5/đom đóm |
| Tắt/thắp lại | out reset deposited, giữ ever_lit; lần đầu cost10/+100, thắp lại cost5/+40; mọi lần thắp nạp 100 |
| Vùng an toàn | Đúng 30 có vùng; <30 không có; refuel lên30 đẩy cả bóng drain trong6m và ngăn hit |
| Drain | Chỉ wander chọn đèn yếu gần/id, fallback đèn tắt; ≤2m → drain, hao cộng dồn5/s/bóng +1/s tự nhiên; cadence event60 tick |
| Chuyển trạng thái | Drain bỏ khi target tắt/≥30/xa>2; Mây trong6 → chase; pulse → stunned → wander; chase không đổi sang target đèn |
| Bình minh | Không thắng sớm; sống + ceil(0.6n) đèn tại tick cuối mới thắng dawn_survived; lửa0 luôn thua trước |
| Sức chứa | 10+2 mỗi thắp thành công gồm relight, cap20; scenario lit không tính; reset mỗi đêm; pickup/HUD dùng capacity |
| Điểm | Nạp5, lần đầu100/lại40, pulse5/drain15; thắng nhận mỗi đèn50+floor(fuel), mỗi lửa50; không thưởng thời gian |
| Snapshot/scenario | version1.2, fuel một chữ số, ever_lit/relit_count/capacity, drain state, target_lantern_id và successful_lights được validate |
| Giao diện | Thanh dầu; đèn/ thanh nhấp nháy1Hz khi<30; prompt nạp/châm lại đúng cost; tiến độ giữ sáng tới bình minh |
| Mù màu | Lưu bảng màu; mắt/viền bóng #00B3FF, cảnh báo #FFFFFF kèm⚠; đèn tắt xẹp20% và có vết rách |
| Hồi quy | Các test Phase1/2 không bị thay luật giữ chạy; lý do thay test cũ ghi ADR/changelog; không skip |
| Bằng chứng | npm test → bash scripts/verify.sh; scenario dầu/drain/relight/dawn/capacity; byte-identical 3 đêm; GUI/settings/FPS/ảnh |
