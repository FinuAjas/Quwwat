# Mountain Courtyard — Brief for the 3D Artist (Blender → glTF)

You are rebuilding the site model for an interactive real-time web hero (Three.js).
The website code is finished and loads **one file**: `public/models/mountain-courtyard.glb`.
If your model follows the contract below, it drops in with **no code changes**.

## 1. What you receive
| File | Use |
|---|---|
| `public/models/mountain-courtyard.glb` | Current blockout — import into Blender as your scale/position guide (File → Import → glTF) |
| `public/assets/images/site-render.webp` | Target look and layout (the rendered aerial) |
| `Contour Map.pdf` (from client) | Survey contours and spot levels, scale 1:800 |
| Reference hero screenshot / video (from client) | Mood: lush forest, soft light, mist |
| `src/model/layout.js` | Every coordinate of the blockout in metres, if you need exact numbers |

## 2. Scene setup
- **Units:** metres, scale 1.0. **Blender axes:** +X = east, +Y = north, +Z = up (the glTF exporter converts to Y-up).
- **Origin:** keep the blockout's origin (centre of the layout image). Do not move or rotate the site — camera presets, pan limits and pop-up positions depend on it.
- **Footprint:** site ≈ 210 m × 160 m; terrain mesh extends to ≈ ±700 m for the surrounding forest and hills.
- **Heights:** the blockout uses the survey levels compressed to 60 % (real fall ≈ 54 m → 32 m in the model, zero at the 85 m contour). Keep building pads and road levels within ±1 m of the blockout, or tell the developer so camera presets can be re-tuned.
- Apply all transforms (Ctrl+A → All Transforms) before export. No negative scales.

## 3. Required object names (the contract)
Names are case-sensitive. Set custom properties in *Object Properties → Custom Properties*; they export as glTF "extras".

### Clickable zones — one parent object (Empty or mesh) each, containing all of that zone's meshes
| Object name | Custom property `hotspotId` | Custom property `title` |
|---|---|---|
| `MainBuilding` | `main-building` | Convention Centre |
| `SwimmingPool` | `swimming-pool` | Infinity Swimming Pool |
| `Amphitheater` | `amphitheater` | Amphitheatre |
| `RecreationZone` | `recreation-zone` | Children's Play Area |
| `PrayerHall` | `prayer-hall` | Prayer Hall |
| `Parking` | `parking` | Visitor Parking |
| `EntranceGate_South` | `gate-south` | Entrance Gate — Nellankandi |
| `EntranceGate_West` | `gate-west` | Pergola Gate — West |

New zones can be added freely: any object with a `hotspotId` becomes clickable (tell the developer the id so pop-up text can be written).

### Label anchors — Empties under a parent Empty named `Hotspots`
One Empty per zone named `Hotspot_<hotspotId>` (e.g. `Hotspot_main-building`), placed **above** the zone where its label should float (≈ 4–15 m above the roof/ground), with the same `hotspotId` property.

### Other reserved names
| Name / property | Meaning |
|---|---|
| Mesh named `Terrain` | The ground. Must be a single mesh covering the whole scene; the camera is kept above it. |
| Material name starting with `Water` | Replaced at runtime by animated water — just assign it to the pool water surface (flat mesh, normals up). |
| Custom property `castShadow` = 1 | Mesh casts real-time shadows (buildings, trees, cars, pergolas). |
| Custom property `receiveShadow` = 1 | Mesh receives shadows (terrain, roads, paving, lawns, roofs). |
| Custom property `vegetation` = 1 | Tree/shrub meshes (lets phones reduce their count and skip their shadows). |
| Object name containing `_far` | Distant low-detail forest (reduced more aggressively on phones). |

## 4. Geometry & performance budget (real-time!)
| Item | Budget |
|---|---|
| Total triangles on screen | ≤ 1.5 million (current blockout: 0.88 M) |
| Draw calls (separate objects × materials) | ≤ 150 — **join meshes that share a material** |
| Materials | ≤ 40, reuse them across buildings |
| Terrain | ≤ 150 k triangles; denser inside the plot, coarse outside |
| Hero tree (near) | 2–6 k triangles, leaf cards with alpha-clip (not alpha-blend) |
| Mid tree | 300–800 triangles |
| Far forest tree | 2–4 crossed planes or a billboard |
| Car | ≤ 3 k triangles, 4–5 variants |
| Convention centre | ≤ 60 k triangles |

- **Instancing is essential:** trees, shrubs, cars, lamps, benches must be *linked duplicates* (Alt+D) or Geometry-Nodes instances realised as instances, so they export with `EXT_mesh_gpu_instancing`. ~12,000 trees are fine as instances; never as unique meshes.
- Provide 2–3 LODs for trees as separate objects (`Tree_Mango_LOD0`, `_LOD1`, `_far`).
- No subdivision/particle/hair modifiers left unapplied; no n-gons on curved surfaces.

## 5. Materials & textures
- **Principled BSDF only** (base colour, metallic, roughness, normal, emission, alpha). Procedural node textures must be **baked** to images.
- Texture size: 2048 px max (4096 only for the terrain albedo if needed); 1024 for props; pack ORM (Occlusion-Roughness-Metallic) into one image.
- Format on delivery: PNG/JPG sources + exported GLB with **WebP** textures (KTX2/Basis textures are also supported if you use them).
- Tileable textures for grass/asphalt/plaster/tiles with real-world scale (state the tile size in metres).
- Foliage: single leaf atlas per species, alpha mode **Clip** (Blend Mode: Alpha Clip), double-sided.
- Glass: opaque reflective (roughness ≈ 0.1, dark tint) rather than true transparency, except shopfront close-ups.
- Colour management: textures sRGB for colour, Non-Color for data maps.

## 6. Lighting
- The website lights the scene in real time (sun + sky + soft shadows) so the time of day can change. **Do not bake sun shadows into the albedo.**
- **Do bake ambient occlusion** per building/prop into the occlusion channel (second UV set is fine) — this gives the contact-shadow richness cheaply.
- Optional (discuss first): baked lightmaps for the buildings' bounce light. Deliver each as a WebP image next to the GLB and add a custom property `lightMap` = the file name (e.g. `MainBuilding_LM.webp`) on every mesh that uses it; it is sampled on the mesh's **second UV map** (falls back to the first).

## 7. Content checklist (match the render)
- [ ] Terrain from contours with graded pads, rock outcrops, natural slope breaks
- [ ] Roads: ring road with perpendicular parking, parking spine, west road, hairpin access road, brick kerbs, markings, prayer-hall footpath
- [ ] Convention centre (Kerala-style tiled hip roofs, verandah, columns, real openings)
- [ ] Prayer hall (twin halls + link), security cabin
- [ ] Eye-shaped infinity pool + deck + fountain + pool pergola
- [ ] Amphitheatre (7 tiers) + round plaza
- [ ] Children's play area with equipment on yellow rubber surface
- [ ] Red timber pergolas (5) + west pergola gate + south gate with pillars
- [ ] Compound/plot boundary wall
- [ ] Planting inside the plot: avenue trees, columnar trees on the hairpin, palms, hedges, flower beds, lawns
- [ ] Dense surrounding tropical forest with coconut/areca palms, to ≈ 700 m
- [ ] Cars (~100 parked, a few on the roads), street lamps, benches, signage

## 8. Export settings (Blender 4.x → File → Export → glTF 2.0)
- Format: **glTF Binary (.glb)**
- Include: Selected/Visible as needed, **Custom Properties ✔**, Cameras ✘, Punctual Lights ✘
- Transform: **+Y Up ✔**
- Data → Mesh: Apply Modifiers ✔, UVs ✔, Normals ✔, Tangents ✔ (if normal maps), Vertex Colours as needed
- Data → Scene Graph: **GPU Instances ✔** (exports linked duplicates as instanced meshes)
- Data → Material: Export, Images **WebP** (quality 85–90)
- Compression: **Draco ✔** (level 6; position 14 bits, normal 10, texcoord 12) — the site already decodes Draco and Meshopt
- Animation: ✘ (none needed)

## 9. File size & delivery
- Target: main GLB ≤ 10 MB (Draco + WebP). If larger, split into `mountain-courtyard.glb` (terrain, roads, buildings, all clickable zones and `Hotspots`) and extra files such as `mountain-courtyard-vegetation.glb` — the site loads the main file first and streams the others in (the developer lists them in `src/hero/config.js` → `models.extras`).
- Deliver: the `.blend` (with packed or relative textures), exported `.glb`, texture source folder, and 3 preview renders.
- **Self-check before sending:** the project has its own checker. Run `python serve.py`, open `http://localhost:5173/tools/validate-model.html` and drop your GLB on it — it lists every contract or budget problem (names, hotspot ids, anchors, instancing, triangles, draw calls, texture sizes, file size). You can also inspect the file in https://gltf.report.
- Licence: all third-party assets must be CC0 or licensed for commercial web use; list them with sources.

## 10. Acceptance test (developer runs)
0. `tools/validate-model.html` shows no FAIL rows.
1. Replace `public/models/mountain-courtyard.glb`, run `python serve.py`, open `http://localhost:5173/?debug`.
2. All 8 labels appear at their anchors; clicking each zone selects it and opens its card.
3. Camera cannot go below the terrain anywhere; presets (Aerial / Main Building / Recreation) frame correctly.
4. Debug HUD: ≥ 60 fps desktop, draw calls ≤ 150, triangles ≤ 1.5 M.
5. Pool water animates; shadows present; no missing textures (no black/pink surfaces).
