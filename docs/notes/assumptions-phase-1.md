# Gia dinh — Phase 1 (PRD-0)

PRD-0 co y do "mo ho co chu dich". Duoi day la cac gia dinh da chon, kem cach kiem chung.

## Hinh hoc the gioi

| Muc | Gia dinh | Ly do |
|---|---|---|
| Dao | Tron, tam (0,0,0), ban kinh **30 m**, mat dat Y = 0 | PRD-0: "mot hon dao tron". To chuc hop ly so voi 5 den o ban kinh 18 m. |
| 5 Den Lhong Lon | Nam tren vong tron ban kinh **18 m**, goc lech **72 deg**, id `L1..L5` | Contract yeu cau "cap nhat theo id cac den cua man (L1..L5)". `L1` dat o (0,0,-18). |
| Dom dom | 20 con mac dinh, rai trong ban kinh 26 m, cao hien thi 0.6 m | "Dom dom xuat hien rai rac tren dao". Vi tri ngau nhien dung PRNG seeded. |
| Bong Muc | 3 con mac dinh, xuat hien o ria dao, **cach nguoi choi it nhat 18 m**, moi con sau cach nhau **15 s** | "Bong Muc xuat hien va duoi nguoi choi". Khoang cach 18 m cho nguoi choi co thoi gian phan ung (quan sat thuc te khi choi thu). |

## Sức manh va mau

| Muc | Gia dinh |
|---|---|
| `flames` (suc manh / anh sang trong den nho) | Bat dau **3**, toi da **5**, hoi **+1 moi 3 giay**, ve 0 = thua (`no_flames`) |
| `carry_capacity` | Mang toi da **5** dom dom |
| `lantern_cost` | Mot den can **5** anh sang |
| Binh sat | **1.5 s** sau khi bi cham |
| `hit_drop_ratio` | **0.5** — bi cham mat mot nua so dom dom dang mang; dom dom rơi ra **2.0–3.5 m** canh nguoi choi va co the nhat lai |
| `pulse_cost` | Toa sang ton **1** diem anh sang |
| `pulse_stun_s` | Choang **2 s** |
| `pulse_push_m` | Day Bong Muc ra **3 m** |
| `pulse_cooldown_s` | **1.5 s** |
| `safe_radius` | Vung an toan ban kinh **4 m** quanh moi den da thap; Bong Muc khong vao duoc |

## Luật khac

- `fall_enabled: false` → nguoi choi bi chan o mep dao, **khong co su kien `by:"fall"`**.
- `night1_duration_s: 300` (5 phut). Het gio = thua (`dawn`).
- Chua thap het den = van `playing`.
- `interact` nap vao den **gan nhat chua sang** trong `interact_radius` (3 m).
- `deposit` nap **nhieu nhat mot lan** theo so dom dom mang; den sang khi `deposited >= lantern_cost`.
- Nut `jump/interact/pulse` kich hoat theo **edge trigger** (false → true), dung theo contract.
- Di chuyen: vector `move` chuan hoa ve do dai 1, xoay theo `cam_yaw_deg` theo dung cong thuc contract.
- Nguoi choi khong the chen nhau; khong co vat pham (phase sau).

## Moi truong

| Muc | Gia dinh |
|---|---|
| Camera | 3rd person, sau lung nhan vat, xoay bang chuot (yaw + pitch), khoang cach 9 m |
| Nhan vat "May" | Capsule kem + non la xanh + den nho ben hong |
| Bong Muc | Qua cau tim-don + "von" con, mau tim-den, choang thi sang mau |
| Ngan sach tuoi sang | Bong Muc khong duoc di qua vung an toan cua den da thap |

## Diem so

Diem cong ngay khi su kien xay ra + thuong diem cuoi dem (moi giay con lai, moi diem anh sang con lai).
Gia tri nam trong `game.contract.json` → `tuning.score` va duoc `src/core/config.ts` import truc tiep.

## Nhung cho PRD-0 khong noi ro va ta da tu quyet

1. **Ban co the dung "anh sang" lam mau cua nhan vat?** PRD-0: "toan sang ... ton anh sang", "mat het mau thi thua".
   → Dung mot bien duy nhat `flames` lam ca mau lan nang luong.
2. **Dom dom la "diem sang" hay "vat pham"?** → Moi dom dom = 1 don vi anh sang. Khong ton dia.
3. **Bong Muc co the bi giet khong?** → Khong. Chi bi choang va day lui. Giu don gian, dung yeu cau.
4. **Sang tao co duoc them thuc the khong?** → PRD-0 cho phep, nhung contract cam "thuc the them nen tat khi chay headless".
   → Phan sang tao cua toi chi nam o tang hien thi (render/HUD), khong them thuc the game.
