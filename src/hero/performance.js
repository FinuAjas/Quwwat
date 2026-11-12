import { CONFIG, QUALITY, TIER } from './config.js';

/**
 * Runtime performance helpers:
 *  - adaptive pixel ratio (drops resolution when frames are slow, recovers when fast)
 *  - pauses rendering when the hero is scrolled off-screen or the tab is hidden
 *  - optional ?debug HUD with fps / draw calls / triangles
 */
export function createPerformance(renderer, container, { onPixelRatio = () => {} } = {}) {
  const p = CONFIG.perf;
  const maxRatio = Math.min(devicePixelRatio, QUALITY.pixelRatio);
  let ratio = maxRatio;
  let frames = 0, acc = 0, last = performance.now(), cooldown = 0;
  let visible = true, paused = false;

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 }).observe(container);
  const active = () => visible && !paused; // hidden tabs already stop requestAnimationFrame

  const debug = new URLSearchParams(location.search).has('debug');
  let hud = null;
  if (debug) {
    hud = document.createElement('pre');
    hud.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;margin:0;padding:6px 8px;background:rgba(0,0,0,.6);color:#9f9;font:11px/1.35 ui-monospace,monospace;border-radius:6px;pointer-events:none';
    document.body.appendChild(hud);
  }

  /** Call once per rendered frame. Returns false when rendering should be skipped. */
  function tick() {
    const now = performance.now();
    const dt = now - last; last = now;
    if (!active()) return false;
    if (dt < 250) { acc += dt; frames++; } // ignore stalls (tab switches, GC)
    if (frames >= p.sampleFrames) {
      const avg = acc / frames;
      if (cooldown-- <= 0) {
        let next = ratio;
        if (avg > p.slowMs && ratio > p.minPixelRatio) next = Math.max(p.minPixelRatio, ratio - p.step);
        else if (avg < p.fastMs && ratio < maxRatio) next = Math.min(maxRatio, ratio + p.step);
        if (next !== ratio) { ratio = next; renderer.setPixelRatio(ratio); renderer.setSize(container.clientWidth, container.clientHeight, false); onPixelRatio(ratio); cooldown = 2; }
      }
      if (hud) {
        const i = renderer.info.render;
        hud.textContent = `${TIER} tier\nfps   ${(1000 / avg).toFixed(0)}\ndpr   ${ratio.toFixed(2)}\ncalls ${i.calls}\ntris  ${(i.triangles / 1e6).toFixed(2)}M`;
      }
      frames = 0; acc = 0;
    }
    return true;
  }
  return { tick, setPaused: (v) => { paused = v; }, get pixelRatio() { return ratio; } };
}
