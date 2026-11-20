import * as THREE from 'three';

const HOVER = new THREE.Color(0xffd9a8);
const DRAG_PX = 6, CLICK_MS = 500;

/**
 * Clickable zones (Main Building, Swimming Pool, Amphitheatre, Recreation Zone, …).
 * Any loaded node with `userData.hotspotId` becomes a hotspot. Hover highlights it,
 * a click focuses the camera and dispatches `hotspot:select` on `hero`
 * (detail: { id, title, anchor, object }); clicking empty ground dispatches `hotspot:clear`.
 * Meshes in a file that arrives later can belong to a hotspot too: `userData.hotspotZone = <its id>` (the people at
 * the play area and the amphitheatre). `addParts(root)` registers them; hovering or clicking one acts on that hotspot.
 */
export function createHotspots({ camera, dom, hero, site, rig, heightAt }) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const anchors = new Map(site.anchors.map((a) => [a.userData.hotspotId, a]));

  // ---------- registry ----------
  const spots = site.clickable.map((object) => {
    const id = object.userData.hotspotId;
    const meshes = [];
    const own = new Map(); // shared material -> private clone, so highlighting one zone doesn't light up others
    object.traverse((o) => {
      if (!o.isMesh) return;
      if (!own.has(o.material)) {
        let m = o.material;
        if (!m.name?.startsWith('Water') && m.emissive) {
          m = o.material.clone();
          // clone() drops shader patches (weathering, foliage wind): carry them over
          m.onBeforeCompile = o.material.onBeforeCompile;
          m.customProgramCacheKey = o.material.customProgramCacheKey;
        }
        own.set(o.material, m);
      }
      o.material = own.get(o.material);
      o.userData.hotspotRoot = object;
      meshes.push(o);
    });
    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const anchor = anchors.get(id);
    return {
      id, title: object.userData.title ?? id, object, meshes, box, sphere,
      materials: [...new Set(own.values())].filter((m) => m.emissive && !m.name?.startsWith('Water')),
      anchor: anchor ? anchor.getWorldPosition(new THREE.Vector3()) : sphere.center.clone(),
    };
  });
  const byRoot = new Map(spots.map((s) => [s.object, s]));
  const byId = new Map(spots.map((s) => [s.id, s]));
  const pickables = spots.map((s) => s.object);
  const occluders = [site.terrain].filter(Boolean);
  const parts = []; // { mesh, spot, box }: see addParts()

  // ---------- ground ring marker ----------
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96).rotateX(-Math.PI / 2), ringMat);
  ring.name = 'HotspotRing';
  ring.renderOrder = 5;
  ring.layers.set(1); // overlay layer: skipped by the ambient-occlusion pass
  ring.visible = false;
  site.root.parent.add(ring);
  function placeRing(spot) {
    if (!spot) { ring.visible = false; return; }
    const c = spot.box.getCenter(new THREE.Vector3());
    const r = Math.max(7, Math.hypot(spot.box.max.x - spot.box.min.x, spot.box.max.z - spot.box.min.z) * 0.38);
    ring.position.set(c.x, heightAt(c.x, c.z) + 0.6, c.z);
    ring.userData.radius = r;
    ring.visible = true;
  }

  // ---------- state ----------
  let hovered = null, selected = null, pointerDirty = false, pointerInside = false;
  function setHighlight(spot, amount) {
    if (!spot) return;
    for (const m of spot.materials) { m.emissive.copy(HOVER); m.emissiveIntensity = amount; }
  }
  function refreshHighlights() {
    for (const s of spots) setHighlight(s, s === selected ? 0.22 : s === hovered ? 0.14 : 0);
    placeRing(selected ?? hovered);
  }

  function pick(withOcclusion) {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(withOcclusion ? [...pickables, ...occluders] : pickables, true);
    let found = null, distance = Infinity;
    for (const h of hits) {
      const root = h.object.userData.hotspotRoot;
      if (!root && !occluders.includes(h.object)) continue;
      found = root ? byRoot.get(root) : null; // terrain in front of anything clickable: nothing
      distance = h.distance;
      break;
    }
    // Parts from later files (the people) are dense meshes, about 1 ms a ray: test them only where they could change
    // the answer, i.e. not when the ray already lands on their own zone.
    for (const p of parts) {
      if (p.spot === found || !raycaster.ray.intersectsBox(p.box)) continue;
      const hit = raycaster.intersectObject(p.mesh, false)[0];
      if (hit && hit.distance < distance) { found = p.spot; distance = hit.distance; }
    }
    return found;
  }
  function setPointer(e) {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  // ---------- input ----------
  let down = null;
  dom.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    setPointer(e); pointerDirty = true; pointerInside = true;
  });
  dom.addEventListener('pointerleave', () => { pointerInside = false; pointerDirty = true; });
  dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  dom.addEventListener('pointerup', (e) => {
    if (!down || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > DRAG_PX || dt > CLICK_MS) return; // that was an orbit/pan drag, not a click
    setPointer(e);
    const spot = pick(true);
    spot ? select(spot.id) : clear();
  });
  dom.addEventListener('keydown', (e) => { if (e.key === 'Escape') clear(); });

  // ---------- API ----------
  function select(id, { fly = true } = {}) {
    const spot = byId.get(id);
    if (!spot) return;
    selected = spot;
    refreshHighlights();
    if (fly) {
      const focus = spot.sphere.center.clone();
      focus.y = heightAt(focus.x, focus.z) + Math.min(6, spot.box.max.y - spot.box.min.y) * 0.4;
      rig.focus(focus, THREE.MathUtils.clamp(spot.sphere.radius * 3.4, 45, 150));
    }
    hero.dispatchEvent(new CustomEvent('hotspot:select', { detail: { id: spot.id, title: spot.title, anchor: spot.anchor, object: spot.object } }));
  }
  function clear() {
    if (!selected) return;
    selected = null;
    refreshHighlights();
    hero.dispatchEvent(new CustomEvent('hotspot:clear'));
  }

  /** Meshes under `root` with userData.hotspotZone count as part of that hotspot (its highlight and framing stay as they are). */
  function addParts(root) {
    root.traverse((o) => {
      const spot = o.isMesh ? byId.get(o.userData.hotspotZone) : null;
      if (!spot) return;
      const box = new THREE.Box3().setFromObject(o);
      if (o.userData.motion) box.expandByScalar(1.2); // children on a swing or the roundabout: wherever they are in it
      parts.push({ mesh: o, spot, box });
    });
  }

  function update(t) {
    if (pointerDirty) {
      pointerDirty = false;
      const next = pointerInside && !down ? pick(false) : null;
      if (next !== hovered) {
        hovered = next;
        dom.style.cursor = hovered ? 'pointer' : '';
        refreshHighlights();
      }
    }
    if (ring.visible) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const r = ring.userData.radius * (1 + pulse * 0.06);
      ring.scale.set(r, 1, r);
      ringMat.opacity = (selected ? 0.75 : 0.45) * (0.65 + 0.35 * pulse);
    }
  }

  return { spots, select, clear, update, addParts, get selected() { return selected?.id ?? null; } };
}
