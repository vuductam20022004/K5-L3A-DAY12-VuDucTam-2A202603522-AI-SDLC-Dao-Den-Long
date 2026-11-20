# Phase 4 — Phát hành v1.0.0

Ticket-04 / Contract v1.3. Không thay tuning hay luật gameplay của v1.2.

- Benchmark là mode riêng, không đưa thực thể thêm vào headless thường.
  200 bóng giữ wander, không phát hiện/chạm Mây; dùng cùng code chọn đèn và
  di chuyển wander. Tắt spawn/pickup/damage/fuel/terminal. 100 motes, L1–L3
  fuel100; PRNG seed42 tạo điểm đều diện tích đảo. Tắt vệt sáng/lời thoại và
  hiệu ứng sáng tạo thêm trong cảnh đo, giữ hiệu ứng/ánh sáng chuẩn.
- Cửa sổ Chrome riêng 1280×720, không fullscreen; có flags tắt giới hạn FPS/
  GPU vsync. Báo rõ renderer/flags và không làm giả số đo. Web không có RSS
  toàn bộ tiến trình đáng tin cậy: peak_mem_mb=null, giải thích trong README.
- Đo RAF sau warmup3s, khoảng đo đúng duration; p95 dùng nearest-rank,
  p1-low dùng ceil(1%N) dt lớn nhất. Load đo từ lúc launcher bắt đầu tới
  khung đầu tiên scene đã render, bao gồm khởi động server/browser.
- Soak dùng một tiến trình, index i=0..nights-1, seed=base+i; direction chọn
  đều góc mỗi30tick, bốn nút lấy mẫu Bernoulli mỗi tick bằng PRNG riêng.
  Mỗi đêm kết thúc hoặc đạt duration; reset xong đêm cuối mới lấy RSS cuối.
  Chạy soak bằng --jitless --expose-gc: V8 interpreter tắt JIT để tránh RSS
  của mã máy tối ưu hóa làm nhiễu phép đo giữ state. GC tại hai mốc đo, không
  trừ hay chỉnh RSS. Đây là lệnh soak công khai, gameplay vẫn cùng GameSim.
- Leaderboard lưu data/leaderboard.json qua server Node, cùng nguồn cho GUI
  và run_cmd --export-leaderboard. Lỗi ghi đĩa hiện thông báo, không báo lưu giả.
  Tên chuẩn3–12 ASCII chữ/số/_; tie theo achieved_at sớm hơn, giữ top10.
- Cài đặt cũ migrate giữ volume/palette; thêm bindings, reducedMotion, largeText.
  Mọi chữ UI có cỡ tính toán≥18px tại1280×720; chữ lớn×1.25 và cho cuộn menu.
- Release chỉ gửi lên repo cá nhân đã xác định; origin ban đầu là repo mẫu.
  Chờ URL/kết nối GitHub trong khi hoàn thiện artifact và demo ở local.
