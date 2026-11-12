# Mountain Courtyard — 3D Hero Section: Implementation Plan

Stack: vanilla JS (ES modules) + Three.js r170 loaded through an import map (no bundler needed),
served locally by `serve.py` (Python 3, already installed — Node is not required).

```
Mountain Courtyard/
├─ index.html                     # hero page (Phase 2+)
├─ serve.py                       # static dev server + POST /api/save-model (writes the .glb)
├─ docs/IMPLEMENTATION_PLAN.md
├─ public/
│  ├─ models/mountain-courtyard.glb   # exported site model (Phase 1 output)
│  └─ assets/                         # logos, thumbnails, poster image
├─ src/
│  ├─ model/                      # Phase 1 — procedural site model (source of the .glb)
│  │  ├─ layout.js                # all coordinates: boundary, roads, pads, spot levels, features
│  │  ├─ geom.js                  # noise, polygon/path maths, hip-roof + merge helpers
│  │  ├─ materials.js             # shared, named PBR materials
│  │  ├─ terrain.js               # contour-based heightfield + road/pad grading + vertex colours
│  │  ├─ roads.js                 # road ribbons, kerbs, lane dashes, parking stalls, cars
│  │  ├─ structures.js            # buildings, pool, amphitheatre, playground, pergolas, gates
│  │  ├─ vegetation.js            # instanced trees / palms / shrubs (site + surrounding forest)
│  │  └─ buildSite.js             # assembles everything + hotspot anchor nodes
│  ├─ hero/                       # Phase 2+ — runtime hero scene
│  │  ├─ main.js  scene.js  lighting.js  loader.js  controls.js
│  │  ├─ hotspots.js  popups.js  ui.js  config.js
│  └─ styles/hero.css
└─ tools/model-builder.html       # preview the procedural model, export/save the .glb
```

## Phase 1 — 3D site model (this delivery)
| # | Task | Done when |
|---|------|-----------|
| 1.1 | Digitise the rendered layout into metres (1 px = 0.15 m) — boundary, roads, features | `layout.js` holds every coordinate |
| 1.2 | Terrain heightfield from contour-map spot levels (~52 m → ~106 m, plane fit + Gaussian residuals), vertical scale 0.6 | Slope falls from prayer hall (NW) to Nellankandi gate (S) |
| 1.3 | Grade building pads (courtyard, prayer hall, playground, amphitheatre, plaza) and roads (smoothed longitudinal profile, shoulders) | No road/building floats or sinks |
| 1.4 | Roads: ring road with parking, parking spine, SW road, hairpin road, prayer-hall footpath, kerbs, dashes, stall lines | Matches render |
| 1.5 | Structures: convention centre (hip roofs), prayer hall, eye-shaped pool + fountain, amphitheatre tiers, playground, pergolas, gates | Named groups per hotspot |
| 1.6 | Vegetation: instanced broadleaf / columnar / palm / shrub + low-poly far forest | < ~1M triangles total |
| 1.7 | Parked cars (instanced), plot boundary wall | |
| 1.8 | Hotspot anchor nodes `Hotspot_<id>` + `userData.hotspotId` on clickable groups | Present in GLB extras |
| 1.9 | Export GLB (EXT_mesh_gpu_instancing) via model-builder → `public/models/mountain-courtyard.glb` | File loads in viewer |
| 1.10 | (optional) Compress: `npx @gltf-transform/cli optimize in.glb out.glb --compress draco` (needs Node) or refine in Blender | |

## Phase 2 — Scene setup & outdoor lighting ✅
2.1 `index.html` skeleton: canvas container, CSS2D layer, UI overlay (nav, title, buttons, thumbnails, map controls).
2.2 `scene.js`: Scene, PerspectiveCamera (fov 35), WebGLRenderer (ACES tone mapping, sRGB, pixelRatio ≤ 2), resize handling.
2.3 `lighting.js`: HemisphereLight (sky/ground), DirectionalLight sun with PCFSoft shadows sized to the site, subtle FogExp2 + sky gradient, optional RoomEnvironment for PBR reflections.
2.4 Drifting cloud/mist sprites at the edges (as in the reference UI).

## Phase 3 — Model loading & optimisation ✅ (GLB 2.5 MB → 1.1 MB over gzip; 0.88M tris, ~61 draw calls)
3.1 `loader.js`: GLTFLoader + DRACOLoader (+ MeshoptDecoder), progress → loading screen. (basic version in place)
3.1b Pre-compile shaders with `renderer.compileAsync(scene, camera)` before hiding the loader — the GLB downloads in ~12 ms locally, the multi-second wait is first-frame shader/shadow compile.
3.2 Post-load traverse: shadows (trees cast, terrain receives), swap `Water` material for animated water, freeze static matrices (`matrixAutoUpdate=false`).
3.3 Performance: instancing kept from GLB, frustum culling per InstancedMesh, adaptive pixel ratio, render-on-demand when idle, low-tier fallback (fewer trees, no shadows).

## Phase 4 — Camera controls ✅
4.1 OrbitControls with `enableDamping`, `dampingFactor 0.06`, polar angle limits (≈ 20°–72°), distance limits, pan limited to site bounds.
4.2 Terrain-collision guard: raycast down each frame, keep camera ≥ N m above ground.
4.3 Intro fly-in animation + auto-rotate when idle; UI buttons: fullscreen, reset, zoom ±, north compass sync.

## Phase 5 — Hotspots (Raycaster) ✅
5.1 Collect clickable groups by `userData.hotspotId`; raycast on pointerup (ignore drags); hover highlight + cursor.
5.2 Camera focus tween to clicked hotspot.

## Phase 6 — CSS2D pop-ups ✅ (copy in src/hero/content.js is placeholder — replace with approved text)
6.1 CSS2DRenderer layer; pin labels at `Hotspot_*` anchors; click → detail card (title, text, image, CTA).
6.2 Occlusion/fade by distance; close on outside click / Esc.

## Phase 7 — Hero UI & polish ✅ (Lighthouse not run — needs Node/Chrome DevTools; walkthrough video is a placeholder)
7.1 Nav, logo lockup, “Introducing Mountain Courtyard” copy, walkthrough button, view switcher (3D Model / Master Plan / Site Images), thumbnail carousel jumping to camera presets.
7.2 Responsive (mobile: reduced trees, no shadows, simplified controls), accessibility (keyboard + reduced-motion), Lighthouse pass.
