# Đảo Đèn Lồng — Ba hòn đảo

Game 3D TypeScript + Three.js + Vite. Cùng Mây gom đom đóm, thắp đèn và vượt
qua Đảo Bến, Đảo Cau, Đảo Chuông. Phạm vi hiện tại: **Phase 2 / Ticket-02,
Test Contract v1.1**.

## Chạy nhanh

Cần Node.js 20+ (khuyến nghị 22 LTS) và npm.

```bash
npm ci
npm run dev
```

Mở `http://localhost:5173`, chọn **Bắt đầu hành trình**, đọc lời Ông Đăng và
chọn **Vào cuộc đêm**. Menu/giới thiệu không làm trôi thời gian. Trên PowerShell
nếu `npm.ps1` bị Execution Policy chặn, dùng `npm.cmd` thay `npm`.

## Điều khiển

| Phím | Hành động |
|---|---|
| WASD / phím mũi tên | Di chuyển theo camera |
| Click vào thế giới, di chuột | Khóa con trỏ và xoay camera; giữ chuột kéo nếu không khóa được |
| Space | Nhảy khi chạm đất |
| Shift | Lướt; 14 m/s trong 0,2 s, hồi 1,5 s; giữ độ cao trên không |
| E | Nạp vào đèn chưa sáng gần nhất trong 2 m |
| Q | Tỏa Sáng: tốn 3 đom đóm, bán kính 5 m, hồi 3 s |
| Esc / P | Tạm dừng / tiếp tục |

Giữ tối đa 10 đom đóm. Mỗi đèn cần 10, có thể nạp nhiều lần. Bạn có 3 Ngọn Lửa
mỗi đêm. Bị đánh mất 1 lửa và rơi nửa túi; rơi khỏi đảo mất cả túi, hồi sinh sau
1 giây nếu còn sống. Đèn đã thắp tạo vùng an toàn 6 m đối với Bóng Mực.

Đảo Cau có cầu tre và bục nhảy. Đảo Chuông có dốc, ba tầng và gió mạnh. Gió Lạc
ở đêm 2/3 cướp đom đóm; Tỏa Sáng vào kẻ đang chạy trốn để lấy lại. Bùa Gió cho
10 giây chạy nhanh và lướt không hồi chiêu. Cài đặt âm lượng/độ nhạy được lưu
trên trình duyệt. Nhạc và hiệu ứng bắt đầu sau thao tác người chơi.

## Điểm số và chuỗi Đêm

| Hành động | Điểm |
|---|---:|
| Nạp 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Tỏa Sáng trúng 1 Bóng Mực | +5 mỗi lần, kể cả đang choáng |
| Thưởng thắng | floor(giây còn lại) × 2 + 50 × Ngọn Lửa còn lại |

Nhặt đom đóm không cộng điểm. Tổng chiến dịch chỉ gồm các đêm **đã thắng**.
Thua được chơi lại đúng đêm đó. Thắng đêm 3 hiện **Bình Minh** và tổng điểm.

## Build, headless và kiểm chứng

```bash
npm run build
node dist/headless.js --seed 1 --night 3 --ticks 21600 --out out.jsonl
```

CLI: `--seed <int> --night <1|2|3> --ticks <int> --out <file.jsonl>`;
thêm `--scenario <file.json>`, `--inputs <file.json>`, `--snapshot-every <int>`
(mặc định 10). JSONL bắt đầu bằng snapshot tick 0, kết thúc bằng `end`.
`--ticks N` chạy đúng N bước đồng hồ; sau kết thúc không chạy thêm gameplay.
Pause vẫn tăng `tick`, đóng băng `sim_tick`. Stdout sạch; lỗi ghi stderr;
exit 0 thành công, exit 2 khi input/scenario/CLI sai định dạng.

```bash
npm test
npm run verify
bash scripts/verify.sh
```

`verify` chạy typecheck, toàn bộ test, build GUI/headless, 13 scenario có
assertion hành vi, kiểm tra byte-identical ở cả ba Đêm, exit code và benchmark
21.600 gameplay tick ≤30 giây. Windows không có Bash dùng `npm run verify`.
CI chạy cùng script khi push/PR.

Kiểm chứng GUI (Node 22+, Chrome hoặc Edge đã cài; mở dev server ở terminal khác):

```bash
npm run test:gui
```

Harness dùng profile Chrome mới trong `artifacts/`, viewport 1280×720, kiểm tra
điều khiển/menu/pause/cài đặt/chuỗi ba Đêm, lưu ảnh và đo FPS thực tế của WebGL.
Có thể đặt `CHROME_PATH` và `GUI_URL`. Báo cáo nêu rõ đo trong Chrome headless;
nghe âm thanh và kiểm tra cửa sổ thường là bước kiểm tra thủ công bổ sung.

Bằng chứng mới: [`docs/proof/phase-2/`](docs/proof/phase-2/).
Tiêu chí nghiệm thu: [`docs/spec/phase-2.md`](docs/spec/phase-2.md).
Giả định: [`docs/notes/assumptions-phase-2.md`](docs/notes/assumptions-phase-2.md).
Bằng chứng Phase 1 được giữ nguyên, chỉ phản ánh mã Phase 1 tại thời điểm tạo.

## Sáng tạo của tôi

- Vệt sáng mờ dưới đom đóm, chỉ là Sprite trong renderer.
- Lời thoại ngắn khi từng đèn được thắp và màn Bình Minh kết thúc hành trình.
- Nhạc đêm và SFX tự tổng hợp bằng Web Audio, không cần tải asset bên ngoài.

Các phần hiển thị/âm thanh không thêm thực thể hay thay đổi output headless.
Ảnh minh chứng nằm trong `docs/proof/phase-2/screenshots/`.

## Kiến trúc và đóng gói

`src/core/` là TypeScript thuần: không DOM/Three.js/Math.random/Date.now.
`src/render/` và `src/main.ts` đọc state, ánh xạ input và dựng giao diện.
`game.contract.json` chứa tuning và các hằng số luật; bản đồ chuẩn trong
`src/core/maps.ts` được dùng chung cho va chạm và hiển thị.

Docker (chưa được kiểm thử nếu máy không có Docker):

```bash
docker build -t dao-den-long .
docker run --rm -p 8080:8080 dao-den-long
```

GUI tại `http://localhost:8080`. Headless:
`docker run --rm -v "$PWD/out:/out" dao-den-long node dist/headless.js --seed 1 --night 2 --ticks 600 --out /out/run.jsonl`.

Nguồn tài sản/công cụ: [CREDITS.md](CREDITS.md). Giấy phép: [LICENSE](LICENSE).
Quy trình agent: [AGENTS.md](AGENTS.md), [skill kiểm chứng](skills/verify-phase2/SKILL.md).
