import * as THREE from 'three';
import { HOTSPOTS } from './layout.js';
import { buildTerrain, bakeGroundShade } from './terrain.js';
import { buildRoads } from './roads.js';
import { buildStructures, obstacles } from './structures.js';
import { buildVegetation } from './vegetation.js';
import { buildRocks } from './rocks.js';
import { buildFurniture } from './furniture.js';

/**
 * Builds the complete Mountain Courtyard site as a THREE.Group named "MountainCourtyard".
 * Node contract used by the hero runtime:
 *  - Groups with userData.hotspotId are clickable (MainBuilding, SwimmingPool, Amphitheater, ...).
 *  - Empty nodes "Hotspot_<id>" mark where CSS2D pop-ups are pinned.
 *  - userData.castShadow / receiveShadow flags tell the runtime how to configure shadows.
 *  - Mesh "Terrain" (userData.ground) is the ground used for camera collision.
 */
export function buildSite() {
  const t0 = performance.now();
  const root = new THREE.Group(); root.name = 'MountainCourtyard';

  const { mesh: terrain, heightAt } = buildTerrain();
  const { roads, parking, carCount } = buildRoads();
  const structures = buildStructures(heightAt);
  const furniture = buildFurniture(heightAt); // before the planting, so hedges and trees keep clear of it
  const veg = buildVegetation(heightAt);
  const rocks = buildRocks(heightAt);
  bakeGroundShade(terrain, veg.occluders, obstacles);
  root.add(terrain, roads, parking, structures, furniture.group, veg.group, rocks.group);

  const anchors = new THREE.Group(); anchors.name = 'Hotspots';
  for (const h of HOTSPOTS) {
    const target = root.getObjectByName(h.group);
    if (target) target.userData = { ...target.userData, hotspotId: h.id, title: h.title };
    const a = new THREE.Object3D();
    a.name = `Hotspot_${h.id}`;
    a.position.set(h.at[0], heightAt(h.at[0], h.at[1]) + h.lift, h.at[1]);
    a.userData = { hotspotId: h.id, title: h.title };
    anchors.add(a);
  }
  root.add(anchors);
  root.userData = { generator: 'mountain-courtyard procedural model v1', units: 'metres', up: 'Y', north: '-Z (approx.)' };

  const stats = { ms: Math.round(performance.now() - t0), trees: veg.total, treeTris: Math.round(veg.tris), cars: carCount, rocks: rocks.total, ...furniture.counts };
  return { root, heightAt, stats };
}
