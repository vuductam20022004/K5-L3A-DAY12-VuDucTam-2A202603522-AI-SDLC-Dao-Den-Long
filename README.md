# Đảo Đèn Lồng — Đèn cạn dầu

Game 3D TypeScript + Three.js + Vite. Cùng Mây gom đom đóm, thắp đèn và vượt
qua Đảo Bến, Đảo Cau, Đảo Chuông. Phạm vi hiện tại: **Phase 3 / Ticket-03,
Test Contract v1.2** — giữ đảo sáng tới bình minh.

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
| E | Nạp/châm dầu vào đèn nhận được gần nhất trong 2 m |
| Q | Tỏa Sáng: tốn 3 đom đóm, bán kính 5 m, hồi 3 s |
| Esc / P | Tạm dừng / tiếp tục |

Túi bắt đầu 10, tăng 2 sau mỗi lần thắp thành công (kể cả thắp lại), tối đa 20.
Đèn thắp mới cần 10 đom đóm, thắp lại cần 5; có thể nạp nhiều lần. Mỗi lần thắp
có 100 dầu, tự hao 1/giây. Bấm E để châm thêm 10 dầu mỗi đom đóm, tối đa 100.

Đèn có dầu ≥30 giữ vùng an toàn 6 m. Dưới 30 thì nhấp nháy và mất vùng an toàn;
Bóng Mực đi tới hút thêm 5 dầu/giây mỗi con. Tỏa Sáng ngắt hút; châm dầu trở
lại ≥30 đẩy bóng ra ngoài. Đèn tắt xẹp và có vết rách để nhận ra không cần màu.

Bạn có 3 Ngọn Lửa mỗi đêm. Bị đánh mất 1 lửa và rơi nửa túi; rơi khỏi đảo mất cả
túi, hồi sinh sau 1 giây nếu còn sống. Mở Cài đặt để bật **Bảng màu dễ phân biệt**:
viền/mắt bóng xanh lam sáng, cảnh báo trắng kèm ⚠; tùy chọn được lưu qua reload.

Đảo Cau có cầu tre và bục nhảy. Đảo Chuông có dốc, ba tầng và gió mạnh. Gió Lạc
ở đêm 2/3 cướp đom đóm; Tỏa Sáng vào kẻ đang chạy trốn để lấy lại. Bùa Gió cho
10 giây chạy nhanh và lướt không hồi chiêu. Cài đặt âm lượng/độ nhạy được lưu
trên trình duyệt. Nhạc và hiệu ứng bắt đầu sau thao tác người chơi.

## Điểm số và chuỗi Đêm

| Hành động | Điểm |
|---|---:|
| Nạp/châm dầu 1 đom đóm | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Tỏa Sáng trúng bóng thường / bóng đang drain | Tổng +5 / +15 mỗi con mỗi lần |
| Bình minh, mỗi đèn đang sáng (chỉ khi thắng) | +50 + floor(dầu thực còn lại) |
| Bình minh, mỗi Ngọn Lửa còn lại (chỉ khi thắng) | +50 |

Không thắng sớm dù tất cả đèn sáng. Đêm 1/2/3 dài 240/270/300 giây; tới bình
minh cần giữ ít nhất **3/5, 4/6, 5/7 đèn** tương ứng và Mây còn sống. Hết lửa
luôn thua trước, kể cả tick cuối. Không còn thưởng thời gian.

Nhặt đom đóm không cộng điểm. Tổng chiến dịch chỉ gồm các đêm **đã thắng**.
Thua được chơi lại đúng đêm đó. Thắng đêm 3 hiện **Bình Minh** và tổng điểm.

## Build, headless và kiểm chứng

```bash
npm run build
node dist/headless.js --seed 1 --night 3 --ticks 18000 --out out.jsonl
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

`verify` chạy typecheck, toàn bộ test, build GUI/headless, 23 scenario có
assertion hành vi, kiểm tra byte-identical ở cả ba Đêm, exit code và benchmark
18.000 gameplay tick ≤30 giây. Windows không có Bash dùng `npm run verify`.
CI chạy cùng script khi push/PR.

Kiểm chứng GUI (Node 22+, Chrome hoặc Edge đã cài; mở dev server ở terminal khác):

```bash
npm run test:gui
```

Harness dùng profile Chrome mới trong `artifacts/`, viewport 1280×720, kiểm tra
điều khiển/menu/pause/cài đặt/chuỗi ba Đêm, lưu ảnh và đo FPS thực tế của WebGL.
Có thể đặt `CHROME_PATH` và `GUI_URL`. Báo cáo nêu rõ đo trong Chrome headless;
nghe âm thanh và kiểm tra cửa sổ thường là bước kiểm tra thủ công bổ sung.

Bằng chứng mới: [`docs/proof/phase-3/`](docs/proof/phase-3/).
Tiêu chí nghiệm thu: [`docs/spec/phase-3.md`](docs/spec/phase-3.md).
Giả định: [`docs/notes/assumptions-phase-3.md`](docs/notes/assumptions-phase-3.md).
Quyết định thiết kế: [ADR-003](docs/adr/003-lantern-fuel-and-dawn.md).
Các thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md).
Proof các phase trước được giữ nguyên; tag `phase-2` giữ code và luật cũ.

Dầu tính bằng đơn vị nguyên 1/60, chỉ làm tròn khi xuất. Vì hao dầu trước tương
tác, đèn ban đầu đầy đã hao 1/60 tại lúc bấm E và có thể dùng 1 đom đóm để châm,
dù màn hình làm tròn còn 100,0. Điểm bình minh dùng dầu thật trước làm tròn.

## Sáng tạo của tôi

- Vệt sáng mờ dưới đom đóm, chỉ là Sprite trong renderer.
- Lời thoại ngắn khi từng đèn được thắp và màn Bình Minh kết thúc hành trình.
- Nhạc đêm và SFX tự tổng hợp bằng Web Audio, không cần tải asset bên ngoài.

Các phần hiển thị/âm thanh không thêm thực thể hay thay đổi output headless.
Ảnh minh chứng nằm trong `docs/proof/phase-3/screenshots/`.

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
Quy trình agent: [AGENTS.md](AGENTS.md), [skill kiểm chứng](skills/verify-phase3/SKILL.md).
