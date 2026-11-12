# Mountain Courtyard — Plan 2: Cinematic & Realistic Look

Goal: move from the current clean low-poly look to a photographic, "architectural render" look
(like the reference hero image): natural colour, real materials, soft sunlight, depth and atmosphere —
while keeping the hero fast (target: 60 fps desktop, 30+ fps mid phones, ≤ 6 MB first load).

## Where the realism gap is today
| Area | Now | Why it looks artificial |
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

### Phase R0 — Make the page ready for an artist-built model ✅ (R0.7 waits for the artist's delivery)
| # | Task | Done when |
|---|---|---|
| R0.1 | Ground-height lookup must not assume the blockout's regular grid: bake a height map from the `Terrain` mesh at load (one-off downward raycasts into a 2D array) | Camera guard works on any terrain mesh |
| R0.2 | Loader accepts 1–3 GLB files (core first, vegetation/details streamed in after the first frame) | Split delivery works |
| R0.3 | Foliage support: alpha-clipped leaves cast correct shadows; optional wind + back-light shader applied to meshes flagged `vegetation` | Leaf-card trees render and shadow correctly |
| R0.4 | KTX2Loader wired in (optional GPU-compressed textures) | `.ktx2` textures load if the artist supplies them |
| R0.5 | Baked AO (glTF occlusion texture, native) + lightmap via mesh custom property `lightMap` = file name, on UV2 | Artist bakes show up |
| R0.6 | `tools/validate-model.html`: loads a GLB and reports contract errors (missing names/hotspots/anchors, non-instanced trees, triangle and draw-call budget, size) | Artist/developer get a pass/fail list |
| R0.7 | Camera presets, pan bounds, hotspot focus distances re-tuned on the delivered model | Presets frame correctly |

The asset tasks in R5–R7 below now describe **what the artist delivers** (see the brief's checklist).

---

## Phase R1 — Colour & tone ✅ (looks: `?look=golden|midday|overcast`; building weathering tint left to the artist)
| # | Task | Done when |
|---|---|---|
| R1.1 | Switch tone mapping to **AgX** (or Neutral) and re-balance exposure | Highlights roll off softly; roofs no longer clip |
| R1.2 | Re-palette all materials to measured real-world colours (terracotta roof `#a65a3a`, aged plaster `#d9cdb8`, asphalt `#5d5c58`, lawn `#5b7a34`…) | No "toy" colours remain |
| R1.3 | Natural colour variation: per-instance tint for trees (glTF `_COLOR_0`), per-building weathering tint, lawn mottling | Forest shows mixed greens/olives/yellows |
| R1.4 | Colour-grading pass (LUT or lift/gamma/gain shader): warm highlights, cool shadows, slight desaturation of greens | Matches the reference render's mood |
| R1.5 | Time-of-day presets in config (golden hour default, midday, overcast) | One-line switch |

## Phase R2 — Lighting & sky ✅ (procedural sky instead of a downloaded HDRI; PCSS shadows not done; test desktop tier with `?tier=high`)
| # | Task | Done when |
|---|---|---|
| R2.1 | Replace RoomEnvironment with a real **HDRI sky** (Poly Haven 2k, CC0) for reflections + background | Glass/water reflect a real sky |
| R2.2 | Align sun direction/colour to the HDRI; lower sun (≈30–35°) for longer, softer shadows | Shadows read as late-afternoon |
| R2.3 | Cascaded or tighter shadow frustum + PCSS-style soft shadows | Crisp near, soft far, no shimmering |
| R2.4 | **Ambient occlusion**: GTAO post pass (desktop) + baked AO in terrain vertex colours (all tiers) | Contact darkening under trees, cars, eaves |
| R2.5 | Light probe / hemisphere tuned from HDRI for bounce colour | Shaded walls pick up green/sky tints |

## Phase R3 — Post-processing (cinematic camera) ✅ (tilt-shift is screen-space; settings in `CONFIG.post`)
| # | Task | Done when |
|---|---|---|
| R3.1 | Add `EffectComposer` pipeline (RenderPass → GTAO → Bloom → DoF → Grade → SMAA/FXAA → Output) | Toggle per quality tier |
| R3.2 | Subtle **bloom** on sun-lit water/glass only (high threshold) | No glow on grass |
| R3.3 | **Tilt-shift / depth of field** focused on the orbit target (architectural-model feel) | Distant forest softly blurred |
| R3.4 | Vignette + very light film grain + chromatic aberration ≤ 0.5 px | Feels photographic, not "game" |
| R3.5 | Low tier: skip GTAO/DoF, keep grade + FXAA | Phones stay ≥ 30 fps |

## Phase R4 — Atmosphere ✅ (R4.3 sun shafts not built — warm haze towards the sun stands in; camera can now tilt to 80° to show the horizon)
| # | Task | Done when |
|---|---|---|
| R4.1 | **Height fog + aerial perspective** shader (blue-grey haze increasing with distance & lower in valleys) | Hills fade naturally into distance |
| R4.2 | Volumetric-looking mist: layered soft cloud cards with depth fade (no hard sprite edges) | Mist sits *between* trees, not on top |
| R4.3 | Optional sun shafts (god rays) at golden-hour preset | Desktop only |
| R4.4 | Distant mountain silhouettes (layered ridges) beyond the terrain | Horizon has depth like Kerala hills |

## Phase R5 — Ground & landscape materials
| # | Task | Done when |
|---|---|---|
| R5.1 | Terrain **splat shader**: grass, dry grass, soil, rock blended by slope/height/noise (CC0 PBR textures, triplanar) | No flat colour anywhere |
| R5.2 | Road surfaces: asphalt texture with wear, kerb stone texture, faded road paint | Roads read as real tarmac |
| R5.3 | Paving textures: brick footpath, stone plaza, pool deck, amphitheatre concrete | Correct scale (1 tile ≈ real size) |
| R5.4 | Soft road/lawn edge blending (decal strip) instead of hard ribbon edges | Edges look natural |
| R5.5 | **Instanced grass tufts / ground cover** near the camera (fade by distance) | Lawns have depth when zoomed in |
| R5.6 | Rocks (contour map shows rock areas) — instanced CC0 rock models | Rocky slopes match survey |

## Phase R6 — Vegetation (largest visual win)
| # | Task | Done when |
|---|---|---|
| R6.1 | Replace blob trees with **leaf-card trees** (CC0 / Blender sapling): 3–4 tropical broadleaf species + coconut palm + areca palm + flowering shrubs | Real leafy silhouettes |
| R6.2 | Foliage shader: alpha-tested leaves, two-sided lighting, **subsurface/translucency** toward the sun, wind sway (vertex shader) | Leaves glow when back-lit, gently move |
| R6.3 | **LOD chain**: full tree (near) → simplified (mid) → billboard impostor (far forest) | Same fps with 3–4× more detail |
| R6.4 | Natural placement: clustering, size by age, denser in valleys, gaps on rock | Forest no longer looks gridded |
| R6.5 | Hedges and flower beds around buildings, ring road and paths (from the render) | Matches render landscaping |

## Phase R7 — Architecture detail
| # | Task | Done when |
|---|---|---|
| R7.1 | Convention centre rebuild: real windows/doors with frames, columns/verandah, eaves with fascia & soffit, roof tile texture with ridge caps | Reads as Kerala-style architecture |
| R7.2 | Prayer hall, security cabin to the same standard | Consistent style |
| R7.3 | PBR materials: plaster (with dirt at base), tiles (normal + roughness), glass (reflective, tinted), timber pergolas (wood grain) | Close-ups hold up |
| R7.4 | Pool: tiled pool shell with depth colour, caustics shader, wet deck edge, real fountain particles | Water looks deep and clear |
| R7.5 | Amphitheatre: concrete/stone texture, step edges, stage backdrop | Not "white plastic" |
| R7.6 | Playground: CC0 play-equipment models, rubber surface texture | Recognisable equipment |
| R7.7 | Site furniture: street lamps, benches, bollards, signage at gates, compound wall with gate | Human scale and life |
| R7.8 | Cars: replace boxes with CC0 low-poly realistic cars (4–5 models, LOD) | Cars read at a glance |

## Phase R8 — Life & motion (cinematic feel)
| # | Task | Done when |
|---|---|---|
| R8.1 | Intro as a **cinematic camera path** (spline fly-through over the forest into the site, ~6 s, skippable) | Feels like a film opener |
| R8.2 | Slow drifting clouds' shadows across the terrain | Subtle moving light |
| R8.3 | A few moving cars on the access road, birds over the forest (optional) | Scene feels alive |
| R8.4 | Smoother preset transitions (eased arcs, slight camera "settle") | No mechanical moves |

## Phase R9 — Asset pipeline & performance
| # | Task | Done when |
|---|---|---|
| R9.1 | `assets/` source folder + `tools/build-assets` script: textures → KTX2 (Basis), meshes → Meshopt/Draco via `gltf-transform` | One command rebuilds |
| R9.2 | Split GLB: `site-core.glb` (terrain/buildings, loads first) + `vegetation.glb` + `details.glb` (stream in after first frame) | First view < 2 s on 4G |
| R9.3 | Texture budget: 2k max, atlases for small props, mipmaps, anisotropy | GPU memory < 300 MB desktop |
| R9.4 | Quality tiers extended (Ultra / High / Low) + auto-detect via a 1 s GPU benchmark | Right tier picked automatically |
| R9.5 | Static poster image (rendered from the scene) shown instantly and for no-WebGL / reduced-data users | Never a blank screen |
| R9.6 | Re-verify: fps (debug HUD), load size, mobile test on a real phone, Lighthouse | Budgets met |

---

## Suggested order
R1 → R2 → R3 (big perceived change in days, no new assets) → R6 (trees) → R5 (ground) → R7 (buildings) → R4 → R8 → R9 runs alongside from R5 onward.

## Notes
- All third-party assets will be CC0 (public domain) and listed in `ASSETS.md` with source links; you approve each download.
- The model contract (group names, `userData.hotspotId`, `Hotspot_*` anchors) stays fixed, so a future Blender model can drop in without code changes.
- A photographic 100% match to the render is only reachable with an artist-built Blender scene with baked lighting (option B); this plan gets as close as practical in real time.
