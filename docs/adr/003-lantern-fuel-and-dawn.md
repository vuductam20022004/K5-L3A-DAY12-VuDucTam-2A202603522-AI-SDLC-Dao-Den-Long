# ADR-003 — Đèn có nhiên liệu, thắng tại bình minh

Trạng thái: chấp nhận. Nguồn: Ticket-03 / Contract v1.2 người dùng cung cấp.

## Quyết định

Đèn lưu `fuelTicks` nguyên (60 đơn vị = 1 fuel), `everLit`, `relitCount` bên
cạnh `lit/deposited`. Mỗi gameplay tick trừ 1 đơn vị hao tự nhiên và 5 đơn
vị mỗi Bóng Mực đang drain hợp lệ; gom tất cả hao trước khi xét tắt. Snapshot
và event mới làm tròn fuel một chữ số; điểm bình minh dùng floor của nhiên
liệu thật, không lấy số đã làm tròn. Không tích lũy số thực 1/60.

Đèn chưa từng sáng cần 10, từng sáng cần 5. Khi thắp thành công: fuel=100,
tăng successful_lights, tăng relit_count chỉ khi thắp lại. Đèn scenario không
cộng điểm hay số lần thắp, nhưng lit=true ngụ ý ever_lit=true. Sức chứa dẫn
xuất từ counter: min(20,10+2×successful_lights), không lưu hai nguồn khác nhau.

Chọn đèn tương tác trong core bằng khả năng nhận, khoảng cách XZ và id. GUI
dùng cùng helper cho prompt. Châm dầu dùng phép chia/ceil trên đơn vị nguyên.
Vì hao dầu ở bước 2 trước tương tác ở bước 5, đèn ban đầu đầy đã hao 1/60 khi
bấm E; dù snapshot làm tròn 100.0, nó vẫn có thể nhận 1 đom đóm theo công thức.

Drain giữ target_lantern_id và bộ đếm tick hút liên tiếp. Ở bước 2, các bóng
đang drain mục tiêu hợp lệ đóng góp hao dầu; mỗi 60 lần hút phát fuel_drain,
theo id bóng, với fuel sau tổng hao. Mục tiêu không còn hợp lệ → wander;
còn hợp lệ nhưng Mây ở trong 6 m → chase ở bước 8. Mây tiến vào trong tick
vẫn có thể chịu lần hút đầu bước 2 trước khi bóng bỏ hút ở bước 8.

Wander vẫn ưu tiên phát hiện Mây trong 12 m theo Phase 2, sau đó chọn đèn yếu
gần nhất, nếu không có thì đèn tắt; tiến tới bằng tốc độ bóng của đêm. Đến
trong 2 m mới chuyển drain, lần hút đầu ở bước 2 tick sau. Chase không chọn
đèn. Refuel lên ≥30 khôi phục vùng an toàn và đẩy cả bóng drain ra ngoài.

Xét kết thúc duy nhất sau cập nhật tick: no_flames trước; nếu bình minh thì
so số đèn hiện đang sáng với ceil(0.6×n). Không còn nhánh all_lit. Các bước
đồng hồ sau kết thúc vẫn ghi đúng N bước CLI, không hao tiếp hay thưởng lại.

## Hệ quả và hồi quy

Output headless thay đổi có chủ đích ở v1.2. Test thắng sớm, thưởng thời gian,
cost thắp lại, điểm nạp và duration cũ được thay kỳ vọng, không skip. Movement,
nhảy/lướt, rơi, pause, bùa, Gió Lạc, map và JSONL giữ kiểm chứng hồi quy.
Campaign tiếp tục chỉ cộng điểm các đêm thắng; mỗi sim mới reset counter.
Màu dễ phân biệt chỉ ở settings/render/CSS, không chạm output headless.
