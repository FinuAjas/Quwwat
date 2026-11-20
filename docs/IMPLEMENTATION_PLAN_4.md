# Mountain Courtyard — Plan 4: Humans Plan

Goal: put people into the 3D model in two places, so the site feels alive and shows scale.

- **Children's play area:** children playing on the equipment, with a few parents.
- **Amphitheatre:** a wedding, with the bride and groom on the stage and guests around them.

**Nothing else on the site may change.** Each task below is one step and one commit.

## Status — created 2026-11-14

**Legend:** ✅ Done · ⏳ Pending · 💤 Optional

| Task | Status | Summary |
|---|---|---|
| H0 Preview | ✅ | Figures built in `src/model/people.js`; two approval images in `docs/previews/` (see the notes under H0) |
| H1 Approve the look | ✅ | Stylised figures, attire and crowd as in the preview, arch and petals kept, always visible (see Decisions) |
| H2 Fix and refine the figures | ✅ | Flaws fixed, figures refined, both images re-rendered (see the notes under H2) |
| H3 Make them light | ✅ | 334,000 → 38,000 triangles; about 343 KB to download once H4 drops the stored normals (see the notes under H3) |
| H4 Put them in the model | ✅ | `People` group in the site build and in `mountain-courtyard-details.glb`; nothing else in the model changed (see the notes under H4) |
| H5 Make them behave in the page | ⏳ | Shadows, phones, clicking, and nothing overlapping them |
| H6 Gentle motion | 💤 | Swings, roundabout, clapping guests. Only if wanted |
| H7 Text and thumbnails | ⏳ | Hotspot text mentions weddings and events; preset thumbnails re-rendered |
| H8 Rebuild and verify | ⏳ | Rebuild the model and posters, check size, speed and "nothing else changed" |

## Where things stand

- Since H4 the people are part of the model: the `People` group is in `mountain-courtyard-details.glb`, which the page loads after the first view, with the furniture and rocks.
- The figures are stylised: capsule bodies, no faces, flat colours. They match the low-poly cars and buildings, but they are not photo-real.
- Counts today: 26 figures in the play area (18 children, 8 adults: 3 standing, 5 on benches) and roughly 105 at the wedding (the couple, 7 more on the stage, 5 standing and 6 seated on benches on the top walkway, and the seated guests, who are placed at random and not counted exactly).
- Weight today: 38,026 triangles; 23,765 vertices as stored in the model file, without normals (334,000 triangles after H2). The details file grew from 72 to 417 KB gzipped.
- Each task is committed on its own on `p3-south-area`. Files: `src/model/people.js`, `tools/people-preview.html`, `tools/people-preview.js`, `docs/previews/`, one save route in `serve.py`, and from H4 the build and export changes listed under H4.

## Scope (hard rule)

- New geometry appears only on the play area pad and inside the amphitheatre (stage, tiers, top walkway).
- **Do not touch:** terrain, roads, buildings, play equipment, amphitheatre shape, planting, lighting, camera presets, post-processing.
- The model contract stays as it is: group names, `userData.hotspotId`, `Hotspot_*` anchors, `Terrain`, the `Water*` material.
- H8 proves this with the Plan 3 snapshot tool: pixels may differ only around the two places.

## Tasks

### H0 Preview — done 2026-11-14
- `src/model/people.js`: `buildPeople()` returns a group `People` with two meshes, `People_PlayArea` and `People_Wedding`. Each figure is posed from joint angles and built from capsules; one place is one merged, vertex-coloured mesh. The meshes sit in the same local frames as the play area and the amphitheatre.
- `tools/people-preview.html` (needs `serve.py`): loads the real page, adds the people to the live scene, and renders two 1920×1200 stills through the full post-processing.
- `serve.py`: new `POST /api/save-preview`, which writes only `.jpg` files into `docs/previews/`.
- Saved: `docs/previews/people-play-area.jpg` and `docs/previews/people-wedding.jpg`.

### H1 Approve the look (owner)
Look at the two images and decide the points below. Nothing is built in this task.

1. **Figure style.** Keep the stylised figures (recommended: same style as the rest of the model, small files), or replace them with ready-made realistic 3D people. Realistic people need downloaded models with a licence that allows commercial use, add several MB, and will look out of place next to the low-poly cars.
2. **Wedding attire.** The preview shows an ivory gown with veil and a navy suit; about half the women wear a headscarf. Say what the couple and guests should wear.
3. **Crowd size.** Roughly 100 at the wedding and 27 in the play area. More, fewer, or as shown.
4. **Decoration.** The flower arch on the timber backdrop and the petals on the stage were added without being asked for. Keep or remove.
5. **Always there, or switchable.** People always visible (recommended, simplest), or only when the hotspot is opened.

**Done when:** the five answers are written under "Decisions" at the end of this plan.

**Done 2026-11-14.** All five answers are under "Decisions". H2 therefore changes no colours or counts; it only fixes the flaws and refines the figures.

### H2 Fix and refine the figures
File: `src/model/people.js` only.

1. Apply the H1 decisions (attire colours, counts, decoration).
2. Fix the known flaws:
   - The mother pushing the swing stands inside the swing's path; move her back and to the side.
   - Seated guests on the lowest tier: their feet go into the stage edge.
   - Seated women have no skirt shape; add a short lap piece so they do not look like they wear trousers.
   - Check that every bench sitter is on a real bench (the bench list comes from `furniture.js`; the preview assumes five).
3. Small realism gains that cost little: slightly narrower waists and tapered limbs, hair variety, two or three more poses for guests (hands in lap, turned to a neighbour).
4. Re-render with `tools/people-preview.html` and compare with the H0 images.

**Done when:** the two new images show no figure passing through equipment, seats or another figure.

**Done 2026-11-20.** Checked in the two approval shots and in four close-ups (play area from above and low down, the stage up close, the amphitheatre from above).
- **Swing:** the mother now stands 1.3 m behind the seat and half a step to the side, out of its path.
- **Stage edge:** guests on the lowest tier sit 0.28 m further back, so knees and feet stay clear of the raised stage.
- **Seated dresses:** seated women get one piece over the lap and down the shins instead of two trouser legs.
- **Benches:** parents sit only on benches the model really has. The preview reads them from the `Benches` mesh; the play area has 4, not the 5 the H0 preview assumed (`furniture.js` tries five; one is not built, and why was not looked into). `buildPeople({ benches })` takes the list; without it the five from `furniture.js` are assumed, so H4 must pass the real list from `buildSite.js`.
- **Walkway benches:** the four benches on the amphitheatre's top walkway now have 6 guests seated on them; the standing guests moved so they do not stand in front of the benches.
- **Other overlaps found in the close-ups and fixed:** the cheering child at the foot of the slide stood inside the roundabout; the mother and toddler stood against the swing frame's leg; two running children crossed the slide's landing.
- **Refinements:** tapered chests with rounded shoulders and narrower waists; wider hips on women; a hair bun on about a third of the women without a scarf; two new seated poses (hands in lap, taking a photo) and a few guests turned towards a neighbour; the father of the bride in grey instead of off-white, so he no longer blends into the bride.
- **Images:** `docs/previews/people-play-area.jpg` and `people-wedding.jpg` are the H2 versions; `h0-people-play-area.jpg` and `h0-people-wedding.jpg` keep the H0 versions for comparison.
- **Cost:** the extra parts raised the count from 290,000 to 334,000 triangles. H3 has to cut further than planned.

### H3 Make them light
File: `src/model/people.js` only. Target: **45,000 triangles or fewer in total, and at most 150 KB added to the download (gzip).**

1. Fewer segments: limb capsules 5 sides and 1 cap ring, heads 8×6. That alone gives roughly 250 triangles a figure.
2. Simpler far figures: seated guests on tiers 3 to 5 drop hands, feet and neck.
3. Make the geometry indexed (`mergeVertices`) before export, so shared vertices are stored once.
4. The preview tool prints the triangle count; re-render and check the figures still read well at the two preview distances and from the aerial preset.

**Done when:** the count is at or under the target and the images are still acceptable.

**Done 2026-11-20.** Triangles 334,000 → 38,026 (play area 10,396, wedding 27,630); vertices 30,487.
- **Limbs:** a five-sided spindle (20 triangles) replaces the three.js capsule (126 triangles at the old settings; 50 even at its lowest). Heads 7×5 sphere segments, hair and scarf caps 8×3 to 8×4, hands 8-triangle octahedra, feet four-sided, skirts and trunks open-ended (the waist and the ground hide the ends).
- **Far figures** (`far: true`: seated guests on tiers 2 to 5, and the guests on the walkway benches): no hands, feet, neck or shoulder piece, four-sided limbs, closed trunk top. About 250 triangles each, against about 400 for a near figure. The lowest tier, the stage party and everyone in the play area stay near.
- **Hidden parts not built:** seated women in a dress have no separate legs (the lap piece covers them); standing women in a full-length dress have no thighs or shins (the skirt cone covers them).
- **Decoration:** the flower arch is 78 twenty-sided blooms (was 123 spheres of 160 triangles); petals are flat five-sided discs; the bride's veil, train, hem trim and bouquet use fewer segments.
- **Storage:** positions are rounded to the millimetre and each place's mesh is merged into indexed geometry (`finish()` in `people.js`).
- **Download cost, measured** with the layout the model files use (positions float32, normals int8, colours uint16, gzip): 419 KB as built; **343 KB** once the stored normals are dropped at export (added to H4 step 2). The whole page would go from 2,327 KB to about 2,670 KB, inside the 6,000 KB budget, and the people stream in after the first view with the details file.
- **Size target replaced:** the 150 KB proposed for H3 was a guess before measuring; the owner accepted about 343 KB (Decision 6). Positions are now more than half of the file: they stay float32 because `tools/glb_quantize.py` does not quantize positions. Quantizing them (int16, with a de-quantizing scale on a child node, for these two meshes only) would cut roughly another 100 KB; it is not planned unless asked for.
- **Look:** shading is more faceted, in keeping with the low-poly cars, rocks and buildings; the figures still read well at both preview distances and in close-ups. The flower arch is chunkier. Because the arch now draws fewer random numbers, the random colours after it changed: the two women beside the couple now wear red and pink, and guests' clothes are reshuffled. Counts and attire rules are unchanged.
- **Tool:** `tools/people-preview.html` now prints triangles, vertices and the measured download cost; `window.__preview.measure()` repeats it.

### H4 Put them in the model
1. `src/model/buildSite.js`: call `buildPeople()` and add the group to the root. Add `people` counts to `stats`.
2. `tools/model-builder.js`: add `'People'` to the details part (`mountain-courtyard-details.glb`), so the first view of the site is not delayed. No new file, so `serve.py`, `config.js` and `validate-model.js` keep their three file names.
   - At export, for the two `People_*` meshes only (as is already done for `Terrain`): remove the `normal` attribute, merge vertices again (`mergeVertices`: without normals far more of them are shared, 30,500 → 23,800), set `userData.recomputeNormals = true`, and put the original geometry back after the export. `loader.js` already rebuilds normals for meshes with that flag. Measured in H3: 419 KB → 343 KB gzipped.
3. Re-export: with `serve.py` running, open `tools/model-builder.html?save`.
4. Open the page and confirm the people appear in both places.

**Done when:** the people are visible on the normal page, loaded from the model files, and `tools/validate-model.html` passes.

**Done 2026-11-20.**
- **Baseline for H8, taken first:** before the re-export, `tools/plan3-snapshot.html?set=people-before` saved 21 images and a manifest (with the three model files' SHA-256) to `tools/plan3/people-before/`. The images are git-ignored like Plan 3's; the manifest is kept. The snapshot tool and `serve.py` accept two new set names, `people-before` and `people-after`, so Plan 3's own `before` / `after` images are left alone.
- `src/model/furniture.js`: `buildFurniture` also returns `benches`, where each bench was really built.
- `src/model/people.js`: `buildPeople` returns `{ group, counts: { people, peopleTris } }`.
- `src/model/buildSite.js`: builds the people after the rocks, with the real bench list, and adds the `People` group. The build stats gain `people` (124 figures) and `peopleTris` (38,026).
- `tools/model-builder.js`: `People` goes into `mountain-courtyard-details.glb`. At export the two meshes lose their normals, are merged again (30,487 → 23,765 vertices) and are flagged `recomputeNormals`; the originals are put back afterwards. The builder's stats panel lists the people.
- `tools/people-preview.js`: hides the model's own people and shows the ones built from `src/model/people.js`, so source changes can still be previewed before a re-export.
- **Re-exported** with `tools/model-builder.html?save`. **Nothing else changed:** the core and vegetation files are byte-identical (same SHA-256 as in the baseline manifest). In the details file all 19 existing nodes (furniture, rocks, gate signs) are identical in transforms, vertex data, materials, textures and instancing, checked node by node against the previous file. The only new nodes are `People`, `People_PlayArea` (6,423 vertices, 10,396 triangles) and `People_Wedding` (17,342 vertices, 27,630 triangles).
- **Size:** details file 134 → 823 KB on disk, 72 → 417 KB gzipped (+345 KB; H3 estimated 343 KB). Whole page 2,327 → 2,671 KB (budget 6,000); first view unchanged at 1,576 KB; model on disk 3.85 → 4.52 MB (budget 10). `python tools/build_assets.py --report` passes all three budgets.
- **Live page:** both meshes load from the details file with rebuilt normals and cast and receive shadows. Opening the Children's Play Area and Amphitheatre hotspots shows the children, parents and wedding guests.
- **Validator:** no failures. One warning, materials 42 against a budget of 40: it was already there at 41 before H4, and the people's material adds one. (Wall_Stone, Timber_Frame and Boundary_Wall are each counted twice, because they are used in both the core and the details file.)
- **Not done here:** the poster images still show the site without people; they are re-rendered in H8. The H5 checks (clicking, phones, overlaps) are not done yet.

### H5 Make them behave in the page
Check each point on the live page and fix where needed.

1. **Shadows.** People cast and receive shadows on high and ultra. The shadow map is rendered once; confirm it is refreshed after the details file arrives.
2. **Phones (low tier).** Show a thinned crowd or no shadows from people, whichever keeps the frame rate. Add the rule next to `CONFIG.shadowsFor` in `src/hero/config.js`.
3. **Materials.** `surfaces.js` and `foliage.js` swap materials by name; confirm neither picks up the `People` material.
4. **Clicking.** Clicking a guest or a child must still open the Amphitheatre or Children's Play Area hotspot, not clear the selection (`src/hero/hotspots.js`).
5. **Overlaps.** Grass tufts must not grow through people at the play-area benches; the moving cars' route does not pass the stage.
6. **Hotspot labels.** The pop-up anchors still sit clear above the heads.

**Done when:** all six points are checked on desktop and in the phone-size view.

### H6 Gentle motion (optional)
Only if wanted after seeing H5. It needs the moving figures as separate meshes, so decide before H3 is final.

- Swings sway, the roundabout turns slowly, a few guests clap.
- Runs from the page's animation loop like the cars in `src/hero/life.js`; off when the visitor prefers reduced motion.

### H7 Text and thumbnails
1. `src/hero/content.js`: add one sentence to the Amphitheatre text about weddings and community events.
2. The preset thumbnails and the Site Images gallery are rendered from the live scene, so they pick up the people on their own; check the `recreation` preset shows the play area well.
3. Decide whether the two preview images go into the Site Images gallery.

### H8 Rebuild and verify
1. `python tools/build_assets.py`: rebuilds the model files and the poster images and prints the size report. Budgets: first view 2,200 KB, whole page 6,000 KB, model on disk 10 MB.
2. Nothing else changed: run `tools/plan3-snapshot.html?set=people-after` and compare it with `tools/plan3/people-before/` (taken in H4, before the re-export). Differences are allowed only at the play area and the amphitheatre. `tools/plan3_diff.py` compares only Plan 3's own `before` / `after` sets and masks Plan 3's work area, so it first needs options for the two people sets and a mask round the two places (the play area lies outside Plan 3's area).
3. Frame rate on the low tier (`?tier=low`) is no worse than before H4.
4. Update the status table in this plan and commit.

## Files that will change
`src/model/people.js`, `src/model/buildSite.js`, `tools/model-builder.js`, `src/hero/config.js` (low-tier rule),
`src/hero/hotspots.js` (only if clicking needs it), `src/hero/content.js` (one sentence), the rebuilt model files and
posters, and this plan. Already added by H0: the preview tool, the `serve.py` save route and `docs/previews/`.

## Decisions
All decided by the owner: 1 to 5 on 2026-11-14 (H1), 6 on 2026-11-20 (H3).

1. **Figure style:** keep the stylised figures.
2. **Wedding attire:** as shown in the preview. Bride in an ivory gown with veil and bouquet, groom in a navy suit, about half the women guests with a headscarf.
3. **Crowd size:** as shown. Roughly 100 at the wedding and 27 in the play area.
4. **Decoration:** keep both the flower arch and the petals.
5. **Visibility:** people are always visible.
6. **Download size:** about 343 KB gzipped for the people is accepted, in place of the 150 KB proposed before measuring. Quantizing positions to shrink it further is not planned.
