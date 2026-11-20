# Bao chung kiem chung — Phase 1 (PRD-0)

Moi yeu cau chinh cua PRD-0 va cach chung minh no dang.
Bang chung thuoc cung ma nguon tai tag `phase-1`.

| # | Yeu cau PRD-0 | Cach kiem chung | Bang chung | Ket qua |
|---|---|---|---|---|
| R1 | Game 3D, nhan vat di/nhay, camera 3D | Chay GUI, anh chup | `screenshots/gameplay-window.webp`, `screenshots/gameplay.png` | DAT |
| R2 | Dem 1 – Dao Ben, 5 Den Lhong Lon tren dao tron | Snapshot headless | `run-default.jsonl` — `lanterns` co 5 id L1..L5, ban kinh 18 m | DAT |
| R3 | Dom dom rai rac, nhat duoc | Scenario + unit test | `run-default.jsonl` (event `mote_picked`), `tests/gameplay.test.ts` | DAT |
| R4 | Nap anh sang vao den, den sang, thang khi thap het | Scenario nap sang den | `run-lit.jsonl` — `deposit` → `lantern_lit` ×5 → `game_over won/all_lit` | DAT |
| R5 | Bong Muc xuat hien va duoi nguoi choi | Scenario + unit test | `run-shade.jsonl` (khoang cach giam dan), `tests/shades.test.ts` | DAT |
| R6 | Toa sang xua Bong Muc, ton anh sang | Scenario + unit test | `run-pulse.jsonl` (event `pulse`, `stunned_ids`), `tests/shades.test.ts` | DAT |
| R7 | Cham Bong Muc mat mau | Unit test | `tests/shades.test.ts` — `player_hit {by:"shade"}`, flames giam | DAT |
| R8 | Thang/thua, diem so, HUD | Dong `end` co `score` + anh HUD | `run-lit.jsonl` dong cuoi, `screenshots/gameplay-window.webp` | DAT |
| R9 | Choi lai sau khi thang/thua | Nut "Choi lai" reset state | `src/main.ts` (`startGame`), anh overlay ket qua | DAT |
| R10 | `game.contract.json` + headless CLI + JSONL + tinh dinh | `npm run verify` | `verify-output.txt` (buoc 4/5 byte-identical, buoc 5/5 exit 2) | DAT |

## File bang chung

| File | Noi dung |
|---|---|
| `verify-output.txt` | Output that cua `npm run verify` (typecheck + 39 test + 4 scenario + tinh dinh + exit code) |
| `unit-tests.txt` | Output rieng cua `vitest run` |
| `run-default.jsonl` | Chay mac dinh: `--seed 1 --night 1 --ticks 600` |
| `run-lit.jsonl` | Scenario nap sang den → thang |
| `run-shade.jsonl` | Scenario Bong Muc duoi nguoi choi |
| `run-pulse.jsonl` | Scenario toa sang choang Bong Muc |
| `screenshots/gameplay-window.webp` | Anh game dang choi (HUD, dao, Bong Muc) |

## Chay lai

```bash
npm ci
npm run verify
```

Ket qua phai giong het voi `verify-output.txt`.
