import * as THREE from 'three';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CLAP_RATE = 2 * Math.PI * 1.7; // claps per second, as radians per second

/**
 * Gentle motion (Plan 4, H6), driven by data in the model:
 *  - objects with `userData.motion` move about their own origin (src/model/play.js):
 *      { kind: 'swing', amplitude, period, phase } rocks about the local X axis (the swings and the children on them)
 *      { kind: 'spin', period } turns about the local Y axis (the roundabout and the children riding it)
 *  - meshes with a `sway` vertex attribute (`_sway` in the .glb) move those vertices in the vertex shader:
 *    xyz = the offset at full stroke, w = phase (the clapping guests at the wedding, src/model/people.js)
 * Visitors who prefer reduced motion see the model's own pose, still.
 * The shadow map is drawn once, so the swings and the children on the moving equipment cast no shadow (set in the model).
 * `add(root)` registers what a loaded file brings; `update(t)` runs every frame; `rest()` puts everything back in the
 * model's pose (for tools that compare images).
 */
export function createMotion() {
  const movers = [], time = { value: 0 }, amount = { value: 0 };
  const q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

  function patchSway(mesh) {
    const mat = mesh.material.clone(); // the people without the attribute keep the shared, unpatched material
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMotionTime = time;
      shader.uniforms.uMotionAmount = amount;
      shader.vertexShader = `attribute vec4 sway;\nuniform float uMotionTime;\nuniform float uMotionAmount;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += sway.xyz * (uMotionAmount * cos(uMotionTime * ${CLAP_RATE.toFixed(4)} + sway.w));`,
      );
    };
    mat.customProgramCacheKey = () => 'people-sway';
    mesh.material = mat;
  }

  function add(root) {
    root.traverse((o) => {
      if (o.userData.motion?.kind) movers.push({ o, m: o.userData.motion, rest: o.quaternion.clone() });
      if (!o.isMesh) return;
      const g = o.geometry;
      if (g.attributes._sway) { g.setAttribute('sway', g.attributes._sway); g.deleteAttribute('_sway'); } // as GLTFLoader names it
      if (g.attributes.sway && !reducedMotion) patchSway(o);
    });
  }

  function pose(o, rest, angle, axis) {
    o.quaternion.copy(rest).multiply(q.setFromAxisAngle(axis, angle));
    o.updateMatrix(); // the loader froze every matrix: update this one and its children's world matrices by hand
    o.updateMatrixWorld(true);
  }

  function update(t) {
    if (reducedMotion) return;
    time.value = t;
    amount.value = 1;
    for (const { o, m, rest } of movers) {
      if (m.kind === 'swing') pose(o, rest, m.amplitude * Math.sin((2 * Math.PI * t) / m.period + (m.phase ?? 0)), X);
      else if (m.kind === 'spin') pose(o, rest, ((2 * Math.PI * t) / m.period) % (2 * Math.PI), Y);
    }
  }

  function rest() {
    amount.value = 0;
    for (const { o, rest: r } of movers) pose(o, r, 0, X);
  }

  return { add, update, rest, get movers() { return movers.length; } };
}
