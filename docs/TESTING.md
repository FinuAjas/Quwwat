# Index page test log

Manual + scripted browser test of `index.html`, run against `python serve.py` (http://localhost:5173) in the
Claude desktop app's built-in browser (Chromium). Each run adds a section at the top; open items are carried
forward until they are fixed.

---

## Run 1 — 2026-11-18

**Build:** branch `p3-south-area`, on top of `f3ce45b` plus this run's changes (desktop zoom, label distances,
fullscreen error, small-phone nav, re-rendered posters).
**Viewports:** desktop 1440×900, tablet 768×1024 (portrait), phones 414×896, 375×812, 320×640.
**Tiers:** high (most checks), low and ultra (load + framing + frame rate).

### Changes made in this run

| Change | Files |
|---|---|
| Desktop / big screens (landscape, wider than 760 px) show the model 10% larger: every desktop preset sits 1/1.1 of its authored distance from its target. Phones and portrait screens keep their `mobile` presets unchanged. | `src/hero/config.js` (`DESKTOP_ZOOM`, `closer()`), `src/hero/controls.js` |
| Label fade distances scaled by the same 1.1 on desktop, so the same labels show at each preset as before the zoom. | `src/hero/popups.js` |
| A refused fullscreen request no longer throws an uncaught promise error. | `src/hero/ui.js` |
| Small phones: the menu button was pushed off the right edge at 375 px (only 8 px visible). Logos, "Enquire Now" and the button now fit at ≤420 px; below 360 px "Enquire Now" is hidden ("Contact Us" stays in the menu). | `src/styles/hero.css` |
| Poster images re-rendered (the desktop opening frame changed with the zoom). | `public/assets/images/hero-poster*.webp` |

### Results

Legend: ✅ pass · ❌ fail (open) · 🔧 failed, fixed in this run · ⚠️ not testable in this environment

#### Load
| | Check | Result |
|---|---|---|
| ✅ | Loader finishes, poster fades out | `loader is-done` |
| ✅ | No horizontal page scroll (1440, 768, 414, 375, 320 px) | all widths |
| ✅ | Canvas present and sized | 1440×900 |
| ✅ | Images load (gallery image is lazy, loads when opened) | |
| ✅ | Intro plays and lands on the aerial preset; "Skip intro" shown, skipping lands in ~0.65 s | |
| ✅ | Console: no errors from the page (after the fullscreen fix) | |

#### Desktop zoom (new)
| | Check | Result |
|---|---|---|
| ✅ | Aerial view 10% closer | 209.0 m (authored 229.9, ×1.100) |
| ✅ | Main Building preset 10% closer | 68.4 m (authored 75.2, ×1.100) |
| ✅ | Recreation preset 10% closer | 58.9 m (authored 64.8, ×1.100) |
| ✅ | Reset button returns to the zoomed aerial view | 209.0 m |
| ✅ | Phone (375×812) aerial view unchanged | 213.2 m (authored 213.2) |
| ✅ | Phone Main Building preset unchanged | 80.7 m (authored 80.7) |
| ✅ | Portrait tablet (768×1024) uses the unchanged mobile framing | 213.2 m |
| ✅ | Low and ultra tiers land on the same zoomed view | 209.0 m |
| 🔧 | Labels at the aerial view match the pre-zoom behaviour | Gate labels were brighter after the zoom; fixed by scaling the fade distances (now 0.71 / 0.38 opacity vs 0.65 / 0.38 before) |

#### Navigation
| | Check | Result |
|---|---|---|
| ✅ | Projects dropdown opens on click, closes on outside click and on Escape | |
| ✅ | Menu button hidden on desktop | |
| ❌ | "Contact Us" and "Enquire Now" link to `#contact`, but the page has no element with `id="contact"` | **open** — clicking does nothing |
| ❌ | "Goodhope Luxury Flates" has `href=""` (reloads this page); label reads "Flates" (likely "Flats") | **open** — needs the real URL and spelling |
| ⚠️ | "Investment Management" and "About Us" link to `#` | placeholders, as authored |

#### View tabs and gallery
| | Check | Result |
|---|---|---|
| ✅ | Site Images tab shows the gallery; 3D rendering pauses while it is open | frame counter stopped |
| ✅ | Gallery has the site render plus 3 captured 3D views | `1 / 4` |
| ✅ | Next / previous arrows cycle and wrap; keyboard ← → work | |
| ✅ | Gallery image has alt text | |
| ✅ | 3D tab returns and rendering resumes | |

#### Map controls and presets
| | Check | Result |
|---|---|---|
| ✅ | Preset thumbnails get captured backgrounds | |
| ✅ | Each preset flies to its view and highlights its thumbnail; arrows step through presets | |
| ✅ | Zoom in ×0.7 / zoom out ×1.4, clamped to 35–480 m | 209→146→205 m |
| ✅ | Compass turns the view to north (click and Enter); needle follows the heading | 0.00° |
| ✅ | Labels button toggles labels off / on, reports `aria-pressed` | |
| 🔧 | Fullscreen: when the browser refuses (here: the app's browser pane), the page threw "Uncaught (in promise) TypeError: Permissions check failed" | fixed: no unhandled rejection now |
| ⚠️ | Fullscreen actually entering fullscreen | the in-app browser pane refuses fullscreen; check once in Chrome / Edge |

#### Hotspots and info cards
| | Check | Result |
|---|---|---|
| ✅ | 8 labels, one per hotspot | |
| ✅ | Clicking a label opens its card (title, text, tags), camera flies to it, label highlighted, preset highlight cleared | |
| ✅ | Close button and Escape close the card | |
| ✅ | All 8 hotspots have card copy | |
| ✅ | Scrolling over the model before clicking it shows "Click the model, then scroll to zoom" | |

#### Phones and tablet
| | Check | Result |
|---|---|---|
| 🔧 | Menu button fully on screen at 375 px | was at 368–397 px of 376; now 322–360 |
| ✅ | Same at 414 px (361–399 of 415) and 320 px (267–305 of 321, "Enquire Now" hidden) | |
| ✅ | Menu opens, shows Projects + 3 links, Projects submenu opens, tapping a link closes the menu | |
| ✅ | Hotspot card opens as a bottom sheet that fits the screen width | 12–364 of 376 px |
| ✅ | Overlays (tabs, thumbnails, map controls, copy, nav) do not overlap | |

#### Still-image mode (`?3d=off`, also what data-saver visitors get)
| | Check | Result |
|---|---|---|
| ✅ | Poster stays, with "Load 3D model" button | |
| ✅ | Portrait poster used on a portrait tablet | `hero-poster-mobile.webp` |
| ✅ | No three.js, app code or models downloaded | |
| ✅ | Site Images gallery works without 3D | `1 / 1` |
| ✅ | "Load 3D model" starts the scene | |

#### Keyboard and accessibility
| | Check | Result |
|---|---|---|
| ✅ | ← → move between the 3D / Site Images tabs | |
| ✅ | Visible labels focusable, hidden ones not | |
| ✅ | Canvas has `role="application"` and a usage label | |
| ✅ | Every button has an accessible name; every image has alt text; one `h1` | |
| ✅ | Document title and meta description present | |

#### Quality tiers (1440×900 emulated in the app's browser pane, `?debug` HUD)
| Tier | fps | draw calls | triangles |
|---|---|---|---|
| low | 141 | 165 | 0.76 M |
| high | 123 | 345 | 1.58 M |
| ultra | 105 | 326 | 1.70 M |

These numbers come from the development laptop (RTX 5050) and are only a smoke test, not a phone benchmark.

### Open items (carry forward)

1. **No contact section** — "Contact Us" / "Enquire Now" point at `#contact`, which does not exist on the page.
2. **Goodhope project link** — empty `href`, and the label spelling "Flates".
3. **Fullscreen** — confirm it enters fullscreen in a normal Chrome / Edge window (the in-app browser blocks it).
4. **Real devices** — phone checks above are emulated viewports; try the page on at least one real iPhone and Android phone (touch rotate / pinch zoom, tier choice, frame rate).

### How to re-run

1. `python serve.py`, open http://localhost:5173 (add `?debug` for the fps / draw-call HUD, `?tier=low|high|ultra` to force a tier, `?3d=off` for still-image mode).
2. Walk the tables above at desktop (≥1280 px wide), portrait tablet and phone (375 px) sizes.
3. After any change to the camera presets or the look, re-render the posters: open `?tier=ultra&poster` with serve.py running (or `python tools/build_assets.py`).
