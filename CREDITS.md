# CREDITS

## Code

- Phase 1 và khung Phase 2: Cursor Agent / Claude Opus theo ghi chép ban đầu.
- Hoàn thiện Phase 2, sửa logic, kiểm thử và tài liệu: OpenAI Codex theo Ticket-02 người dùng cung cấp.
- Tac gia: Vu Duc Tam (2A202603522).

## Asset hinh anh / am thanh

- **Khong dung asset ben ngoai.** Moi hinh khoi, vat lieu, mau sac va hieu ung trong game
  duoc sinh truc tiep bang ma (Three.js primitives: Sphere, Cone, Cylinder, Ring, Sprite).
- Không dùng ảnh, nhân vật, thương hiệu hoặc mô hình của game/phim có sẵn.
- Nhạc nền và toàn bộ SFX do mã Web Audio (`src/render/audio.ts`) tổng hợp bằng oscillator/envelope; không dùng sample bên ngoài.
- Ảnh trong `docs/proof/` là ảnh chụp chương trình chạy thật, không phải asset nhập vào game.

## Thu vien

| Thu vien | Phan quyen | Vai tro |
|---|---|---|
| [three](https://github.com/mrdoob/three.js) | MIT | Render 3D |
| [vite](https://github.com/vitejs/vite) | MIT | Dev server + build web |
| [vitest](https://github.com/vitest-dev/vitest) | MIT | Unit test |
| [typescript](https://github.com/microsoft/TypeScript) | Apache-2.0 | Ngon ngu |
| [esbuild](https://github.com/evanw/esbuild) | MIT | Bundle headless |

## Van ban ban giao

- PRD-0, Ticket-02 và Test Contract v1.0/v1.1: yêu cầu của lab, do người dùng cung cấp; không sao chép nội dung board chưa phát hành.
