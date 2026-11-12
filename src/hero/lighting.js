import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Outdoor lighting for the active look:
 *  - warm directional sun with soft shadows (fitted to the site once the model is loaded)
 *  - hemisphere fill
 *  - a procedural sky (gradient + sun glow + ground bounce colour) used both as the visible
 *    background and, pre-filtered, as the image-based lighting / reflection environment —
 *    so glass, water and car paint reflect a sky whose sun matches the real light direction
 *  - distance fog matched to the horizon
 *  - slow cloud shadows drifting over the land (sunlight only; see installAtmosphere)
 */
export function setupLighting(scene, renderer) {
  installAtmosphere(); // must run before any material is compiled
  if (QUALITY.shadows && QUALITY.softShadows) installSoftShadows();
  const center = new THREE.Vector3().fromArray(CONFIG.siteCenter);

  const h = CONFIG.hemi;
  const hemi = new THREE.HemisphereLight(h.sky, h.ground, h.intensity);
  hemi.name = 'SkyFill';
  scene.add(hemi);

  const s = CONFIG.sun;
  const sun = new THREE.DirectionalLight(s.color, s.intensity);
  sun.name = 'Sun';
  sun.position.copy(center).add(new THREE.Vector3().fromArray(s.position));
  sun.target.position.copy(center);
  if (QUALITY.shadows) {
    sun.castShadow = true;
    const mapSize = Math.min(QUALITY.shadowMapSize, renderer.capabilities.maxTextureSize);
    sun.shadow.mapSize.set(mapSize, mapSize);
    const e = s.shadowExtent;
    Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 20, far: s.shadowFar });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.35;
    setSoftness(sun);
  }
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3().fromArray(s.position).normalize();

  // Visible sky
  const dome = createSkyDome(sunDir, 1);
  scene.add(dome);

  // Environment (IBL + reflections) rendered from the same sky, slightly brighter, with a ground colour
  const envScene = new THREE.Scene();
  envScene.add(createSkyDome(sunDir, CONFIG.env.skyBoost));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02, 1, 6000).texture;
  scene.environmentIntensity = CONFIG.env.intensity;
  pmrem.dispose();

  // The atmosphere shader ignores the fog distances, so `near` / `far` carry the cloud-shadow drift instead:
  // they are the only values three.js already sends to every fogged material each frame.
  scene.fog = new THREE.Fog(CONFIG.fog.color, 0, 0);
  scene.background = new THREE.Color(CONFIG.fog.color);

  /**
   * Tighten the shadow camera around the given objects (in light space) so the whole shadow map
   * is spent on the site instead of on empty forest. Call once after the model is added.
   */
  function fitShadows(objects, margin = 22) {
    if (!sun.castShadow) return;
    const box = new THREE.Box3();
    objects.filter(Boolean).forEach((o) => box.expandByObject(o));
    if (box.isEmpty()) return;
    box.expandByScalar(margin);
    sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
    const cam = sun.shadow.camera;
    const view = new THREE.Matrix4().lookAt(sun.position, sun.target.position, cam.up).setPosition(sun.position).invert();
    const p = new THREE.Vector3(), b = new THREE.Box3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(view);
      b.expandByPoint(p);
    }
    cam.left = b.min.x; cam.right = b.max.x; cam.bottom = b.min.y; cam.top = b.max.y;
    cam.near = Math.max(1, -b.max.z - 260); // keep tall trees between the sun and the site as casters
    cam.far = -b.min.z + 40;
    cam.updateProjectionMatrix();
    const texel = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) / sun.shadow.mapSize.x;
    sun.shadow.normalBias = THREE.MathUtils.clamp(texel * 4, 0.12, 0.5);
    setSoftness(sun);
    renderer.shadowMap.needsUpdate = true;
    return { width: b.max.x - b.min.x, height: b.max.y - b.min.y, texel };
  }

  /** Per-frame: move the cloud shadows with the wind. */
  const cl = CONFIG.clouds;
  function update(t) {
    if (reducedMotion) return;
    scene.fog.near = (t * cl.wind[0]) / cl.size;
    scene.fog.far = (t * cl.wind[1]) / cl.size;
  }

  return { sun, hemi, dome, fitShadows, update };
}

function createSkyDome(sunDir, boost) {
  const { top, horizon, bottom } = CONFIG.sky;
  const mat = new THREE.ShaderMaterial({
    name: 'SkyGradient',
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) },
      ground: { value: new THREE.Color(CONFIG.env.ground) },
      sunDir: { value: sunDir.clone() }, sunColor: { value: new THREE.Color(CONFIG.sun.color) },
      glow: { value: CONFIG.env.sunGlow }, boost: { value: boost },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, horizon, bottom, ground, sunDir, sunColor; uniform float glow, boost; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 sky = mix(horizon, top, pow(smoothstep(0.0, 0.6, d.y), 0.8));
        // below the horizon: haze band, then (for reflections / bounce light) the ground colour
        vec3 low = mix(bottom, ground, smoothstep(-0.03, -0.25, d.y) * step(1.001, boost));
        vec3 c = d.y > 0.0 ? sky : mix(horizon, low, smoothstep(0.0, -0.06, d.y));
        // sun: tight core + wide atmospheric glow, only above the horizon
        float s = max(dot(d, sunDir), 0.0);
        c += sunColor * glow * (pow(s, 900.0) * 14.0 + pow(s, 48.0) * 0.9 + pow(s, 6.0) * 0.22) * smoothstep(-0.05, 0.05, d.y);
        gl_FragColor = vec4(c * boost, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), mat);
  dome.name = 'SkyDome';
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
}

/**
 * Replaces three.js' flat distance fog with an atmosphere model, for every material at once
 * (standard, instanced foliage, water, sprites) by patching the shared fog shader chunks:
 *  - exponential distance haze that thins with altitude (aerial perspective)
 *  - near haze is cool blue-grey, far haze takes the horizon colour, haze towards the sun turns warm
 *  - ground-hugging mist pooled in the low valleys, so it sits between the trees rather than on top
 * It also adds cloud shadows: two layers of soft noise, projected along the sun's rays, dim the direct
 * sunlight (never the sky light, so shaded ground keeps its colour). The pattern drifts with `scene.fog.near/far`.
 * Constants are baked from the active look; `scene.fog` supplies the horizon colour, the drift, and enables fog.
 */
/**
 * Distance-based soft shadows (PCSS): for each lit point, find the average depth of whatever blocks the sun
 * nearby, then blur the shadow edge in proportion to the gap between blocker and receiver — crisp under a
 * car or at the foot of a wall, soft where a treetop's shadow lands far below.
 * Replaces the fixed-width filter inside three.js' getShadow() for directional and spot lights. Sample
 * positions are rotated per pixel, so the blur shows as fine grain (hidden by the film grain) instead of bands.
 * The two numbers the shader needs arrive packed in the light's `shadow.radius` (see setSoftness).
 */
function installSoftShadows() {
  const [blockers, taps] = QUALITY.softShadows;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const fnHook = '	float getShadow(', bodyHook = '#if defined( SHADOWMAP_TYPE_PCF )';
  if (!chunk.includes(fnHook) || !chunk.includes(bodyHook)) {
    console.warn('Distance-based soft shadows are off: this three.js version has a different shadow shader.');
    return;
  }
  const functions = /* glsl */`
	float softNoise( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
	vec2 softDisk( int i, float count, float turn ) {
		float a = float( i ) * 2.39996323 + turn;
		return vec2( cos( a ), sin( a ) ) * sqrt( ( float( i ) + 0.5 ) / count );
	}
	float softShadow( sampler2D map, vec2 mapSize, float packed, vec3 coord ) {
		float maxR = floor( packed ) / 16384.0; // widest blur, in shadow-map UV
		float spread = fract( packed );           // UV of blur per unit of depth between blocker and receiver
		float texel = 1.0 / mapSize.x;
		float turn = softNoise( gl_FragCoord.xy ) * 6.2831853;
		// Depth slope of the surface being shaded, so a wide filter on a hillside does not shadow itself.
		vec3 dx = dFdx( coord ), dy = dFdy( coord );
		float det = dx.x * dy.y - dx.y * dy.x;
		vec2 slope = abs( det ) > 1e-12 ? vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det : vec2( 0.0 );
		float sum = 0.0, hits = 0.0;
		for ( int i = 0; i < ${blockers}; i ++ ) {
			vec2 o = softDisk( i, ${blockers}.0, turn ) * maxR * 0.6;
			float d = unpackRGBAToDepth( textureLod( map, coord.xy + o, 0.0 ) ); // explicit LOD: no screen-space gradients inside a loop
			float ref = coord.z + clamp( dot( slope, o ), -0.004, 0.004 );
			if ( d < ref - 0.0004 ) { sum += d; hits += 1.0; }
		}
		if ( hits < 0.5 ) return 1.0;
		float radius = clamp( ( coord.z - sum / hits ) * spread, texel * 1.25, maxR );
		float lit = 0.0;
		for ( int i = 0; i < ${taps}; i ++ ) {
			vec2 o = softDisk( i, ${taps}.0, turn + 1.7 ) * radius;
			lit += step( coord.z + clamp( dot( slope, o ), -0.004, 0.004 ), unpackRGBAToDepth( textureLod( map, coord.xy + o, 0.0 ) ) );
		}
		return lit / ${taps}.0;
	}

`;
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk
    .replace(fnHook, functions + fnHook)
    .replace(bodyHook, `#if 1
			shadow = softShadow( shadowMap, shadowMapSize, shadowRadius, shadowCoord.xyz );
		#elif defined( SHADOWMAP_TYPE_PCF )`);
}

/**
 * Hand the soft-shadow shader its two numbers through the one spare per-light value, `shadow.radius`:
 * whole part = widest blur (UV × 16384), fraction = blur in UV per unit of shadow depth. Both depend on the
 * shadow camera's size, so call again whenever that changes.
 */
function setSoftness(sun) {
  if (!QUALITY.softShadows) return;
  const cam = sun.shadow.camera, sh = CONFIG.shadows;
  const width = ((cam.right - cam.left) + (cam.top - cam.bottom)) / 2;
  const spread = Math.min(0.999, ((cam.far - cam.near) * sh.softness) / width);
  sun.shadow.radius = Math.max(1, Math.round((sh.maxBlur / width) * 16384)) + spread;
}

let atmosphereInstalled = false;
function installAtmosphere() {
  if (atmosphereInstalled) return;
  atmosphereInstalled = true;
  const hz = CONFIG.haze, at = CONFIG.atmosphere, cl = CONFIG.clouds;
  const edge = 0.5 + (0.5 - cl.cover) * 0.55 - cl.soft / 2; // noise level where shade starts (noise is centred on 0.5)
  const f = (n) => Number(n).toFixed(6);
  const v3 = (c) => { const k = new THREE.Color(c); return `vec3(${f(k.r)}, ${f(k.g)}, ${f(k.b)})`; };
  const sun = new THREE.Vector3().fromArray(CONFIG.sun.position).normalize();

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
    #ifdef USE_FOG
      varying float vFogDepth;
      varying vec3 vFogWorld;
    #endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */`
    #ifdef USE_FOG
      vFogDepth = -mvPosition.z;
      vFogWorld = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix); // view → world without a matrix inverse
    #endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
    #ifdef USE_FOG
      uniform vec3 fogColor;
      varying float vFogDepth;
      varying vec3 vFogWorld;
      uniform float fogNear; // cloud drift x (in noise cells)
      uniform float fogFar;  // cloud drift z
      float hzHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float hzNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hzHash(i), hzHash(i + vec2(1.0, 0.0)), f.x), mix(hzHash(i + vec2(0.0, 1.0)), hzHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      // Share of direct sunlight reaching this point (1 = clear sky above, lower under a drifting cloud).
      float cloudShade() {
        vec2 p = (vFogWorld.xz - vFogWorld.y * ${`vec2(${f(sun.x / sun.y)}, ${f(sun.z / sun.y)})`}) / ${f(cl.size)} - vec2(fogNear, fogFar);
        float n = hzNoise(p) * 0.65 + hzNoise(p * 2.7 + 31.0) * 0.35;
        return 1.0 - ${f(CONFIG.cloudShadow ?? 0)} * smoothstep(${f(edge)}, ${f(edge + cl.soft)}, n);
      }
    #endif`;
  if (CONFIG.cloudShadow > 0) {
    const hook = 'getDirectionalLightInfo( directionalLight, directLight );';
    const chunk = THREE.ShaderChunk.lights_fragment_begin;
    if (chunk.includes(hook)) THREE.ShaderChunk.lights_fragment_begin = chunk.replace(hook, `${hook}
		#ifdef USE_FOG
		directLight.color *= cloudShade();
		#endif`);
    else console.warn('Cloud shadows are off: this three.js version has a different light shader.');
  }
  THREE.ShaderChunk.fog_fragment = /* glsl */`
    #ifdef USE_FOG
      float hzD = vFogDepth * ${f(hz.density)};
      float hzDist = 1.0 - exp(-hzD * hzD);
      float hzAlt = exp(-max(vFogWorld.y, 0.0) / ${f(at.heightFalloff)});
      float hzValley = exp(-max(vFogWorld.y - (${f(at.valley.top)}), 0.0) / ${f(at.valley.falloff)})
                     * (1.0 - exp(-vFogDepth / ${f(at.valley.reach)})) * ${f(hz.valleyAmount)};
      float hzAmount = clamp(hzDist * mix(0.55, 1.0, hzAlt) + hzValley * (1.0 - hzDist), 0.0, 1.0);
      vec3 hzView = normalize(vFogWorld - cameraPosition);
      float hzSun = pow(max(dot(hzView, ${`vec3(${f(sun.x)}, ${f(sun.y)}, ${f(sun.z)})`}), 0.0), 5.0);
      vec3 hzColor = mix(${v3(hz.aerial)}, fogColor, smoothstep(0.05, 0.7, hzDist));
      hzColor = mix(hzColor, ${v3(hz.sunTint)}, hzSun * 0.55);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, hzColor, hzAmount);
    #endif`;
}
