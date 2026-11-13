# Mountain Courtyard — Plan 3: Fix the Amphitheatre & South Parking Area

Goal: make the area south of the convention centre (amphitheatre, parking drive, access-road ends) match the
reference render (`public/assets/images/site-render.webp`). **Nothing outside the marked area may change.**

## Status — created 2026-11-13

**Legend:** ✅ Done · ⏳ Pending

| Task | Status | Summary |
|---|---|---|
| P3.1 Lock the boundary | ⏳ | Save the marked outline and take "before" images, so we can prove nothing else changed |
| P3.2 Parking drive + turning head | ⏳ | Replace the short connector stub with the long parking drive and its turning head |
| P3.3 Access road (spine) | ⏳ | Move the spine onto the render's line and run it into the turning head |
| P3.4 West road merge | ⏳ | The west road joins the spine inside the marked area. Its tail to the hairpin junction is removed (approved 2026-11-13) |
| P3.5 Amphitheatre | ⏳ | Turn it to face the drive, make it a half-ring, enlarge it to the render's size, remove the round plaza |
| P3.6 Planted median | ⏳ | Tree and hedge wedge between the drive and the spine |
| P3.7 Knock-on fixes | ⏳ | Furniture, hedges and flower beds that were tied to the plaza; car route; hotspot text |
| P3.8 Rebuild & verify | ⏳ | Rebuild the model, compare against the render, prove nothing else changed |

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
1. Add the outline above to `layout.js` as `PLAN3_AREA`. It is used only by tools and checks, not by the model.
2. With the current model, capture **before** images: a top-down orthographic frame of the whole site plus the eight camera presets, at a fixed size, with the intro, cars, birds and clouds frozen.

### P3.2 Parking drive + turning head
- `layout.js`: replace the `connector` road with `amphi-drive` (centreline, width, parking rules above). Remove `ringNoParking`'s special case only if it covers ground that is now the drive mouth. The ring's own parking must not change: check the bay count on the ring before and after.
- `layout.js`: add pad `turning-head`. Remove pad `plaza`.
- `structures.js`: replace `plaza()` with `turningHead()`: an asphalt disc plus a kerb ring with gaps where the roads enter. Remove `FEATURES.plaza`.

### P3.3 Spine
- `layout.js`: new `parking-spine` points and parking rules (above).

### P3.4 West road merge
- `layout.js`: new `west-road` points. `roads.js`: move the parked car.
- Removing the ~10 m tail outside the marked area is approved.

### P3.5 Amphitheatre
- `layout.js`: new `FEATURES.amphitheatre` values and pad.
- `structures.js` `amphitheatre()`: arc 0…180°, upper walkway band, stage half-disc on the drive side, aisles at 45° / 90° / 135°, backdrop scaled.

### P3.6 Planted median
- `vegetation.js`: add the median wedge (hedges along kerbs, trees, and the path strip as ground paint). Keep the existing scatter's exclusion rules so random trees don't land on the new drive or turning head. Kerb-hedge logic already follows roads without bays.

### P3.7 Knock-on fixes (all inside the area, or data only)
- `furniture.js`: remove the plaza benches and bollards. Put 4 benches along the amphitheatre's upper walkway and bollards round the turning head where no road enters.
- `vegetation.js`: remove the plaza hedge ring and flower-bed ring.
- `src/hero/config.js` `traffic.inbound`: the cars currently climb the connector, (−13.2,−1.2) and the points before it. Re-route them hairpin → spine → turning head → drive → ring, so they still reach the ring `loop`. This changes only the path cars follow inside the area.
- `src/hero/content.js`: the amphitheatre text says "facing a stage and plaza". Change it to "facing a stage".
- Hotspot `amphitheater` follows `FEATURES.amphitheatre.pos` automatically. Check that its label still sits over the seats.

### P3.8 Rebuild & verify
1. Rebuild the model with the usual one-command script (`tools/build_assets.py`), then reload with `?tier=ultra`.
2. **Render match:** top-down view of the area next to the render crop (380–1000 × 480–910 px). Drive, turning head, median, amphitheatre orientation and the west-road merge must line up within ~2 m.
3. **Nothing else changed:** capture the same **after** images as in P3.1 and pixel-diff them, masked by `PLAN3_AREA` plus a 3 m margin. Any difference outside the mask is a failure, except the removed west-road tail. Also compare per-group triangle and instance counts between the old and new GLB. Only `Roads`, `Parking`, `Amphitheater`, `Plaza` (removed), the turning head, furniture and vegetation may differ, and only by amounts that fit the area.
4. `tools/validate-model.html` still passes: the hotspot groups (`Amphitheater`, `Parking`, `EntranceGate_West`, …) exist, and the triangle and draw-call budgets hold.
5. Moving cars follow the new route without cutting corners or driving through the median. No console errors.

## Files that will change
`src/model/layout.js`, `src/model/structures.js`, `src/model/roads.js` (parked car only), `src/model/furniture.js`,
`src/model/vegetation.js`, `src/hero/config.js` (car route only), `src/hero/content.js` (one sentence), the rebuilt model files,
and this plan.

## Decisions and open points
1. **West-road tail (P3.4):** approved on 2026-11-13. The ~10 m of west road just outside the marked area is removed.
2. The render is a perspective image with some lens skew, so positions above are good to about ±1.5 m. Once the first pass is built, fine-tune by overlaying the render.
