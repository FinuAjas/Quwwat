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
| R5 Ground materials | Artist | 🎨 5 · ⏳ 1 | Not started. R5.5 grass tufts is a code task for after the artist's terrain. |
| R6 Vegetation | Code (procedural) | ✅ 5 | Leaf-card trees, palms, shrubs, hedges and flower beds, three distance levels, noise-driven forest — all generated in code. An artist's hand-modelled trees can still replace them later. |
| R7 Architecture detail | Artist | 🟡 1 · 🎨 7 | Only the animated water exists. Everything else is the artist's; caustics is a code task. |
| R8 Life & motion | Code | ✅ 4 | Spline fly-in (skippable), drifting cloud shadows, moving cars and birds, settling camera moves. |
| R9 Pipeline & performance | Both | ✅ 2 · 🟡 2 · ⏳ 1 · 🎨 1 | Poster image and three benchmark-picked tiers done; load size checked. Build script (needs Node.js), real-phone test and Lighthouse pending. |

**Task count:** 35 done · 3 partial · 2 pending (code) · 13 pending (artist) · 1 waiting · 1 not built — 55 tasks in total.

### Completed so far (R0–R4, R8, R9.4, R9.5)
- The page accepts an artist-built model without code changes, and `tools/validate-model.html` checks a model against the brief.
- Golden-hour look by default, with midday and overcast available (`?look=`).
- Real-world colours, per-tree tints, lawn mottling; model re-exported (3.0 MB, 95 parked cars).
- Sky-based reflections and ambient light, fitted shadow map, desktop contact shadows, baked ground shading for all devices.
- Bloom, tilt-shift blur, vignette, film grain and a slight colour fringe.
- Distance haze, valley mist, softer mist banks and three layers of horizon hills; camera can tilt to 80°.
- A 6.5 s opening flight over the forest (skippable), cloud shadows drifting across the land, cars driving the access road and ring, a flock of birds, and camera moves that ease into place.
- A poster image of the scene is on screen from the first paint and stays when 3D is unavailable or data saver is on; the 3D code is only downloaded when it will be used.
- Three quality tiers (ultra / high / low), picked by a short GPU benchmark on the first visit.

### Pending — code (can be done now)
1. **R9.6** Real-phone test and Lighthouse run (the load-size check is done).
2. **R7.4** Pool caustics and **R5.5** grass tufts (both better after the artist's model).
3. **R9.1** Asset build script (needs Node.js installed).

### Pending — artist (see [BLENDER_ARTIST_BRIEF.md](BLENDER_ARTIST_BRIEF.md))
- **R5** Textured terrain, roads and paving, soft edges, rocks.
- **R7** Detailed convention centre, prayer hall and cabin, PBR materials, pool shell, amphitheatre, play equipment, site furniture, realistic cars.
- **R9.3** Texture budget; exporting with Draco + WebP.

### Blocked until the artist delivers
- **R0.7** Re-tune camera presets, pan bounds and hotspot focus distances.
- **R9.2** Decide the file split (core / vegetation / details).
- **R9.5** re-render the poster images from the artist's model (open the page with `?tier=ultra&poster` while `serve.py` is running).
- **R8** re-tune on the artist's model: intro flight path, car route (`CONFIG.intro`, `CONFIG.traffic`).

### Known gaps in what is marked done
- Nothing has been tested on a real phone; the phone tier was only exercised with `?tier=low` on desktop.
- KTX2 textures and baked lightmaps are wired in but untested (no such assets yet).
- Midday and overcast looks were not re-checked after the haze shader (R4) went in.
- Frame rate in the preview pane read 72–144 fps with all desktop effects on; the pane throttles unevenly, so treat it as rough.
- Lighthouse has produced no scores yet: the one run crashed on the 3D scene (see R9.6); it needs re-running once the fix is live.
- A browser tab opened in the background can benchmark many times slower than the GPU really is (measured 41.7 ms vs 0.8 ms on the same machine). Slow results are therefore not remembered between visits, but that visit still gets the low tier.
- R8 was checked in the desktop preview pane only (both tiers load without errors); the portrait/phone intro path and the cloud shadows under the midday and overcast looks were not checked by eye.
- The tier benchmark's thresholds were calibrated on one machine only (RTX 5050 laptop, 0.8 ms → ultra); integrated-GPU desktops and phones are untested, so their tier choice is a best guess. `?debug` logs the measurement.
- The no-WebGL and data-saver paths were exercised only through the `?3d=off` preview switch, not on a real device with those conditions.
- The mobile poster was rendered from the portrait preset but not viewed on a phone.
- The distance-based soft shadows (R2.3) were checked on the golden-hour look and the high tier; midday, overcast and their frame-rate cost on a mid-range GPU are unmeasured.
- Building weathering (R1.3) was checked on the convention centre from one close view and the aerial view, golden-hour look only; the plot boundary wall is left out because it follows the terrain.
- Vegetation (R6) was checked from the aerial view and one close view on the high and ultra tiers, golden-hour look. The flower beds were not looked at close up, and the frame-rate cost of the alpha-clipped leaves on a mid-range GPU or a phone is unmeasured.
- Leaf-card plants take no ambient occlusion (they still cast and receive shadows and have baked ground shade).
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
| R7 Architecture detail | **Artist** | R7.4 pool caustics/water shader stays code |
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

## Phase R5 — Ground & landscape materials · not started (artist)
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R5.1 | 🎨 Pending — artist | Terrain **splat shader**: grass, dry grass, soil, rock blended by slope/height/noise (CC0 PBR textures, triplanar) | No flat colour anywhere |  |
| R5.2 | 🎨 Pending — artist | Road surfaces: asphalt texture with wear, kerb stone texture, faded road paint | Roads read as real tarmac |  |
| R5.3 | 🎨 Pending — artist | Paving textures: brick footpath, stone plaza, pool deck, amphitheatre concrete | Correct scale (1 tile ≈ real size) |  |
| R5.4 | 🎨 Pending — artist | Soft road/lawn edge blending (decal strip) instead of hard ribbon edges | Edges look natural |  |
| R5.5 | ⏳ Pending — code | **Instanced grass tufts / ground cover** near the camera (fade by distance) | Lawns have depth when zoomed in | Best done once the artist's terrain is in. |
| R5.6 | 🎨 Pending — artist | Rocks (contour map shows rock areas) — instanced CC0 rock models | Rocky slopes match survey |  |

## Phase R6 — Vegetation (largest visual win) · 5 of 5 done (procedural)
Built in code (`src/model/vegetation.js`) instead of waiting for artist models. The trees are stylised leaf-card trees, not photo-scanned ones; artist-made trees can still be dropped in under the same names.
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R6.1 | ✅ Done | Replace blob trees with **leaf-card trees** (CC0 / Blender sapling): 3–4 tropical broadleaf species + coconut palm + areca palm + flowering shrubs | Real leafy silhouettes | Five broadleaf shapes (round, tall oval, open, umbrella, column), coconut and areca palms with drooping frond strips, shrubs and flowering shrubs. Each is a solid inner crown dressed with alpha-clipped leaf cards; one generated 256 px leaf texture serves every plant. |
| R6.2 | ✅ Done | Foliage shader: alpha-tested leaves, two-sided lighting, **subsurface/translucency** toward the sun, wind sway (vertex shader) | Leaves glow when back-lit, gently move | Wind sway and back-light glow as before; leaf cards now also get soft cut-out edges (alpha-to-coverage) and are lit as one canopy on both faces. They are kept out of the ambient-occlusion pass, which cannot see cut-outs. |
| R6.3 | ✅ Done | **LOD chain**: full tree (near) → simplified (mid) → billboard impostor (far forest) | Same fps with 3–4× more detail | Three levels chosen by distance from the site when a tree is placed (the camera always orbits the site): full trees within 118 m (130–360 triangles), simplified to 240 m (40–100), single blobs beyond (20). 13,201 plants, 0.94 M triangles (was 12,128 and 0.88 M). Not a per-frame switch. |
| R6.4 | ✅ Done | Natural placement: clustering, size by age, denser in valleys, gaps on rock | Forest no longer looks gridded | Noise fields drive thickets and clearings, stands of old and young trees, palm groves on low ground, tall single-species stands, and bare patches on steep or stony ground. |
| R6.5 | ✅ Done | Hedges and flower beds around buildings, ring road and paths (from the render) | Matches render landscaping | 279 hedge lengths along kerbs without parking bays, both sides of the footpath, and round the play area and plaza; flower beds at both gates, the plaza, the prayer hall and in drifts along road verges. Placement is rule-based, not traced from the render. |

## Phase R7 — Architecture detail · water only; rest pending (artist)
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R7.1 | 🎨 Pending — artist | Convention centre rebuild: real windows/doors with frames, columns/verandah, eaves with fascia & soffit, roof tile texture with ridge caps | Reads as Kerala-style architecture |  |
| R7.2 | 🎨 Pending — artist | Prayer hall, security cabin to the same standard | Consistent style |  |
| R7.3 | 🎨 Pending — artist | PBR materials: plaster (with dirt at base), tiles (normal + roughness), glass (reflective, tinted), timber pergolas (wood grain) | Close-ups hold up |  |
| R7.4 | 🟡 Partial | Pool: tiled pool shell with depth colour, caustics shader, wet deck edge, real fountain particles | Water looks deep and clear | Done: animated water ripples/reflections. Pending — code: caustics. Pending — artist: tiled shell, wet edge, fountain. |
| R7.5 | 🎨 Pending — artist | Amphitheatre: concrete/stone texture, step edges, stage backdrop | Not "white plastic" |  |
| R7.6 | 🎨 Pending — artist | Playground: CC0 play-equipment models, rubber surface texture | Recognisable equipment |  |
| R7.7 | 🎨 Pending — artist | Site furniture: street lamps, benches, bollards, signage at gates, compound wall with gate | Human scale and life |  |
| R7.8 | 🎨 Pending — artist | Cars: replace boxes with CC0 low-poly realistic cars (4–5 models, LOD) | Cars read at a glance |  |

## Phase R8 — Life & motion (cinematic feel) · 4 of 4 done
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R8.1 | ✅ Done | Intro as a **cinematic camera path** (spline fly-through over the forest into the site, ~6 s, skippable) | Feels like a film opener | 6.5 s spline from low over the south-east forest up to the aerial view. Click, scroll, Esc/Enter/Space or the "Skip intro" button fast-forwards it (0.7 s, no cut). Path in `CONFIG.intro`. |
| R8.2 | ✅ Done | Slow drifting clouds' shadows across the terrain | Subtle moving light | Soft noise dims the direct sunlight only, on every material, projected along the sun's rays. Size, wind, cover in `CONFIG.clouds`; strength per look (`cloudShadow`). |
| R8.3 | ✅ Done | A few moving cars on the access road, birds over the forest (optional) | Scene feels alive | 5 cars (3 on phones) drive gate → hairpin → ring road → back out, keeping left and slowing in bends (`src/hero/life.js`, route in `CONFIG.traffic`). The 3 static cars on the hairpin road were removed from the model. A flock of 7 birds circles the valley. |
| R8.4 | ✅ Done | Smoother preset transitions (eased arcs, slight camera "settle") | No mechanical moves | New ease with a long soft tail; the look-at point arrives just before the camera; long moves pull back slightly mid-flight; duration grows with distance (1.3–3 s). |

## Phase R9 — Asset pipeline & performance · 2 done, 2 partial, 2 pending
| # | Status | Task | Done when | Notes |
|---|---|---|---|---|
| R9.1 | ⏳ Pending — code | `assets/` source folder + `tools/build-assets` script: textures → KTX2 (Basis), meshes → Meshopt/Draco via `gltf-transform` | One command rebuilds | Needs Node.js installed. The artist can already export Draco + WebP straight from Blender. |
| R9.2 | 🟡 Partial | Split GLB: `site-core.glb` (terrain/buildings, loads first) + `vegetation.glb` + `details.glb` (stream in after first frame) | First view < 2 s on 4G | Loader side done (R0.2). Splitting the model into files is pending and depends on the artist's delivery. |
| R9.3 | 🎨 Pending — artist | Texture budget: 2k max, atlases for small props, mipmaps, anisotropy | GPU memory < 300 MB desktop | Anisotropic filtering is applied on load; the validator page flags oversized textures. |
| R9.4 | ✅ Done | Quality tiers extended (Ultra / High / Low) + auto-detect via a 1 s GPU benchmark | Right tier picked automatically | `src/hero/tier.js`: a ~0.35 s shader benchmark on the first visit (result remembered) picks ultra / high / low on desktops and high / low on phones; `?tier=` still overrides. Ultra adds 8× MSAA, a 6144 px shadow map, 16-sample AO, more mist and cars. Thresholds calibrated on one machine only. |
| R9.5 | ✅ Done | Static poster image (rendered from the scene) shown instantly and for no-WebGL / reduced-data users | Never a blank screen | `hero-poster.webp` (1920×1200, 132 KB) and `hero-poster-mobile.webp` (900×1600, 87 KB) show from the first paint under the hero copy. Without WebGL 2 the poster stays; with data saver it stays behind a "Load 3D model" button. `main.js` is now a small bootstrap and the 3D code (`app.js`, three.js, the model) is fetched only when needed. Preview with `?3d=off`. |
| R9.6 | 🟡 Partial | Re-verify: fps (debug HUD), load size, mobile test on a real phone, Lighthouse | Budgets met | Done: first load is 1.85 MB compressed (model 1.23 MB, three.js 0.36 MB, images 0.15 MB) against the 6 MB budget; phone-size emulation (375×812, touch) loads the low/high tier, the portrait poster and the portrait intro without layout overlap. Lighthouse (PageSpeed Insights, mobile, live site, 13 Nov 2026) **crashed its test browser** — its machines have no GPU, so the scene ran on software rendering. Fixed: devices without graphics acceleration now keep the poster and offer the 3D behind a button. **Not done:** Lighthouse re-run after that fix is published; real-phone test; fps (the preview pane was hidden, so frame rates read there are meaningless). |

---

## Suggested order
R1 → R2 → R3 (big perceived change in days, no new assets) → R6 (trees) → R5 (ground) → R7 (buildings) → R4 → R8 → R9 runs alongside from R5 onward.

## Notes
- All third-party assets will be CC0 (public domain) and listed in `ASSETS.md` with source links; you approve each download.
- The model contract (group names, `userData.hotspotId`, `Hotspot_*` anchors) stays fixed, so a future Blender model can drop in without code changes.
- A photographic 100% match to the render is only reachable with an artist-built Blender scene with baked lighting (option B); this plan gets as close as practical in real time.
