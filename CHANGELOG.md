# Changelog

## Phase 3 — Đèn cạn dầu (Contract 1.2)

Breaking changes so với tag `phase-2`:

- Đèn đã sáng hao dầu, có thể tắt và nhận châm dầu; thắp lại cost5 thay cost10.
- Vùng an toàn chỉ còn khi fuel≥30; Bóng Mực thêm drain và hút dầu cộng dồn.
- Thắp tất cả đèn không thắng sớm. Chỉ xét ở bình minh, cần ceil(60% số đèn).
  Lý do thắng đổi all_lit → dawn_survived; hết lửa luôn thua no_flames.
- Duration ba đêm đổi 300/330/360 → 240/270/300 giây.
- Toàn bộ điểm thay thế: nạp5, lần đầu100, lại40, pulse5/drain15; thưởng mỗi
  đèn đang sáng50+floor(fuel) và lửa50; bỏ thưởng thời gian.
- Capacity đổi từ10 cố định sang10+2×successful_lights, tối đa20.
- JSONL đèn thêm fuel/ever_lit/relit_count; player thêm capacity; scenario
  thêm fuel/ever_lit/successful_lights/target_lantern_id. Event mới refuel,
  lantern_out, fuel_drain; lantern_lit thêm relight. Contract version lên1.2.
- GUI thêm thanh dầu/nhấp nháy, thông tin bình minh và bảng màu dễ phân biệt
  lưu qua reload; hình đèn tắt xẹp20% và rách để phân biệt không cần màu.

Test cũ thắng sớm/all_lit, thưởng thời gian, điểm nạp10, duration cũ và túi
10 cố định sau thắp đèn được cập nhật vì ticket thay luật. Không xóa/skip test
movement/physics/pause/bùa/Gió Lạc/maps/input/CLI. Xem ADR-003 và báo cáo proof.
