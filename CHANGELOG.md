# Changelog

## v1.0.0 / Phase 4 — Bình minh (Contract 1.3)

- Benchmark cửa sổ1280×720: canonical200wander/100motes/5đèn với3đèn sáng,
  camera15s/vòng, warmup3s, rawdt, FPS/p1-low/p95/load và thông tin máy.
- Instancing bóng/đom đóm ở cảnh đông, giữ hình khối/ánh sáng chuẩn; không đổi
  gameplay hay JSONL headless. Soak10Đêm trong cùngprocess với seed/input chuẩn.
- Bảng điểm top10 lưu đĩa, tên hợp lệ, tie theo thời điểm, CLI export và menu.
- Đổi9phím, báo trùng, reset/lưu; chữ18px/lớn×1.25, giảm chuyển động, caption
  và mũi tên khi bóng xuất hiện, chỉ báo gió/10giây/cuối dầu.
- ZIP web+Node không cần node_modules, workflow Release, demoMP4, retro và proof.
- Thay đổi giao diện lệnh: contract_version1.3, thêm bench_cmd/soak_cmd;
  run_cmd chuyển từ `npm run dev` sang `node dist/server.js` để hỗ trợ --export-leaderboard.
  Headless vẫn ở `node dist/headless.js` / `npm run headless`, luậtv1.2 giữ nguyên.
  Bảng điểm cần server Node có quyền ghi, mở file HTML trực tiếp không lưu được.

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

## Phase 2 — Ba hòn đảo (Contract 1.1)

- Chuẩn hóa60tick, movement6, jump7/gravity−20, carry10, lamp10, pulse3/5m,
  đèn an toàn6m; mở rộng3bản đồ và chuỗi3Đêm, pause, cài đặt/âm thanh/HUD.
- Thêm lướt14m/s, bùa, bục nhảy, gió và Gió Lạc; scenario và snapshotv1.1.
- Hằng số thay giá trị Phase1 tự chọn. Duration300/330/360, điểm và thắng sớm
  của phase này đã được Ticket-03 thay thế; không còn áp dụng ởv1.0.0.
- Bổ sung test/headless/ảnh và harness; bằng chứng/tag phase-2 được giữ nguyên.

## Phase 1 — Đêm đầu (Contract 1.0, baseline được tiếp nhận)

- Khung game Three.js/TypeScript, một đảo, Mây, đom đóm, đèn và Bóng Mực.
- Core seeded tách renderer, CLI JSONL và các test đầu tiên; AGENTS ban đầu.
- Baseline tiếp nhận không có tag phase-1. Không dựng lại tag giả từ mã phase sau;
  giới hạn lịch sử và đánh giá ban đầu được nêu trong retro/AI log.
