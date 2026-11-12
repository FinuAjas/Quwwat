import * as THREE from 'three';

/**
 * Fast ground-height lookup for ANY terrain mesh (procedural grid or artist-built).
 * At load, every terrain triangle is rasterised top-down into a regular height grid
 * (highest surface wins); queries are then a bilinear lookup — cheap enough to run every
 * frame for camera collision, unlike raycasting 100k+ triangles.
 *
 * @param {THREE.Mesh} terrainMesh
 * @param {{cell?: number, maxCells?: number}} [opts] cell size in metres (auto-enlarged for huge terrains)
 */
export function createHeightSampler(terrainMesh, { cell = 2.5, maxCells = 640 } = {}) {
  terrainMesh.updateWorldMatrix(true, false);
  const geo = terrainMesh.geometry;
  const pos = geo.attributes.position, index = geo.index;
  const m = terrainMesh.matrixWorld;

  // world-space vertices
  const n = pos.count, vx = new Float32Array(n), vy = new Float32Array(n), vz = new Float32Array(n);
  const v = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    vx[i] = v.x; vy[i] = v.y; vz[i] = v.z;
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
    if (v.y < minY) minY = v.y;
  }
  cell = Math.max(cell, (maxX - minX) / maxCells, (maxZ - minZ) / maxCells);
  const nx = Math.max(2, Math.ceil((maxX - minX) / cell) + 1), nz = Math.max(2, Math.ceil((maxZ - minZ) / cell) + 1);
  const grid = new Float32Array(nx * nz).fill(NaN);
  const put = (i, j, y) => { const k = j * nx + i; if (!(grid[k] >= y)) grid[k] = y; };

  // rasterise triangles (sample points = grid nodes)
  const triCount = index ? index.count / 3 : n / 3;
  for (let t = 0; t < triCount; t++) {
    const a = index ? index.getX(t * 3) : t * 3, b = index ? index.getX(t * 3 + 1) : t * 3 + 1, c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const ax = vx[a], az = vz[a], bx = vx[b], bz = vz[b], cx = vx[c], cz = vz[c];
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-9) continue; // vertical or degenerate
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - minX) / cell)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - minX) / cell));
    const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - minZ) / cell)), j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - minZ) / cell));
    for (let j = j0; j <= j1; j++) {
      const pz = minZ + j * cell;
      for (let i = i0; i <= i1; i++) {
        const px = minX + i * cell;
        const w1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den;
        const w2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
        const w3 = 1 - w1 - w2;
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
        put(i, j, w1 * vy[a] + w2 * vy[b] + w3 * vy[c]);
      }
    }
  }
  // triangles smaller than a cell can miss every node: splat vertices to their nearest node too
  for (let i = 0; i < n; i++) {
    const gi = Math.round((vx[i] - minX) / cell), gj = Math.round((vz[i] - minZ) / cell);
    if (gi >= 0 && gi < nx && gj >= 0 && gj < nz && Number.isNaN(grid[gj * nx + gi])) grid[gj * nx + gi] = vy[i];
  }
  // fill remaining holes from neighbours (a few passes), then with the lowest height
  for (let pass = 0; pass < 8; pass++) {
    let holes = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!Number.isNaN(grid[k])) continue;
      let s = 0, c = 0;
      if (i > 0 && !Number.isNaN(grid[k - 1])) { s += grid[k - 1]; c++; }
      if (i < nx - 1 && !Number.isNaN(grid[k + 1])) { s += grid[k + 1]; c++; }
      if (j > 0 && !Number.isNaN(grid[k - nx])) { s += grid[k - nx]; c++; }
      if (j < nz - 1 && !Number.isNaN(grid[k + nx])) { s += grid[k + nx]; c++; }
      if (c) grid[k] = s / c; else holes++;
    }
    if (!holes) break;
  }
  for (let k = 0; k < grid.length; k++) if (Number.isNaN(grid[k])) grid[k] = minY;

  const heightAt = (x, z) => {
    const fx = Math.min(nx - 1.001, Math.max(0, (x - minX) / cell)), fz = Math.min(nz - 1.001, Math.max(0, (z - minZ) / cell));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, w = fz - j, k = j * nx + i;
    return (grid[k] * (1 - u) + grid[k + 1] * u) * (1 - w) + (grid[k + nx] * (1 - u) + grid[k + nx + 1] * u) * w;
  };
  heightAt.bounds = { minX, maxX, minZ, maxZ, cell, nx, nz };
  return heightAt;
}
