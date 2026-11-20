# Phase 2 — Ticket-02 / Contract v1.1

Ticket-02 do người dùng cung cấp là yêu cầu hiện hành, thay các giả định Phase 1
về bản đồ, sức chứa, pulse, máu, điểm và thời gian. Không triển khai Phase 3/4.

## Quyết định và các chỗ cần làm rõ

- Điểm +10 tính khi **nạp**, không phải khi nhặt. Pulse dùng đom đóm, không dùng Ngọn Lửa.
- `tick` đếm đủ số bước CLI yêu cầu, kể cả sau kết thúc; `sim_tick` chỉ tăng khi
  gameplay chạy. Khi pause/resume, bước chuyển trạng thái không chạy gameplay.
  Trạng thái đã kết thúc không phát lại sự kiện hay cộng lại điểm.
- `night_start` phát tại bước đầu tiên (tick 1); snapshot 0 vẫn trước input.
- CLI `--night` và `--seed` là nguồn chọn đêm/seed; scenario chỉ ghi đè state.
- `player.invuln` giữ cách biểu diễn của khung v1.1 đang có: số giây bất tử
  còn lại (không phải boolean). Ticket liệt kê tên trường nhưng không nêu
  kiểu; đây là giả định cần đối chiếu nếu giảng viên cung cấp schema chi tiết.
- Input mảng không có tick áp dụng từng frame liên tiếp; frame có tick là thay
  đổi giữ nguyên tới frame sau. Không trộn hai cách trong một file.
- Thời hạn tính theo tick: hiệu ứng mới có đủ số bước chuyển động quy định,
  các bộ đếm hiện hữu giảm ở đầu bước; sinh mới tương tác từ bước kế tiếp.
- Vùng an toàn đo XZ, bao gồm mép 6 m; bóng có thể đứng ở mép nhưng không tiến
  vào phía trong. Pulse chọn mục tiêu bằng khoảng cách **3D**, theo Ticket-02.
- Bóng sinh tại điểm trống hợp lệ, cách Mây ít nhất 15 m, không trong vùng an
  toàn. Hết điểm thì bỏ lượt, không dùng điểm không hợp lệ để dự phòng.
- Bóng đi trên mặt sàn của nó, bị chặn bởi vách/tháp/vùng an toàn; không bay
  xuyên biển mây. Recoil đẩy **bóng**, không đẩy người chơi.
- Lướt giữ độ cao, tạm dừng vận tốc Y rồi khôi phục khi hết lướt; hướng lướt
  chuẩn hóa kể cả đầu vào analog nhỏ hơn 1. Bục nhảy khóa vận tốc ngang tới
  khi đáp; lướt tạm ghi đè rồi trả vận tốc phóng.
- Khi chờ hồi sinh không di chuyển, nhặt, nạp, pulse hay bị cướp/chạm. Sau
  60 tick hồi sinh tại (0,0,0), vận tốc 0 và bất tử 90 tick.
- Gió là vận tốc cộng thêm 2 m/s, không phải gia tốc; không tích lũy vô hạn.
  Cơn bắt đầu trước di chuyển ở tick 1800, kết thúc trước tick 2100: đủ
  300 bước đẩy, tổng 10 m khi không có input/vật cản.
- Gia tốc 72 m/s² (trong `rules`) đạt 6 m/s trong 5 tick và 7.2 m/s trong
  6 tick khi có bùa; đáp ứng điều kiện tăng tốc/dừng trong tối đa 0.1 s.
- Gió Lạc chỉ ở Đêm 2/3, removed được loại khỏi mảng snapshot; bị pulse khi
  flee và giữ đồ thì thả tại chỗ, sau 120 tick biến mất.
- Nhạc và SFX tổng hợp bằng Web Audio, bắt đầu sau thao tác người dùng;
  không phụ thuộc asset/Internet. Cài đặt lưu localStorage, có fallback.
- Tổng điểm chiến dịch chỉ cộng các đêm thắng; chơi lại đêm thua không nhân
  đôi điểm. Menu và giới thiệu đêm không chạy simulation.

## Kế hoạch nghiệm thu

Xem `docs/spec/phase-2.md`. Chạy unit test, build, verify (có assertion
scenario, ba đêm byte-identical và benchmark 21.600 tick), sau đó GUI 1280×720.
Bằng chứng mới lưu riêng trong `docs/proof/phase-2/`, giữ nguyên Phase 1.
