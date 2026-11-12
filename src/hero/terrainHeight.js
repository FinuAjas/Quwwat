/**
 * Fast ground-height lookup rebuilt from the exported terrain grid (rows of constant Z,
 * columns of constant X, triangulated a-c-b / b-c-d). O(log n) per query — cheap enough
 * to run every frame for camera collision, unlike raycasting ~70k triangles.
 */
export function createHeightSampler(terrainMesh) {
  const pos = terrainMesh.geometry.attributes.position;
  const z0 = pos.getZ(0);
  let nx = 1;
  while (nx < pos.count && pos.getZ(nx) === z0) nx++;
  const nz = pos.count / nx;
  const xs = new Float64Array(nx), zs = new Float64Array(nz);
  for (let i = 0; i < nx; i++) xs[i] = pos.getX(i);
  for (let j = 0; j < nz; j++) zs[j] = pos.getZ(j * nx);

  const find = (arr, v) => {
    let lo = 0, hi = arr.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; }
    return lo;
  };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const wx = terrainMesh.matrixWorld.elements; // terrain is exported at the origin; honour any offset
  const ox = wx[12], oy = wx[13], oz = wx[14];

  return function heightAt(x, z) {
    x -= ox; z -= oz;
    const i = find(xs, x), j = find(zs, z);
    const u = clamp01((x - xs[i]) / (xs[i + 1] - xs[i])), v = clamp01((z - zs[j]) / (zs[j + 1] - zs[j]));
    const a = j * nx + i;
    const ha = pos.getY(a), hb = pos.getY(a + 1), hc = pos.getY(a + nx), hd = pos.getY(a + nx + 1);
    const h = u + v <= 1 ? ha + u * (hb - ha) + v * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
    return h + oy;
  };
}
