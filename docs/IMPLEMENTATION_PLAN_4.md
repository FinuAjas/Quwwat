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
| H2 Fix and refine the figures | ⏳ | Apply the H1 decisions, fix the known flaws, re-render the two images |
| H3 Make them light | ⏳ | Cut from 290,000 triangles to about 45,000 or fewer |
| H4 Put them in the model | ⏳ | Add the `People` group to the site build and the exported model files |
| H5 Make them behave in the page | ⏳ | Shadows, phones, clicking, and nothing overlapping them |
| H6 Gentle motion | 💤 | Swings, roundabout, clapping guests. Only if wanted |
| H7 Text and thumbnails | ⏳ | Hotspot text mentions weddings and events; preset thumbnails re-rendered |
| H8 Rebuild and verify | ⏳ | Rebuild the model and posters, check size, speed and "nothing else changed" |

## Where things stand

- The people exist only in the preview tool. The website and the exported model files do not contain them yet.
- The figures are stylised: capsule bodies, no faces, flat colours. They match the low-poly cars and buildings, but they are not photo-real.
- Counts today: 27 figures in the play area (18 children, 9 adults) and roughly 100 at the wedding (the couple, 7 more on the stage, 5 standing on the top walkway, and the seated guests, who are placed at random and not counted exactly).
- Weight today: about 290,000 triangles. The whole of `Structures` is 39,000, so this is far too heavy to ship as it is.
- Nothing is committed. New files: `src/model/people.js`, `tools/people-preview.html`, `tools/people-preview.js`, `docs/previews/`. Changed: `serve.py` (one save route).

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

### H3 Make them light
File: `src/model/people.js` only. Target: **45,000 triangles or fewer in total, and at most 150 KB added to the download (gzip).**

1. Fewer segments: limb capsules 5 sides and 1 cap ring, heads 8×6. That alone gives roughly 250 triangles a figure.
2. Simpler far figures: seated guests on tiers 3 to 5 drop hands, feet and neck.
3. Make the geometry indexed (`mergeVertices`) before export, so shared vertices are stored once.
4. The preview tool prints the triangle count; re-render and check the figures still read well at the two preview distances and from the aerial preset.

**Done when:** the count is at or under the target and the images are still acceptable.

### H4 Put them in the model
1. `src/model/buildSite.js`: call `buildPeople()` and add the group to the root. Add `people` counts to `stats`.
2. `tools/model-builder.js`: add `'People'` to the details part (`mountain-courtyard-details.glb`), so the first view of the site is not delayed. No new file, so `serve.py`, `config.js` and `validate-model.js` keep their three file names.
3. Re-export: with `serve.py` running, open `tools/model-builder.html?save`.
4. Open the page and confirm the people appear in both places.

**Done when:** the people are visible on the normal page, loaded from the model files, and `tools/validate-model.html` passes.

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
2. Nothing else changed: run `tools/plan3-snapshot.html?set=after` and `python tools/plan3_diff.py` against a snapshot taken before H4. Differences are allowed only at the play area and the amphitheatre.
3. Frame rate on the low tier (`?tier=low`) is no worse than before H4.
4. Update the status table in this plan and commit.

## Files that will change
`src/model/people.js`, `src/model/buildSite.js`, `tools/model-builder.js`, `src/hero/config.js` (low-tier rule),
`src/hero/hotspots.js` (only if clicking needs it), `src/hero/content.js` (one sentence), the rebuilt model files and
posters, and this plan. Already added by H0: the preview tool, the `serve.py` save route and `docs/previews/`.

## Decisions
All decided by the owner on 2026-11-14.

1. **Figure style:** keep the stylised figures.
2. **Wedding attire:** as shown in the preview. Bride in an ivory gown with veil and bouquet, groom in a navy suit, about half the women guests with a headscarf.
3. **Crowd size:** as shown. Roughly 100 at the wedding and 27 in the play area.
4. **Decoration:** keep both the flower arch and the petals.
5. **Visibility:** people are always visible.
