# Mountain Courtyard — Plan 2: Cinematic & Realistic Look

Goal: move from the current clean low-poly look to a photographic, "architectural render" look
(like the reference hero image): natural colour, real materials, soft sunlight, depth and atmosphere —
while keeping the hero fast (target: 60 fps desktop, 30+ fps mid phones, ≤ 6 MB first load).

## Status — updated 2026-11-13

**Legend:** ✅ Done · 🟡 Partial · ⏳ Pending — code · 🎨 Pending — artist · ⏸ Waiting on something else · ➖ Not built (optional, skipped)

| Phase | Owner | Status | Summary |
|---|---|---|---|
| R0 Ready for an artist model | Code | ✅ 6 · ⏸ 1 | Any terrain shape, split files, foliage shader, KTX2, lightmaps, validator page. R0.7 (re-tune camera) waits for the artist's model. |
| R1 Colour & tone | Code | ✅ 5 | AgX, real-world palette, tree tints, procedural building weathering, colour grade, three looks. |
| R2 Lighting & sky | Code | ✅ 5 | Procedural sky reflections, fitted shadows that soften with distance, contact shadows, baked ground shade. |
| R3 Camera effects | Code | ✅ 5 | Bloom, tilt-shift, vignette, grain, colour fringe; phones keep grade + vignette + grain. |
| R4 Atmosphere | Code | ✅ 3 · ➖ 1 | Distance haze, valley mist, softer mist banks, horizon ridges. Sun shafts skipped. |
| R5 Ground materials | Code (procedural) | ✅ 6 | Terrain, road and paving detail from shaders, soft earth shoulders, grass tufts near the camera, rocks — all generated in code, no texture files. |
| R6 Vegetation | Code (procedural) | ✅ 5 | Leaf-card trees, palms, shrubs, hedges and flower beds, three distance levels, noise-driven forest — all generated in code. An artist's hand-modelled trees can still replace them later. |
| R7 Architecture detail | Code (procedural) | ✅ 8 | Building kit with windows, doors, verandahs, eaves and ridge caps; tiled pool floor with caustics and fountain particles; amphitheatre steps and backdrop; play equipment; lamps, benches, bollards, signs and a compound wall; three car styles. An artist model can still replace it. |
| R8 Life & motion | Code | ✅ 4 | Spline fly-in (skippable), drifting cloud shadows, moving cars and birds, settling camera moves. |
| R9 Pipeline & performance | Both | ✅ 3 · 🟡 2 · 🎨 1 | Poster, benchmark-picked tiers and the three-file model are done; one-command rebuild and size report exist. Mesh compression needs Node.js; real-phone test and a Lighthouse re-run are still open. |

**Task count:** 50 done · 2 partial · 0 pending (code) · 1 pending (artist) · 1 waiting · 1 not built — 55 tasks in total.

### Completed so far (R0–R8, R9.4, R9.5)
- The page accepts an artist-built model without code changes, and `tools/validate-model.html` checks a model against the brief.
- Golden-hour look by default, with midday and overcast available (`?look=`).
- Real-world colours, per-tree tints, lawn mottling; model re-exported (5.1 MB before gzip, 95 parked cars, 1.05 M triangles, 122 draw calls).
- Sky-based reflections and ambient light, fitted shadow map, desktop contact shadows, baked ground shading for all devices.
- Bloom, tilt-shift blur, vignette, film grain and a slight colour fringe.
- Distance haze, valley mist, softer mist banks and three layers of horizon hills; camera can tilt to 80°.
- A 6.5 s opening flight over the forest (skippable), cloud shadows drifting across the land, cars driving the access road and ring, a flock of birds, and camera moves that ease into place.
- A poster image of the scene is on screen from the first paint and stays when 3D is unavailable or data saver is on; the 3D code is only downloaded when it will be used.
- Three quality tiers (ultra / high / low), picked by a short GPU benchmark on the first visit.
- Ground, vegetation and architecture detail (R5–R7) generated in code: textured-looking surfaces, leaf-card trees, a Kerala-style building kit, a tiled pool with caustics and a droplet fountain, play equipment, street furniture, a compound wall and three car styles.

### Pending — code (can be done now)
1. **R9.6** Real-phone test, frame-rate check and a Lighthouse re-run once the latest fixes are published (first scores are recorded in the R9 table).
2. **R9.1** Mesh and texture compression (Meshopt/Draco, KTX2) — needs Node.js installed; the rebuild-and-report script is done.

### Pending — artist (see [BLENDER_ARTIST_BRIEF.md](BLENDER_ARTIST_BRIEF.md))
- Optional: replace the procedural buildings, trees and cars (R5–R7) with hand-modelled, textured ones. The page accepts them without code changes.
- **R9.3** Texture budget; exporting with Draco + WebP.

### Blocked until the artist delivers
- **R0.7** Re-tune camera presets, pan bounds and hotspot focus distances.
- **R9.2** Re-decide the file split once the artist's model arrives (the procedural model is already split in three).
- **R9.5** re-render the poster images from the artist's model (open the page with `?tier=ultra&poster` while `serve.py` is running).
- **R8** re-tune on the artist's model: intro flight path, car route (`CONFIG.intro`, `CONFIG.traffic`).

### Known gaps in what is marked done
- Nothing has been tested on a real phone; the phone tier was only exercised with `?tier=low` on desktop.
- KTX2 textures and baked lightmaps are wired in but untested (no such assets yet).
- Midday and overcast looks were not re-checked after the haze shader (R4) went in.
- Frame rate in the preview pane read 72–144 fps with all desktop effects on; the pane throttles unevenly, so treat it as rough.
- Lighthouse scores exist for the poster page only (its test machine has no GPU); the 3D scene itself has never been scored. Three fixes made after that run have not been re-scored.
- The forest's late arrival (R9.2) was checked by driving the grow-in by hand and by load order in the network log, not by watching it on a slow connection.
- `tools/build_assets.py` was run end to end with the pages opened by hand (`--no-open`); the path where it starts its own server and opens the browser itself was not exercised.
- A browser tab opened in the background can benchmark many times slower than the GPU really is (measured 41.7 ms vs 0.8 ms on the same machine). Slow results are therefore not remembered between visits, but that visit still gets the low tier.
- R8 was checked in the desktop preview pane only (both tiers load without errors); the portrait/phone intro path and the cloud shadows under the midday and overcast looks were not checked by eye.
- The tier benchmark's thresholds were calibrated on one machine only (RTX 5050 laptop, 0.8 ms → ultra); integrated-GPU desktops and phones are untested, so their tier choice is a best guess. `?debug` logs the measurement.
- The no-WebGL and data-saver paths were exercised only through the `?3d=off` preview switch, not on a real device with those conditions.
- The mobile poster was rendered from the portrait preset but not viewed on a phone.
- The distance-based soft shadows (R2.3) were checked on the golden-hour look and the high tier; midday, overcast and their frame-rate cost on a mid-range GPU are unmeasured.
- Building weathering (R1.3) was checked on the convention centre from one close view and the aerial view, golden-hour look only; the plot boundary wall is left out because it follows the terrain.
- Vegetation (R6) was checked from the aerial view and one close view on the high and ultra tiers, golden-hour look. The flower beds were not looked at close up, and the frame-rate cost of the alpha-clipped leaves on a mid-range GPU or a phone is unmeasured.
- Leaf-card plants take no ambient occlusion (they still cast and receive shadows and have baked ground shade).
- Ground work (R5) was checked from the aerial view and two close views on the high tier, golden-hour look. The brick footpath, pool-deck tiles and road paint were not looked at close up; the cost of the grass tufts on a mid-range GPU is unmeasured.
- Rock placement follows slope and noise, not the rock areas on the contour survey.
- Architecture detail (R7) was checked in the model builder (convention centre, pool, amphitheatre, play area, south gate) and in the page on the high tier, golden-hour look (pool, convention centre front). The prayer hall, west gate, signs, lamps and benches were not looked at close up in the page; the phone tier was not checked.
- R7 buildings are designed by rule, not from architect's drawings: window counts, door positions and the verandah are plausible, not surveyed. Windows are mounted on solid walls, so there are no interiors.
- The model grew from about 3.2 MB to 5.1 MB with R7 (still under the 10 MB target; the checker page passes with no warnings).
- The preset thumbnails sometimes came up blank on the first page load after re-exporting the model and were fine on the next load; not tracked down.
- Moving cars do not cast real shadows (the shadow map is rendered once); each carries a soft blob shadow instead.

## Where the realism gap was at the start of Plan 2
| Area | Before Plan 2 | Why it looked artificial |
|---|---|---|
| Colour | Flat saturated greens/oranges, ACES tone map | No colour grading, no tonal variation, greens too uniform |
| Materials | Plain colours, no textures | No grain: grass, asphalt, tiles, plaster all look like plastic |
| Trees | Low-poly blobs (130 tris) | Silhouettes are smooth; no leaves, no light passing through |
| Terrain | Vertex colours on a 1.5 m grid | No grass detail, no soil/rock, hard road edges |
| Buildings | Boxes + hip roofs | No windows/doors/eaves/columns, no wall texture, no detail |
| Lighting | Sun + hemisphere + room env | No sky HDRI, no ambient occlusion, no bounce light |
| Camera | Clean perspective | No depth of field, bloom, vignette or film grain |
| Atmosphere | Linear fog + mist sprites | No aerial perspective (blue haze with distance), no light shafts |

## Decisions needed first
1. **Asset source** — (A) keep procedural + add CC0 textures/models (Poly Haven, ambientCG, Quaternius — free, no attribution needed); (B) a 3D artist rebuilds the site in Blender (highest realism, needs time/budget); (C) A now, swap in B later (recommended — the hotspot/name contract stays the same).
2. **Install Node.js (LTS)** — needed only on your machine for the asset pipeline (`gltf-transform` for Draco/Meshopt/KTX2 texture compression). Hosting stays static (GitHub Pages).

**Decision (2026-11-13): option B — a Blender artist rebuilds the site model.**
The artist's contract is in [BLENDER_ARTIST_BRIEF.md](BLENDER_ARTIST_BRIEF.md).

### Who does what under option B
| Phase | Owner | Notes |
|---|---|---|
| R1 Colour & tone | Code | Can start now; final palette re-tuned when the artist model arrives |
| R2 Lighting & sky | Code | Start now (HDRI, sun, AO pass) |
| R3 Post-processing | Code | Start now |
| R4 Atmosphere | Code | Start now |
| R5 Ground & landscape materials | **Artist** | Textures baked/authored in Blender (R5.5 grass tufts stays code) |
| R6 Vegetation | **Artist** (models, LODs) + Code (R6.2 wind/translucency shader, phone thinning) | |
| R7 Architecture detail | ~~Artist~~ → done procedurally in code (see the status table) | An artist model can still replace it |
| R8 Life & motion | Code | |
| R9 Pipeline & performance | Artist exports Draco + WebP; Code does loading, tiers, poster | Node.js optional now |

### Phase R0 — Make the page ready for an artist-built model · 6 of 7 done
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R0.1 | ✅ Done | Ground-height lookup must not assume the blockout's regular grid: bake a height map from the `Terrain` mesh at load (one-off downward raycasts into a 2D array) | Camera guard works on any terrain mesh | Height map is rasterised from the terrain triangles (not raycasts). Verified: all 8 label heights unchanged. |
| R0.2 | ✅ Done | Loader accepts 1–3 GLB files (core first, vegetation/details streamed in after the first frame) | Split delivery works | `models.core` + `models.extras` in `config.js`. Verified with a simulated extra file; a missing file is skipped with a warning. |
| R0.3 | ✅ Done | Foliage support: alpha-clipped leaves cast correct shadows; optional wind + back-light shader applied to meshes flagged `vegetation` | Leaf-card trees render and shadow correctly | Wind sway + back-light glow on all near trees (`foliage.js`). Leaf-card shadows need no extra code; untested until real leaf-card trees arrive. |
| R0.4 | ✅ Done | KTX2Loader wired in (optional GPU-compressed textures) | `.ktx2` textures load if the artist supplies them | Wired in; **untested** — no KTX2 textures exist yet. |
| R0.5 | ✅ Done | Baked AO (glTF occlusion texture, native) + lightmap via mesh custom property `lightMap` = file name, on UV2 | Artist bakes show up | Wired in; **untested** — no baked lightmaps exist yet. |
| R0.6 | ✅ Done | `tools/validate-model.html`: loads a GLB and reports contract errors (missing names/hotspots/anchors, non-instanced trees, triangle and draw-call budget, size) | Artist/developer get a pass/fail list | Current model passes every check (one expected warning on the Parking label). |
| R0.7 | ⏸ Waiting | Camera presets, pan bounds, hotspot focus distances re-tuned on the delivered model | Presets frame correctly | Can only be done on the artist's delivered model. |

The asset tasks in R5–R7 below now describe **what the artist delivers** (see the brief's checklist).

---

## Phase R1 — Colour & tone · 5 of 5 done
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R1.1 | ✅ Done | Switch tone mapping to **AgX** (or Neutral) and re-balance exposure | Highlights roll off softly; roofs no longer clip | AgX tone mapping, exposure re-balanced per look. |
| R1.2 | ✅ Done | Re-palette all materials to measured real-world colours (terracotta roof `#a65a3a`, aged plaster `#d9cdb8`, asphalt `#5d5c58`, lawn `#5b7a34`…) | No "toy" colours remain | All materials re-coloured in `src/model/materials.js`; model re-exported. |
| R1.3 | ✅ Done | Natural colour variation: per-instance tint for trees (glTF `_COLOR_0`), per-building weathering tint, lawn mottling | Forest shows mixed greens/olives/yellows | Per-tree tint, lawn dry patches and speckle; building weathering is a procedural shader (`src/hero/weathering.js`): patchy fading, rain streaks and ground grime on walls, tile variation and moss patches on roofs, mottled stone and paving, and a slight cast per building. Materials are listed by name in `CONFIG.weathering`; set `amount: 0` or drop a name once the artist's textured version of it arrives. |
| R1.4 | ✅ Done | Colour-grading pass (LUT or lift/gamma/gain shader): warm highlights, cool shadows, slight desaturation of greens | Matches the reference render's mood | Shader grade (split-toning, contrast, green taming) in `post.js`, not a LUT file. |
| R1.5 | ✅ Done | Time-of-day presets in config (golden hour default, midday, overcast) | One-line switch | `golden` (default), `midday`, `overcast`; try with `?look=`. Overcast's final fog tweak and the midday/overcast haze were not re-checked visually. |

## Phase R2 — Lighting & sky · 5 of 5 done
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R2.1 | ✅ Done | Replace RoomEnvironment with a real **HDRI sky** (Poly Haven 2k, CC0) for reflections + background | Glass/water reflect a real sky | Done with a **procedural sky** (gradient + sun glow) instead of a downloaded HDRI, so it matches each look's sun. A real HDRI is still optional. |
| R2.2 | ✅ Done | Align sun direction/colour to the HDRI; lower sun (≈30–35°) for longer, softer shadows | Shadows read as late-afternoon | Sun comes from the look; golden hour sits at about 36°. |
| R2.3 | ✅ Done | Cascaded or tighter shadow frustum + PCSS-style soft shadows | Crisp near, soft far, no shimmering | Shadow map fitted to the plot (254 × 236 m instead of 320 × 320 m). On the ultra / high tiers shadow edges now widen with distance from the object casting them (measured: 0.1 m at the base of a pole, 1 m at 13 m along its shadow); phones keep the plain soft filter. Tuning in `CONFIG.shadows`. |
| R2.4 | ✅ Done | **Ambient occlusion**: GTAO post pass (desktop) + baked AO in terrain vertex colours (all tiers) | Contact darkening under trees, cars, eaves | GTAO pass on desktop; ground shading under trees/buildings baked into the model for all devices. |
| R2.5 | ✅ Done | Light probe / hemisphere tuned from HDRI for bounce colour | Shaded walls pick up green/sky tints | Bounce colour comes from the sky environment's green ground half (no separate light probe). |

## Phase R3 — Post-processing (cinematic camera) · 5 of 5 done
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R3.1 | ✅ Done | Add `EffectComposer` pipeline (RenderPass → GTAO → Bloom → DoF → Grade → SMAA/FXAA → Output) | Toggle per quality tier | Chain: scene → AO → bloom → tilt-shift → tone map → film grade. Edges use MSAA instead of SMAA/FXAA. |
| R3.2 | ✅ Done | Subtle **bloom** on sun-lit water/glass only (high threshold) | No glow on grass | High HDR threshold; desktop only. |
| R3.3 | ✅ Done | **Tilt-shift / depth of field** focused on the orbit target (architectural-model feel) | Distant forest softly blurred | Screen-space tilt-shift that follows the orbit target and fades out in close-ups; desktop only. |
| R3.4 | ✅ Done | Vignette + very light film grain + chromatic aberration ≤ 0.5 px | Feels photographic, not "game" | Vignette + grain on all devices; colour fringe on desktop. |
| R3.5 | ✅ Done | Low tier: skip GTAO/DoF, keep grade + FXAA | Phones stay ≥ 30 fps | Phones skip AO, bloom, blur and fringe. **Not tested on a real phone.** |

## Phase R4 — Atmosphere · 3 done, 1 not built
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R4.1 | ✅ Done | **Height fog + aerial perspective** shader (blue-grey haze increasing with distance & lower in valleys) | Hills fade naturally into distance | Patched fog shader: distance haze thinning with altitude, cool near / warm towards the sun, valley mist. |
| R4.2 | ✅ Done | Volumetric-looking mist: layered soft cloud cards with depth fade (no hard sprite edges) | Mist sits *between* trees, not on top | Achieved differently: the between-trees mist is the height fog (R4.1); mist banks got a wispy texture and fade out near the camera. No depth-fade on the banks themselves. |
| R4.3 | ➖ Not built | Optional sun shafts (god rays) at golden-hour preset | Desktop only | Optional; skipped — shafts tend to look fake from above. Warm haze towards the sun stands in. |
| R4.4 | ✅ Done | Distant mountain silhouettes (layered ridges) beyond the terrain | Horizon has depth like Kerala hills | Three ridge layers; max camera tilt raised from 72° to 80° so the horizon is visible. |

## Phase R5 — Ground & landscape materials · 6 of 6 done (procedural)
Built in code instead of waiting for artist textures: the detail is computed in shaders (`src/hero/surfaces.js`), so there are no texture files to download. It is stylised, not photographic; an artist's textured materials replace it by leaving their names out of `CONFIG.surfaces`.
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R5.1 | ✅ Done | Terrain **splat shader**: grass, dry grass, soil, rock blended by slope/height/noise (CC0 PBR textures, triplanar) | No flat colour anywhere | Shader on the terrain: grass mottling and speckle, dry patches, red laterite earth on steeper ground, bedded rock on the steepest. Procedural colour only — no PBR textures or normal maps. |
| R5.2 | ✅ Done | Road surfaces: asphalt texture with wear, kerb stone texture, faded road paint | Roads read as real tarmac | Asphalt: aggregate speckle, darker repair patches, hairline cracks in close views. Road paint is worn and faded. Kerbs are mottled stone (no individual kerb stones). |
| R5.3 | ✅ Done | Paving textures: brick footpath, stone plaza, pool deck, amphitheatre concrete | Correct scale (1 tile ≈ real size) | Brick pavers on the footpath (0.42 × 0.21 m), flagstones on the plaza (1.1 × 0.75 m), 0.6 m tiles on the pool deck aligned to the pool, mottled concrete on the amphitheatre, granule speckle on the play surface. Brick and flagstone rows follow the compass, not the path's curve. |
| R5.4 | ✅ Done | Soft road/lawn edge blending (decal strip) instead of hard ribbon edges | Edges look natural | A semi-transparent worn-earth strip outside every kerb and path edge, fading into the grass with an uneven width, plus matching earth and thin-grass tones baked into the terrain colours. |
| R5.5 | ✅ Done | **Instanced grass tufts / ground cover** near the camera (fade by distance) | Lawns have depth when zoomed in | `src/hero/grass.js`: 40,000 tufts (70,000 on ultra, none on phones) scattered at load on lawn-coloured terrain that no road, path or building covers. They shrink away between 45 and 110 m from the camera and are switched off in wide views. Works on any model; nothing is stored in the model file. |
| R5.6 | ✅ Done | Rocks (contour map shows rock areas) — instanced CC0 rock models | Rocky slopes match survey | 524 instanced boulders in three generated shapes, placed on steep and stony ground (the same field that thins the forest). Not matched to the survey's rock areas. |

## Phase R6 — Vegetation (largest visual win) · 5 of 5 done (procedural)
Built in code (`src/model/vegetation.js`) instead of waiting for artist models. The trees are stylised leaf-card trees, not photo-scanned ones; artist-made trees can still be dropped in under the same names.
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R6.1 | ✅ Done | Replace blob trees with **leaf-card trees** (CC0 / Blender sapling): 3–4 tropical broadleaf species + coconut palm + areca palm + flowering shrubs | Real leafy silhouettes | Five broadleaf shapes (round, tall oval, open, umbrella, column), coconut and areca palms with drooping frond strips, shrubs and flowering shrubs. Each is a solid inner crown dressed with alpha-clipped leaf cards; one generated 256 px leaf texture serves every plant. |
| R6.2 | ✅ Done | Foliage shader: alpha-tested leaves, two-sided lighting, **subsurface/translucency** toward the sun, wind sway (vertex shader) | Leaves glow when back-lit, gently move | Wind sway and back-light glow as before; leaf cards now also get soft cut-out edges (alpha-to-coverage) and are lit as one canopy on both faces. They are kept out of the ambient-occlusion pass, which cannot see cut-outs. |
| R6.3 | ✅ Done | **LOD chain**: full tree (near) → simplified (mid) → billboard impostor (far forest) | Same fps with 3–4× more detail | Three levels chosen by distance from the site when a tree is placed (the camera always orbits the site): full trees within 118 m (130–360 triangles), simplified to 240 m (40–100), single blobs beyond (20). 13,201 plants, 0.94 M triangles (was 12,128 and 0.88 M). Not a per-frame switch. |
| R6.4 | ✅ Done | Natural placement: clustering, size by age, denser in valleys, gaps on rock | Forest no longer looks gridded | Noise fields drive thickets and clearings, stands of old and young trees, palm groves on low ground, tall single-species stands, and bare patches on steep or stony ground. |
| R6.5 | ✅ Done | Hedges and flower beds around buildings, ring road and paths (from the render) | Matches render landscaping | 279 hedge lengths along kerbs without parking bays, both sides of the footpath, and round the play area and plaza; flower beds at both gates, the plaza, the prayer hall and in drifts along road verges. Placement is rule-based, not traced from the render. |

## Phase R7 — Architecture detail · 8 of 8 done (procedural)
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R7.1 | ✅ Done | Convention centre rebuild: real windows/doors with frames, columns/verandah, eaves with fascia & soffit, roof tile texture with ridge caps | Reads as Kerala-style architecture | Procedural building kit (`src/model/architecture.js`): timber-framed windows with stone sills and lintel bands, high-level lights on the tall halls, panelled double doors with steps, a columned entrance portico, column verandahs under lean-to tile roofs, cornice band, deeper eaves with fascia boards and a light soffit, ridge and hip caps with finials. Windows are surface-mounted on solid walls (no real openings or interiors). Roof tiles are still shader colour, not modelled. |
| R7.2 | ✅ Done | Prayer hall, security cabin to the same standard | Consistent style | Prayer hall and security cabin are built from the same kit (doors, windows, eaves, ridge caps). The south gate is now a small gatehouse: two piers carrying a tiled hip roof over the road, with open iron gate leaves and a barrier arm. |
| R7.3 | ✅ Done | PBR materials: plaster (with dirt at base), tiles (normal + roughness), glass (reflective, tinted), timber pergolas (wood grain) | Close-ups hold up | Procedural only, no texture maps: new `timber` surface kind (grain along the member, greyed patches) on pergolas, frames, beams and fascia; trim (columns, sills, soffits) weathers like the walls; glass was already dark and reflective. No normal or roughness maps. |
| R7.4 | ✅ Done | Pool: tiled pool shell with depth colour, caustics shader, wet deck edge, real fountain particles | Water looks deep and clear | Water shader (`src/hero/water.js`) now draws a mosaic-tiled floor with refraction parallax, a darker tile band along the walls, moving caustics, and depth colour (shallow at the edge, deep in the middle). Raised glossy stone coping reads as the wet edge. Two-tier fountain with droplet particles (`src/hero/fountain.js`; static spray kept when reduced motion is on). Pool ladder and five loungers added; the long pergola moved from over the water onto the deck. The pool shell itself is not modelled — the floor is drawn on the water surface. |
| R7.5 | ✅ Done | Amphitheatre: concrete/stone texture, step edges, stage backdrop | Not "white plastic" | Darker nosing strip on every step, three stair aisles of half-height steps, coping on the back wall, and an open timber backdrop frame behind the stage. Concrete mottling was already done in R5.3. |
| R7.6 | ✅ Done | Playground: CC0 play-equipment models, rubber surface texture | Recognisable equipment | Rebuilt from primitives, not downloaded models: play tower with deck, guard panels, pyramid roof, ladder and a slide with side rails; swing set with chains and seats; see-saw with handles; roundabout with hoop handles; two spring riders. |
| R7.7 | ✅ Done | Site furniture: street lamps, benches, bollards, signage at gates, compound wall with gate | Human scale and life | `src/model/furniture.js`: 17 street lamps along the roads, 10 benches (plaza, play area, prayer hall, footpath), 18 bollards (plaza, west gate), and a name sign at each gate (the only texture in the model, drawn on a canvas). The plot boundary is now a 1.45 m compound wall with coping and 136 piers, with gaps where roads cross it. Café tables under the two shade canopies. |
| R7.8 | ✅ Done | Cars: replace boxes with CC0 low-poly realistic cars (4–5 models, LOD) | Cars read at a glance | Three body styles (sedan, hatchback, SUV) extruded from side profiles, with a dark glasshouse, painted roof, wheels with hubs and a dark sill, in the five paints: 15 instanced meshes, 95 cars. Generated, not CC0 models; no lights, mirrors or LOD. The moving cars pick these shapes up automatically. |

## Phase R8 — Life & motion (cinematic feel) · 4 of 4 done
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R8.1 | ✅ Done | Intro as a **cinematic camera path** (spline fly-through over the forest into the site, ~6 s, skippable) | Feels like a film opener | 6.5 s spline from low over the south-east forest up to the aerial view. Click, scroll, Esc/Enter/Space or the "Skip intro" button fast-forwards it (0.7 s, no cut). Path in `CONFIG.intro`. |
| R8.2 | ✅ Done | Slow drifting clouds' shadows across the terrain | Subtle moving light | Soft noise dims the direct sunlight only, on every material, projected along the sun's rays. Size, wind, cover in `CONFIG.clouds`; strength per look (`cloudShadow`). |
| R8.3 | ✅ Done | A few moving cars on the access road, birds over the forest (optional) | Scene feels alive | 5 cars (3 on phones) drive gate → hairpin → ring road → back out, keeping left and slowing in bends (`src/hero/life.js`, route in `CONFIG.traffic`). The 3 static cars on the hairpin road were removed from the model. A flock of 7 birds circles the valley. |
| R8.4 | ✅ Done | Smoother preset transitions (eased arcs, slight camera "settle") | No mechanical moves | New ease with a long soft tail; the look-at point arrives just before the camera; long moves pull back slightly mid-flight; duration grows with distance (1.3–3 s). |

## Phase R9 — Asset pipeline & performance · 3 done, 2 partial, 1 pending (artist)
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R9.1 | 🟡 Partial | `assets/` source folder + `tools/build-assets` script: textures → KTX2 (Basis), meshes → Meshopt/Draco via `gltf-transform` | One command rebuilds | Done: `python tools/build_assets.py` rebuilds the three model files and both posters in one command and prints every delivered file with its on-disk and gzip size against the budgets (`--report` prints the table only). No Node.js needed. **Not done:** Meshopt/Draco mesh compression and KTX2 textures — glTF-Transform needs Node.js, which is not installed, and loading it in the browser from a CDN was not permitted in this session. The page already loads Draco, Meshopt and KTX2 files if they are supplied. |
| R9.2 | ✅ Done | Split GLB: `site-core.glb` (terrain/buildings, loads first) + `vegetation.glb` + `details.glb` (stream in after first frame) | First view < 2 s on 4G | The model builder writes three files: `mountain-courtyard.glb` (terrain, roads, buildings, cars — 992 KB gzipped), `-vegetation.glb` (624 KB) and `-details.glb` (furniture, rocks — 80 KB). All three download at once; the scene appears when the core is ready and the forest rises from the ground when it arrives. Thumbnails are rendered once everything is in. First view is 1.6 MB, about 1.4 s of download at 9 Mbit/s (calculated from file sizes, not measured on a phone). An artist model in one file still works: set `models.extras` to `[]`. |
| R9.3 | 🎨 Pending — artist | Texture budget: 2k max, atlases for small props, mipmaps, anisotropy | GPU memory < 300 MB desktop | Anisotropic filtering is applied on load; the validator page flags oversized textures. |
| R9.4 | ✅ Done | Quality tiers extended (Ultra / High / Low) + auto-detect via a 1 s GPU benchmark | Right tier picked automatically | `src/hero/tier.js`: a ~0.35 s shader benchmark on the first visit (result remembered) picks ultra / high / low on desktops and high / low on phones; `?tier=` still overrides. Ultra adds 8× MSAA, a 6144 px shadow map, 16-sample AO, more mist and cars. Thresholds calibrated on one machine only. |
| R9.5 | ✅ Done | Static poster image (rendered from the scene) shown instantly and for no-WebGL / reduced-data users | Never a blank screen | `hero-poster.webp` (1920×1200, 132 KB) and `hero-poster-mobile.webp` (900×1600, 87 KB) show from the first paint under the hero copy. Without WebGL 2 the poster stays; with data saver it stays behind a "Load 3D model" button. `main.js` is now a small bootstrap and the 3D code (`app.js`, three.js, the model) is fetched only when needed. Preview with `?3d=off`. |
| R9.6 | 🟡 Partial | Re-verify: fps (debug HUD), load size, mobile test on a real phone, Lighthouse | Budgets met | **Load size:** first view 1.6 MB, whole page 2.6 MB against the 6 MB budget (`python tools/build_assets.py --report`). **Lighthouse** (PageSpeed Insights, mobile, live site, 13 Nov 2026, Lighthouse 13.6): Performance 71, Accessibility 96, Best Practices 100, SEO 100; FCP 1.5 s, LCP 3.0 s, TBT 930 ms, CLS 0.005, Speed Index 4.0 s. Its test machine has no GPU, so these score the poster page, not the 3D scene. Three findings fixed afterwards and **not yet re-scored**: the GPU benchmark's long task on software renderers, the render-blocking font stylesheet, and ARIA labels on plain `div`s. An earlier run crashed its browser on the 3D scene; GPU-less devices now keep the poster. **Phone emulation** (375×812, touch): loads the right tier, portrait poster and portrait intro without overlap. **Not done:** test on a real phone; frame rate (the preview pane was hidden throughout, so fps read there is meaningless); a Lighthouse re-run after the three fixes are published. |

---

## Suggested order
R1 → R2 → R3 (big perceived change in days, no new assets) → R6 (trees) → R5 (ground) → R7 (buildings) → R4 → R8 → R9 runs alongside from R5 onward.

## Notes
- All third-party assets will be CC0 (public domain) and listed in `ASSETS.md` with source links; you approve each download.
- The model contract (group names, `userData.hotspotId`, `Hotspot_*` anchors) stays fixed, so a future Blender model can drop in without code changes.
- A photographic 100% match to the render is only reachable with an artist-built Blender scene with baked lighting (option B); this plan gets as close as practical in real time.
