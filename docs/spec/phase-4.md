# Acceptance criteria — Phase 4

| Mục | Kiểm chứng |
|---|---|
| Benchmark canonical | Count200wander/100motes/3lit fuel100, player0, camera r30/y15/period15; không input/spawn/hit/pickup/fuel/end |
| Bench timing/statistics | Warmup3s không đo; duration30s, công thức N/sumdt, p1-low, nearest-rankp95; load≤10s; JSONv1.3 |
| Bench thresholds | Chạy thật: avg≥60, p1-low≥30 trên máy local tham khảo; ảnh/cấu hình/flags/timestamps/rawdt |
| Soak | seed7+n index0, cycle1/2/3, probabilities và direction30tick;10nights cùngprocess, crashes0, RSSend≤1.2start |
| Leaderboard | Namevalidation, sumwon/nights_won/ISOtz/seed, top10 scoredesc/timeasc; ghiđĩa, restart, exportCLI đúngthứtự |
| Accessibility | Rebind9actions, duplicatewarning, defaults/persist; spawnindicatorarrow, wind/countdown/lowfuel captions; reducedmotion; min18px/large×1.25 |
| Regression | Output headless gameplay byte-identical với phase-3; test còn hiệu lực chạy, không skip |
| Packaging | Cleanfolder cài/chạy≤3lệnh; runnablezipweb+Node server/headless/soak/bench; LICENSE/CREDITS/4phasechangelog |
| Demo/retro | MP4 thật<5phút có chơi/test/headless/bench; retro1–2trang, token estimate trung thực |
| Release | Commit bench.json/soak.json/proof; tagphase-4 +v1.0.0; publish release +artifact vào repo cá nhân public |
