# Mountain Courtyard — Plan 3: Fix the Amphitheatre & South Parking Area

Goal: make the area south of the convention centre (amphitheatre, parking drive, access-road ends) match the
reference render (`public/assets/images/site-render.webp`). **Nothing outside the marked area may change.**

## Status — created 2026-11-13

**Legend:** ✅ Done · ⏳ Pending

| Task | Status | Summary |
|---|---|---|
| P3.1 Lock the boundary | ✅ | Outline saved as `PLAN3_AREA`; 15 "before" images and a manifest saved in `tools/plan3/before/` (see the notes under P3.1) |
| P3.2 Parking drive + turning head | ✅ | `amphi-drive` replaces the connector; asphalt turning head at (560,752) replaces the plaza (see the notes under P3.2) |
| P3.3 Access road (spine) | ✅ | Spine moved onto the render's line and run into the turning head (see the notes under P3.3) |
| P3.4 West road merge | ✅ | The west road joins the spine at (843,652); its tail to the hairpin junction is removed (see the notes under P3.4) |
| P3.5 Amphitheatre | ✅ | Half-ring on the drive's NW kerb, facing the drive. Outer radius 10.6 m, not 15.5 m: that is all that fits (see the notes under P3.5) |
| P3.6 Planted median | ✅ | A planted bank, not the render's wide flat wedge: the strip is 2–9 m wide and drops 2.5–6 m (see the notes under P3.6) |
| P3.7 Knock-on fixes | ✅ | Walkway benches, turning-head bollards, new car route, hotspot text (see the notes under P3.7) |
| P3.8 Rebuild & verify | ✅ | Model and posters rebuilt; 12 pixels differ outside the area; layout matches the render, sizes do not (see the notes under P3.8) |

## What is wrong now

All positions are in layout pixels, the same frame as `src/model/layout.js` and the 1600×1203 render. 1 px = 0.15 m.

| # | Model today | Render (correct) |
|---|---|---|
| 1 | A short, wide **connector** drops south from the ring, (700,545) → (738,652), and ends on the spine. | A long **parking drive** leaves the ring at about (712,553) and runs **south-west** beside the amphitheatre, with bays on both sides. It ends in a **rounded turning head** at about (560,752). |
| 2 | The **spine** (access road from the hairpin junction) dead-ends at a **round paved plaza**, (640,722). | The spine runs ~2–4 m further south than in the model and continues south-west into the **same turning head**. The drive and the spine form one loop. |
| 3 | A **round plaza** (r = 6 m) sits SE of the amphitheatre, with benches, bollards, a hedge ring and flower beds. | **No plaza.** That ground is the drive, the turning head and the median. |
| 4 | **Amphitheatre**: centre (585,672), rot 33°, 7 tiers, outer radius ≈ 12 m. The seating wraps ~196°, its open side faces SSE onto the plaza, and it stands alone on a lawn. | Centre ≈ (597,682), outer radius ≈ 15.5 m (with the top walkway). The seating is a **half-ring (~180°) on the NW side**. Its **straight open side runs along the drive's NW kerb** and faces SE onto the drive. The stage is a half-disc in front of the seats. |
| 5 | No planting between the connector and the spine. | A **planted median wedge** (trees, hedge, a short red path) between the drive and the spine. It is ~17 m wide at the NE end, narrows towards the turning head, and parking bays line its edges. |
| 6 | The **west road** runs on its own all the way to the hairpin junction. The section (860,692) → (1040,555) cuts across the lawn wedge. | The west road **merges into the spine at about (815,648)**. A tree strip separates the two roads up to that point. East of the merge there is only lawn, with a tree row along the spine. |

The ring road, main building, pool, parking round the ring, pergolas north of the spine, west gate, hairpin road
and everything outside the marked area already match the render. They stay as they are.

## Scope boundary (hard rule)

The marked area, as layout pixels (taken from the annotated screenshot):

```
(997,566) (965,680) (895,758) (833,808) (776,845) (717,883) (642,905) (551,906) (445,878)
(388,787) (381,680) (442,594) (523,548) (640,520) (780,500) (917,482)
```

- Every geometry change must lie inside this polygon.
- **One approved exception (P3.4):** the west road's tail from about (990,600) to the hairpin junction (1040,555), roughly 10 m. It only exists because the west road currently runs to the junction on its own. Once it merges inside the area, that tail must go, otherwise a road would end in the middle of the lawn. Nothing replaces it. Approved by the owner on 2026-11-13.
- **Do not touch:** the ring road and its parking, the main building, pool, pergolas, gates, hairpin road, terrain outside the area, forest, camera presets, lighting or post-processing.
- Things that are generated across the whole site (street lamps along roads, kerbs, road shoulders, grass tufts, scattered trees) will update **inside** the area only, because only the roads inside the area change. P3.8 checks this.

## Target design (numbers to build from)

### Parking drive — new road `amphi-drive` (replaces `connector`)
- Centreline: `(712,553) → (695,578) → (681,594) → (655,632) → (628,670) → (602,709) → (585,732)`, then into the turning head.
- Width 7 m, kerbs, no centre dashes (it is a parking aisle).
- Parking bays on **both** sides along the straight part. On the **left (NW)**, bays stop where the amphitheatre's straight edge begins (~(657,587) to (585,697)), so no bays sit in front of the stage. The render shows two accessible bays (hatched) at the ring end on that side.
- A small triangular **traffic island** stays between the ring and the drive mouth, (600,572)–(710,555), planted with a hedge and two trees as in the render.

### Turning head
- A paved asphalt bulb centred at **(560,752)**, outer radius **7.5 m**, kerbed all round except where the drive and the spine enter.
- Build it as a short closed road ring or as an asphalt disc. The disc is simpler: reuse the old plaza disc code with the asphalt material and road-surface shader.
- Grade it with a new pad `turning-head` at the terrain height sampled at its centre (≈ 89 m), falloff 5 m.

### Spine (`parking-spine`) — re-aligned
- New centreline: `(1040,550) → (965,582) → (935,595) → (880,620) → (815,642) → (755,665) → (695,692) → (625,717) → (595,735)`, then into the turning head.
- The east end, (1040,550) → (965,582), lies outside the marked area and stays **exactly** as it is.
- Keep the existing bays on the north side between x = 693 and 1027 px. Add bays on the north side from x ≈ 690 down to the median tip (the render shows parked cars at (735,665) and (790,640)).

### West road — merge (P3.4)
- New centreline: `(520,905) → (585,858) → (660,797) → (730,730) → (790,670) → (815,648)`, ending where it joins the spine. Give it a short taper so the two road surfaces blend without a gap.
- Remove the points (860,692), (960,640) and (1040,555).
- Move the one parked car on the west road (`roads.js`, the `west-road` special case at 45 % of its length) so it still sits on the shortened road.

### Amphitheatre
- `FEATURES.amphitheatre`: pos **(597,682)**, rot **≈ 45°**, so the straight edge of the seats is parallel to the drive (drive heading ≈ 222° compass, so the seats face ≈ 132°).
- Seating arc **a0 = 0°, a1 = 180°**: a true half-ring. Today it is −8° … 188°.
- Size: r0 **6 m** (the stage half-disc), **6 tiers** × 1.05 m, plus a 2.5 m upper walkway band. That gives an outer radius of ≈ 15.5 m, matching the render's wide light-grey outer sweep.
- Stage: a half-disc of r0 + 1.0 m on the open side, its straight edge on the drive's NW kerb line. Keep the timber backdrop frame, scaled to the new r0.
- Pad `amphitheatre`: centre (597,682), radius 16 m, keep elev 93, falloff 6.
- Its obstacle radius (used by tree placement) follows the new outer radius automatically.

### Planted median
- A wedge between the drive and the spine, from the drive mouth (≈ (720,600)) to a rounded tip ≈ 8 m before the turning head (≈ (600,722)).
- Hedge along both kerbs, 6–8 broadleaf trees down its middle, and one short red-earth footpath crossing near (740,640), as in the render.
- No trees on the road surfaces or in front of the stage.

## Tasks

### P3.1 Lock the boundary
1. Add the outline above to `layout.js` as `PLAN3_AREA`. It is used only by tools and checks, not by the model. (Since P3.2 the model does read it: see the notes there.)
2. With the current model, capture **before** images: a top-down orthographic frame of the whole site plus the eight camera presets, at a fixed size, with the intro, cars, birds and clouds frozen.

**Done 2026-11-13** (branch `p3-south-area`, model as of commit `ebe1334`).
- `src/model/layout.js`: `PLAN3_AREA_PX` (layout pixels) and `PLAN3_AREA` (world metres). Nothing in the model reads them.
- New tool `tools/plan3-snapshot.html` (`?set=before` or `?set=after`, needs `serve.py`). It loads the real page in a hidden frame, stops the animation, pins the scene clock, hides mist, cars, birds, grass tufts and fountain droplets, and renders at fixed sizes with no post-processing (blur, bloom and ambient occlusion would smear a local change over its neighbours).
- `serve.py`: new `POST /api/save-snapshot`, which writes only into `tools/plan3/before|after/`.
- Saved in `tools/plan3/before/`: 15 PNG images and `manifest.json`. The images (37 MB) are git-ignored; the manifest is kept.
  - **Strict views, sun shadows off (13):** `top.png` (1600×1203, 1 image pixel = 1 layout pixel, north up, so the render and the area outline overlay directly), `top-wide.png` (same centre, 2 layout pixels per image pixel, includes the surrounding forest), the 3 camera presets and one view per hotspot (8), at 1280×800. Shadows are off so that a change inside the area cannot show up outside it as a moved shadow.
  - **Beauty views, shadows on (2):** `beauty-top.png`, `beauty-preset-aerial.png`, for looking at.
  - The page has **3** camera presets, not 8; the "eight" above are the 8 hotspot views.
- The manifest records each view's camera matrices (to project the area outline into perspective views), the SHA-256 and size of the three model files, and triangle and instance counts for all 122 meshes and per group.
- **Repeatability, measured:** even frozen, up to 22 scattered pixels per view flicker from frame to frame, so each image is the per-pixel median of 5 frames. Between two fresh page loads no pixel differed by more than 1 level out of 255 in any view. **P3.8 should therefore count a pixel as changed only if a channel differs by more than a few levels** (the tool reports pixels over 24 levels as "strong").
- Baseline counts (whole model): Terrain 72,160 triangles; Roads 5 meshes / 3,484; Parking 15 meshes / 95 cars; Structures 67 meshes / 39,048; Furniture 11 meshes / 53 instances; Rocks 524; Vegetation 20 meshes / 13,209 plants.

### P3.2 Parking drive + turning head
- `layout.js`: replace the `connector` road with `amphi-drive` (centreline, width, parking rules above). Remove `ringNoParking`'s special case only if it covers ground that is now the drive mouth. The ring's own parking must not change: check the bay count on the ring before and after.
- `layout.js`: add pad `turning-head`. Remove pad `plaza`.
- `structures.js`: replace `plaza()` with `turningHead()`: an asphalt disc plus a kerb ring with gaps where the roads enter. Remove `FEATURES.plaza`.

**Done 2026-11-13.**
- **Centreline taken from the render, not from the numbers above.** Measured on the render, the drive runs
  `(724,541) → (719,562) → (707,584) → (689.6,606.6) → … → (582.5,715.9)`; the list in "Target design" is about 3 m off.
- **Bays on the SE side only, near the ring end.** The model's roads are 1.5–1.9× wider than the render's, so two rows of
  bays do not fit the wedge between the drive and the spine. NW-side bays and the two accessible bays are left out.
- Turning head: asphalt disc r = 7.5 m at (560,752), kerb open where the two roads enter. Its pad is at 90 m and is
  marked `firm` (new, `terrain.js`): a firm pad also pulls the road profiles and the ground beside them onto its level.
  Without it the ground followed the roads' smoothed profiles and buried half the disc.
- The plaza, its pad, benches, bollards, hedge ring and flower-bed ring are gone (the P3.7 removals are therefore done).
- **Keeping the rest of the site unchanged needed new code: `src/model/legacy.js`.** Parked cars, plants, lamps and rocks
  are scattered with running random sequences, so the first build with the new roads reshuffled them across the whole
  site (about 3,700 m² changed outside the area). Now every scatter is placed twice, once on the pre-Plan-3 layout
  (kept in `legacy.js`) and once on the current one; outside `PLAN3_AREA` the old placement is kept, inside it the new
  one. Old trees are also kept for 5 m inside the outline if they still stand clear of roads. So `PLAN3_AREA` **is** now
  read by the model, and P3.4–P3.7 get the same protection without further work.
- New tool `tools/plan3_diff.py` (needs Pillow): compares `tools/plan3/before` and `after`, masks the area plus 3 m,
  counts changed pixels outside it and lists mesh and instance counts that differ.
- **Measured after P3.2 + P3.3:** outside the area `top.png` differs in 206 pixels (5 m²), all at the junction end of the
  spine (parking-bay lines a few centimetres along, and the patch where three road surfaces overlap). Cars, trees,
  lamps and rocks outside the area are identical. The view with sun shadows differs in 848 pixels (19 m²), from shadows
  of things inside the area. Counts: cars 95 → 94, lamps 17 → 18, benches 10 → 6, bollards 18 → 6, plants 13,209 → 13,168,
  rocks 524 → 523.
- **Known, waiting for later tasks:** the old amphitheatre's stage stands on the drive until P3.5 moves it; there is a
  bare bank between the drive and the spine until P3.6 plants the median; the moving cars still follow the removed
  connector until P3.7 re-routes them. The poster images are not re-rendered yet (P3.8).

### P3.3 Spine
- `layout.js`: new `parking-spine` points and parking rules (above).

**Done 2026-11-13.**
- From the junction to x = 990 px the spine is copied point by point from its old curve, so nothing moves outside the
  area. From there it eases onto the render's line, `(960,588) → (930,607) → … → (631,736) → (602,748)`, and ends on the
  turning head. The render's line is roughly 3 m from the centreline listed in "Target design".
- North-side bays run from x = 768 px to 1027 px. West of 768 px the drive's own bays fill the wedge, so the extra bays
  down to the median tip are left out.

### P3.4 West road merge
- `layout.js`: new `west-road` points. `roads.js`: move the parked car.
- Removing the ~10 m tail outside the marked area is approved.

**Done 2026-11-13.**
- New centreline, measured on the render and listed from the merge down to the gate:
  `(843,652) → (822,667) → (800,684) → (770,705.5) → (735,731) → (700,760) → (660,800) → (585,858) → (520,905)`.
  The last three points are the old ones, so the gate end does not move. The merge is at (843,652), on the spine as
  built, not at the (815,648) listed in "Target design" (that point belongs to the plan's spine line, which is ~3 m off).
- No taper was needed. Instead (`terrain.js`, `roads.js`):
  - a road can now say `joins: <road id>`. Within 6 m of that road it takes its level (3 cm lower, so the two surfaces
    do not flicker), easing back to its own profile by 14 m. Before, each road kept its own profile and one would have
    stood above the other;
  - inside the work area, kerbs and centre dashes are left out where they would lie on another road's surface. This
    also opens the ring's kerb across the mouth of the parking drive and removes the kerb stub at the turning head.
    Junctions outside the area keep their crossing kerbs.
- The removed tail: `legacy.js` treats the ground within 8 m of it as work area (`workAreaDistance`), so the hedges and
  trees that lined it are replanted for the new layout. Parked cars are excluded from this, so the bays beside the
  junction keep their cars. `tools/plan3_diff.py` masks 13 m round the tail (the road plus the ground graded to it).
- The parked car on the west road needed no code change: it sits at 45 % of the road's new length, near (700,760).
- **Measured:** outside the area and the tail, `top.png` differs in 12 pixels and `top-wide.png` in none. The view with
  sun shadows differs in 1,738 pixels (39 m²), from shadows. Counts now: cars 94, lamps 17 (as before Plan 3), plants 13,209 → 13,176,
  rocks 524 → 537.
- **Side effects to know about:**
  - Where the old west road crossed the lawn, the ground is back to its natural slope: a bank below the spine with bare
    earth and 13 new rocks. The render shows flat lawn with a tree row there.
  - The "Visitor Parking" hotspot view is framed on the bounding box of all parked cars, so its camera moved a little
    now that the cars in the area changed. Nothing in the view outside the area changed.
  - The steep grey bank between the west road and the turning head was already there below the old plaza; the
    turning head sits closer to it.

### P3.5 Amphitheatre
- `layout.js`: new `FEATURES.amphitheatre` values and pad.
- `structures.js` `amphitheatre()`: arc 0…180°, upper walkway band, stage half-disc on the drive side, aisles at 45° / 90° / 135°, backdrop scaled.

**Done 2026-11-13.**
- **Position:** `pos` (586.6,671.4), rot 45°. `pos` is the middle of the straight, open side, and it lies on the outer
  edge of the drive's NW kerb as built (the render puts it at about (592,672)). The seats are the half-ring NW of
  that line and face SE onto the drive.
- **Size: outer radius 10.6 m, not the 15.5 m asked for.** Measured in the model, the ring road's kerb is 10.3–10.8 m
  from that centre (north to north-east), because the model's roads are 7 m wide and the render's about 4 m. The old
  amphitheatre (12.35 m) already overlapped the ring's kerb by about a metre. Built as: stage r0 = 4.2 m, 5 tiers ×
  1.0 m, 0.9 m upper walkway, 0.5 m wall. Getting to the render's size would need narrower roads or a moved ring road.
- **Arc 0…166°,** not 180°: the last 14° at the SW end would stand on the turning head's rim.
- **Stage:** the half-disc inside the tiers (r0), top 0.25 m above the drive. The old stage on the open side is gone,
  since that ground is now the drive. The timber backdrop is a straight open frame along the stage's straight edge.
- Aisles at 45° / 90° / 135°. Pad moved with the centre; radius 13 m, elev 93 and falloff 6 kept, so the ring road's
  levels do not change.
- Its footprint for planting and furniture is now a box over the half-ring only, so the drive beside it is not blocked.
- The hotspot anchor is 5 m NW of `pos`, over the seats. Checked in the hotspot view: the camera frames the seats.
- **Measured:** outside the area and the tail, `top.png` still differs in 12 pixels and `top-wide.png` in none.
  Validator: contract OK, one warning (41 materials, budget 40). Plants now 13,191.
- The drive drops about 3 m (1.8 m in the model) between the amphitheatre's level and the turning head over a short
  length. It was like this before P3.5 and is not changed here.

### P3.6 Planted median
- `vegetation.js`: add the median wedge (hedges along kerbs, trees, and the path strip as ground paint). Keep the existing scatter's exclusion rules so random trees don't land on the new drive or turning head. Kerb-hedge logic already follows roads without bays.

**Done 2026-11-13.**
- **The render's median does not exist in the model.** Measured kerb to kerb, the strip between the drive and the spine
  is 2–9 m wide, not 17 m, and the drive stands 4–10 m of site level above the spine (2.5–6 m in the model): the drive
  comes down from the ring road at 97 m while the spine climbs from 85 m. So it is built as a planted bank.
- **Grading (`terrain.js`):** a road can say `banksTo: <road id>`. Between such a pair the ground slopes evenly from
  kerb to kerb. Before, it took the level of the nearer road and left a cliff one grid cell wide down the middle.
  Only the drive / spine pair uses it, so nothing outside the area is regraded.
- **Planting (`vegetation.js`, `FEATURES.median`):** the kerb hedges were already there; added a row of broadleaf trees
  down the middle (one every 4 m where there is room and no tree already) and three shrubs per 2 m of bank. It has its
  own random sequence.
- **The red path is a flight of steps** (`Median_Steps`, `structures.js`), from the drive's kerb straight down to the
  spine's at (712,582), in the path colour. A painted flat strip was not possible on a slope that steep.
- **Measured:** outside the area and the tail, `top.png` still differs in 12 pixels and `top-wide.png` in none.
  Plants now 13,204; the model has one more mesh (123).
- Bare earth and some grey rock colour still show on the steepest part of the bank near the turning head: the site's
  ground shader colours steep ground that way everywhere, and it is not changed here.

### P3.7 Knock-on fixes (all inside the area, or data only)
- `furniture.js`: remove the plaza benches and bollards. Put 4 benches along the amphitheatre's upper walkway and bollards round the turning head where no road enters.
- `vegetation.js`: remove the plaza hedge ring and flower-bed ring.
- `src/hero/config.js` `traffic.inbound`: the cars currently climb the connector, (−13.2,−1.2) and the points before it. Re-route them hairpin → spine → turning head → drive → ring, so they still reach the ring `loop`. This changes only the path cars follow inside the area.
- `src/hero/content.js`: the amphitheatre text says "facing a stage and plaza". Change it to "facing a stage".
- Hotspot `amphitheater` follows `FEATURES.amphitheatre.pos` automatically. Check that its label still sits over the seats.

**Done 2026-11-13.**
- `furniture.js`: four benches on the amphitheatre's upper walkway (at 24°, 68°, 112° and 152°, between the aisles,
  facing the stage, standing on the walkway's surface) and eight bollards round the turning head, 1 m outside its
  kerb, where no road enters and the amphitheatre is not in the way. The plaza's benches, bollards, hedge ring and
  flower beds went in P3.2.
- `src/hero/config.js` `traffic.inbound`: hairpin → access road → clockwise round the turning head (4 m radius) → up
  the parking drive → ring. The `loop` round the ring is unchanged.
  **Checked by calculation, not by watching:** the driven line (centre line and the 1.75 m left lane, with a 0.9 m car
  half-width) was sampled every 1.5 m against the road surfaces. Inside the area it leaves the asphalt at one place
  only, by up to 0.9 m, on the corner from the drive onto the ring. The real code moves cars towards the middle of
  the road on tight left turns, which this check did not model. The other spots it reported are on the ring and the
  hairpin, on the unchanged part of the route.
- `src/hero/content.js`: "facing a stage and plaza" → "facing a stage".
- Hotspot anchor: moved over the seats in P3.5.
- **Measured:** outside the area and the tail, `top.png` still differs in 12 pixels and `top-wide.png` in none.
  Validator: contract OK, one warning (41 materials, budget 40). Furniture now: lamps 18, benches 10, bollards 14.

### P3.8 Rebuild & verify
1. Rebuild the model with the usual one-command script (`tools/build_assets.py`), then reload with `?tier=ultra`.
2. **Render match:** top-down view of the area next to the render crop (380–1000 × 480–910 px). Drive, turning head, median, amphitheatre orientation and the west-road merge must line up within ~2 m.
3. **Nothing else changed:** capture the same **after** images as in P3.1 and pixel-diff them, masked by `PLAN3_AREA` plus a 3 m margin. Any difference outside the mask is a failure, except the removed west-road tail. Also compare per-group triangle and instance counts between the old and new GLB. Only `Roads`, `Parking`, `Amphitheater`, `Plaza` (removed), the turning head, furniture and vegetation may differ, and only by amounts that fit the area.
4. `tools/validate-model.html` still passes: the hotspot groups (`Amphitheater`, `Parking`, `EntranceGate_West`, …) exist, and the triangle and draw-call budgets hold.
5. Moving cars follow the new route without cutting corners or driving through the median. No console errors.

**Done 2026-11-13.**
1. **Rebuild:** `python tools/build_assets.py --no-open --port 5173` rebuilt the three model files and both posters.
   Size report: first view 1,637 KB (budget 2,200), whole page 2,459 KB (budget 6,000), model on disk 5.05 MB (budget 10).
   The page loads at `?tier=ultra` with no console errors.
2. **Render match** (`tools/plan3/work/compare-p38.png`: render, model before, model after, same crop):
   - On the render's lines, within ~2 m: the parking drive, the turning head, the spine and the west-road merge.
   - Matches in layout but **not in size**: the amphitheatre (10.6 m outer radius against ~15.5 m) and the median (a
     2–9 m planted bank against a ~17 m flat wedge). Both follow from the model's roads being 7 m wide against the
     render's ~4 m, and from the drive standing above the spine. Bays line one side of the drive, not both.
   - Not in the render: the bare bank with rocks below the spine where the old west road ran.
3. **Nothing else changed** (`tools/plan3_diff.py`, output saved as `tools/plan3/work/final-diff.txt`):
   - Outside the area (+3 m) and the approved tail: `top.png` 12 pixels, `top-wide.png` 0 pixels. The script still exits
     with 1 because of those 12 pixels.
   - `beauty-top.png` (sun shadows on): 1,734 pixels (39 m²), shadows cast from inside the area.
   - Counts, before → after: Terrain 72,160 triangles (same); Roads 3,484 → 3,278 triangles; Parking 95 → 94 cars;
     Structures 67 → 68 meshes; Furniture 53 → 50 instances (lamps 17 → 18, benches 10, bollards 18 → 14);
     Rocks 524 → 537; Vegetation 13,209 → 13,204 plants.
   - The "Visitor Parking" and "Pergola Gate — West" hotspot views differ over the whole frame: their cameras are
     framed on groups that changed inside the area (see P3.4). The other perspective views were not masked or measured.
4. **Validator:** contract OK, 27 passed, one warning (41 materials, budget 40). All eight hotspot groups exist.
5. **Moving cars:** the page's own animation was stepped through one full lap (127 s, every 0.2 s) and one car's
   position tested against the road surfaces with a 0.9 m half-width. Inside the area it is off the asphalt in three
   samples: by 0.62 m and 0.19 m on the corner from the drive onto the ring (the kerb is open there), and by 0.12 m at
   the turning head. It does not cross the median. Steepest pitch inside the area: 10°. Three more samples, up to
   1.11 m, are on the ring road's north side, on the unchanged part of the route.

## Files that will change
`src/model/layout.js`, `src/model/structures.js`, `src/model/roads.js` (parked car only), `src/model/furniture.js`,
`src/model/vegetation.js`, `src/model/terrain.js`, `src/model/rocks.js`, `src/model/buildSite.js`, the new `src/model/legacy.js`
(these four so that nothing outside the area changes), `src/hero/config.js` (car route only), `src/hero/content.js` (one sentence), the rebuilt model files,
and this plan. P3.1 also added tooling that the model does not use: `tools/plan3-snapshot.html` / `.js`, a save endpoint in
`serve.py`, and `.gitignore`.

## Decisions and open points
1. **West-road tail (P3.4):** approved on 2026-11-13. The ~10 m of west road just outside the marked area is removed.
2. The render is a perspective image with some lens skew, so positions above are good to about ±1.5 m. Once the first pass is built, fine-tune by overlaying the render.
