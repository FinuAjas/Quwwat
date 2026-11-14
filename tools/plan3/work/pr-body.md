Makes the area south of the convention centre follow the reference render (`public/assets/images/site-render.webp`). Full notes and measurements are in `docs/IMPLEMENTATION_PLAN_3.md`.

## What changed
- **Parking drive and turning head (P3.2):** the short connector is replaced by a drive from the ring road to an asphalt turning head at (560,752). The round plaza is gone.
- **Access road (P3.3):** moved onto the render's line and run into the turning head.
- **West road (P3.4):** merges into the access road at (843,652). Its old tail to the hairpin junction is removed (the one approved change outside the work area).
- **Amphitheatre (P3.5):** a half-ring on the drive's NW kerb, facing the drive.
- **Median (P3.6):** an evenly graded, planted bank between the drive and the access road, with a flight of steps.
- **Knock-on fixes (P3.7):** benches on the amphitheatre walkway, bollards round the turning head, moving cars re-routed, hotspot text.
- **Rebuild (P3.8):** the three model files and both posters.

## Keeping the rest of the site unchanged
Parked cars, plants, furniture and rocks are scattered with running random sequences, so moving a road reshuffled them across the whole site. `src/model/legacy.js` keeps the pre-Plan-3 layout; every scatter is placed on both layouts, and the old placement is kept outside the work area.

## Verification
- `tools/plan3_diff.py` (before/after top views, masked by the work area + 3 m and the approved tail): 12 pixels differ in `top.png`, 0 in `top-wide.png`. The script exits with 1 because of those 12 pixels.
- Model validator: contract OK, 27 passed, one warning (41 materials, budget 40).
- Size budgets pass: first view 1,637 KB, whole page 2,459 KB, model 5.05 MB.
- Page loads at `?tier=ultra` with no console errors.
- Moving cars stepped through one full lap: inside the area, off the asphalt by at most 0.62 m at one junction corner.

## Known differences from the render
- The amphitheatre is 10.6 m in outer radius, not about 15.5 m, and the median is a 2-9 m bank, not a 17 m flat wedge. The model's roads are 7 m wide against the render's roughly 4 m, so the render's sizes do not fit.
- Parking bays line one side of the drive, not both.
- A bare bank with rocks shows below the access road where the old west road ran.
- Inside the work area, kerbs are left out where they would lie on another road's surface; this opens the ring road's kerb across the mouth of the drive.
- The "Visitor Parking" hotspot camera moved slightly, because it frames all parked cars.

This branch also carries commits that are not on `main` yet from before Plan 3 (R7, R9, "Removed Master Plan", "Navbar links").

🤖 Generated with [Claude Code](https://claude.com/claude-code)
