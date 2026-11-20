# Tiêu chí nghiệm thu — Ba hòn đảo

Nguồn: Ticket-02 trong hội thoại, Contract v1.1. Các bảng chuẩn nằm trong
`game.contract.json` và `src/core/maps.ts`.

| Mục | Acceptance criteria | Kiểm chứng |
|---|---|---|
| Di chuyển, nhảy, lướt | 6 m/s sau ≤6 tick; nhảy 7, trọng lực 20; lướt 14 trong 12 tick, hồi 90 tick, giữ cao trên không | movement / phase2 tests, scenario-dash |
| Đom đóm, đèn, điểm | 20 điểm khác nhau; sinh ở 240k, trần 30; chứa 10; nạp trong 2 m, chọn gần/id; +10 mỗi đơn vị nạp | gameplay, phase2 tests, run-lit |
| Bóng Mực | Đúng lịch, giới hạn, phát hiện 12/bỏ 18; Đêm 3 tốc độ 4.5; recoil của bóng; safe zone 6 m | shades / phase2 tests, scenario-spawn |
| Pulse | Tốn 3 đom đóm, tâm chân +0.8, 3D ≤5; stun 120, đẩy 4 m trong 15 tick; hồi 180 tick | shades / phase2 tests, scenario-pulse |
| Rơi | −1 lửa, mất túi, chờ 60, hồi sinh bất tử 90; không tương tác lúc chờ | phase2 tests, scenario-fall |
| Ba bản đồ | Đúng tọa độ, cầu, dốc/vách, tháp và bục; có thể đáp lên đảo/tầng đích | maps tests, scenario-spring/ramp, ảnh GUI |
| Gió Lạc | Chỉ đêm 2/3, sinh 1200k, ≤2; idle/chase/flee; cướp 3, pulse trả đồ và removed | phase2 tests, scenario-drifter |
| Bùa Gió | Nhặt C1/C2, 600 tick, chạy 7.2, dash không hồi, respawn 2700 | phase2 tests, scenario-charm |
| Gió mạnh | 1800k, 300 tick, hướng seeded, đẩy 2 m/s; lá bay và âm cảnh báo trước 120 tick | phase2 tests, scenario-wind, GUI |
| Chuỗi đêm | Menu → giới thiệu → chơi → kết quả → đêm sau; thua chơi lại; thắng 3 → Bình Minh; chỉ cộng điểm các đêm thắng | campaign tests và GUI |
| Tạm dừng | Esc/P dừng sim, timer, cooldown, TTL, spawn; Tiếp tục/Chơi lại/Cài đặt/Menu hoạt động | headless pause scenario, GUI |
| Cài đặt | Âm lượng/độ nhạy chuột được áp dụng và giữ qua reload | GUI, settings tests |
| Âm thanh | Nhạc đêm + nhặt/thắp/pulse/hit/jump/dash/win/lose/spawn/10 giây cuối | Web Audio và kiểm tra GUI |
| HUD | Lửa trái, đồng hồ giữa (đỏ nhấp nháy ≤30s), đèn/điểm phải, túi 10 ô dưới, cooldown phải, nhắc E, mũi tên ngoài màn | ảnh GUI |
| Bảng màu, ánh sáng | Màu đúng Ticket-02; ambient = 0.15 + 0.55×tỉ lệ đèn sáng | renderer constants, GUI |
| Headless | CLI 1/2/3; snapshot v1.1, end cuối; exit 2 input lỗi; cùng seed byte-identical; 21.600 tick ≤30s | verify |
| Hiệu năng | Game thường ≥30 FPS trung bình, viewport 1280×720; lưu máy/trình duyệt/thời lượng | báo cáo benchmark GUI thực tế |

Các test Phase 1 giữ kiểm tra movement/edge/pickup/interaction/win/lose/JSONL.
Test version đổi 1.0→1.1; pulse đổi flames→carried; fixture thắp đèn đổi
theo cost 10. Không bỏ qua test cũ. Không tuyên bố đã đạt test ẩn chưa được cung cấp.
