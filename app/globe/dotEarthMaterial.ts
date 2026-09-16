/**
 * Dot-matrix Earth as a globe material.
 *
 * COBE (github.com/shuding/cobe, MIT) draws its globe in one fragment shader: per pixel it finds
 * the nearest point of a spherical Fibonacci lattice, asks a land map whether that point is land,
 * and paints a dot lit by the view direction with a Fresnel rim. This file runs that same shader
 * on globe.gl's sphere, so every other layer (arcs, markers, polygons, picking, camera) keeps
 * working. Differences from COBE: the sphere is a real mesh in world space, the land map is our
 * 2048 x 1024 Natural Earth mask, a second map tints dots inside affected countries, and dot
 * edges are antialiased with screen-space derivatives so they stay crisp at any zoom.
 *
 * This file and Globe.tsx are the only two that import three.
 */

import { DataTexture, NearestFilter, RGBAFormat, RedFormat, ShaderMaterial, UnsignedByteType, Vector3 } from 'three';
import { latticeSpacing } from './fibonacci';

/** COBE's index ladder decodes indices below 2^15; keep the lattice under that. */
export const MAX_DOTS = 32000;

export interface DotEarthParams {
  /** Lattice points on the sphere (density). */
  dots: number;
  /** Dot radius as a fraction of the lattice spacing. COBE's default is about 0.29. */
  dotRatio: number;
  /** Exponent of the view-direction falloff on dots (COBE `diffuse`). */
  diffuse: number;
  /** Brightness floor for ocean dots, 0 = flat ocean (COBE `mapBaseBrightness`). */
  oceanDots: number;
  /** Strength of the Fresnel rim inside the disc. */
  rim: number;
  base: string;
  dot: string;
  glow: string;
}

export const DOT_EARTH_PARAMS: DotEarthParams = {
  dots: 24000,
  dotRatio: 0.27,
  diffuse: 1.5,
  oceanDots: 0,
  rim: 0.35,
  base: '#151515',
  dot: '#e6e6e6',
  glow: '#c9cfd8',
};

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float dots;
uniform float dotRadius;
uniform float diffuse;
uniform float oceanDots;
uniform float rim;
uniform vec3 baseColor;
uniform vec3 dotColor;
uniform vec3 glowColor;
uniform sampler2D land;
uniform sampler2D tint;
varying vec3 vWorld;

const float sqrt5 = 2.236068;
const float PI = 3.141593;
const float kTau = 6.283185;
const float kPhi = 1.618034;

// Nearest point of an n-point spherical Fibonacci lattice (Keinert et al. 2015, via COBE).
// Works in a frame whose polar axis is z; the caller swizzles y<->z so the seam sits at the poles.
vec3 nearestFibonacciLattice(vec3 p, out float m) {
  float byDots = 1.0 / dots;
  float k = max(2.0, floor(log2(sqrt5 * dots * PI * (1.0 - p.z * p.z)) * 0.72021));
  vec2 f = floor(pow(kPhi, k) / sqrt5 * vec2(1.0, kPhi) + 0.5);
  vec2 br1 = fract((f + 1.0) * (kPhi - 1.0)) * kTau - 3.883222;
  vec2 br2 = -2.0 * f;
  vec2 sp = vec2(atan(p.y, p.x), p.z - 1.0);
  vec2 c = floor(vec2(br2.y * sp.x - br1.y * (sp.y * dots + 1.0), -br2.x * sp.x + br1.x * (sp.y * dots + 1.0)) / (br1.x * br2.y - br2.x * br1.y));

  float mindist = PI;
  vec3 minip = vec3(0.0, 0.0, 1.0);
  for (float s = 0.0; s < 4.0; s += 1.0) {
    vec2 o = vec2(mod(s, 2.0), floor(s * 0.5));
    float idx = dot(f, c + o);
    if (idx > dots || idx < 0.0) continue;

    // fract(idx * (phi - 1)) without losing precision on large indices
    float a = idx, b = 0.0;
    if (a >= 16384.0) { a -= 16384.0; b += 0.868872; }
    if (a >= 8192.0) { a -= 8192.0; b += 0.934436; }
    if (a >= 4096.0) { a -= 4096.0; b += 0.467218; }
    if (a >= 2048.0) { a -= 2048.0; b += 0.733609; }
    if (a >= 1024.0) { a -= 1024.0; b += 0.866804; }
    if (a >= 512.0) { a -= 512.0; b += 0.433402; }
    if (a >= 256.0) { a -= 256.0; b += 0.216701; }
    if (a >= 128.0) { a -= 128.0; b += 0.108351; }
    if (a >= 64.0) { a -= 64.0; b += 0.554175; }
    if (a >= 32.0) { a -= 32.0; b += 0.777088; }
    if (a >= 16.0) { a -= 16.0; b += 0.888544; }
    if (a >= 8.0) { a -= 8.0; b += 0.944272; }
    if (a >= 4.0) { a -= 4.0; b += 0.472136; }
    if (a >= 2.0) { a -= 2.0; b += 0.236068; }
    if (a >= 1.0) { a -= 1.0; b += 0.618034; }
    float theta = fract(b) * kTau;

    float cosphi = 1.0 - 2.0 * idx * byDots;
    float sinphi = sqrt(max(0.0, 1.0 - cosphi * cosphi));
    vec3 q = vec3(cos(theta) * sinphi, sin(theta) * sinphi, cosphi);
    float dist = length(p - q);
    if (dist < mindist) { mindist = dist; minip = q; }
  }
  m = mindist;
  return minip;
}

void main() {
  vec3 p = normalize(vWorld);
  float dist;
  vec3 q = nearestFibonacciLattice(p.xzy, dist).xzy;

  // three-globe convention: lat = asin(y), lng = 90deg - atan2(z, x)
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float lng = PI * 0.5 - atan(q.z, q.x);
  vec2 uv = vec2(fract((lng + PI) / kTau), (PI * 0.5 - lat) / PI);

  float isLand = max(texture2D(land, uv).r, oceanDots);
  vec4 t = texture2D(tint, uv);

  float nl = max(dot(p, normalize(cameraPosition)), 0.0); // headlight: dim toward the limb
  float aa = fwidth(dist);
  float coverage = 1.0 - smoothstep(dotRadius - aa, dotRadius + aa, dist);
  float dotK = coverage * isLand * pow(nl, diffuse);

  vec3 color = baseColor * (0.12 + 0.88 * pow(nl, 0.5))
             + mix(dotColor, t.rgb, t.a) * dotK
             + pow(1.0 - nl, 4.0) * glowColor * rim;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** Hex colour as a 0..1 vector without colour-management conversion (display values). */
function rgb(hex: string): Vector3 {
  const n = parseInt(hex.replace('#', ''), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function emptyTexture(format: typeof RedFormat | typeof RGBAFormat): DataTexture {
  const channels = format === RedFormat ? 1 : 4;
  const tex = new DataTexture(new Uint8Array(channels), 1, 1, format, UnsignedByteType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export interface DotEarthMaterial {
  material: ShaderMaterial;
  /** Land mask, 1 byte per cell, row 0 = lat 90 (as produced by utils/landMask). */
  setLand(data: Uint8Array | null, cols: number, rows: number): void;
  /** RGBA tint map in the same layout; alpha 0 = no tint. */
  setTint(data: Uint8Array | null, cols: number, rows: number): void;
  setParams(p: Partial<DotEarthParams>): void;
  dispose(): void;
}

export function createDotEarthMaterial(initial: Partial<DotEarthParams> = {}): DotEarthMaterial {
  const params: DotEarthParams = { ...DOT_EARTH_PARAMS, ...initial };
  let land = emptyTexture(RedFormat);
  let tint = emptyTexture(RGBAFormat);

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      dots: { value: 0 },
      dotRadius: { value: 0 },
      diffuse: { value: params.diffuse },
      oceanDots: { value: params.oceanDots },
      rim: { value: params.rim },
      baseColor: { value: rgb(params.base) },
      dotColor: { value: rgb(params.dot) },
      glowColor: { value: rgb(params.glow) },
      land: { value: land },
      tint: { value: tint },
    },
  });

  const apply = () => {
    const dots = Math.min(MAX_DOTS, Math.max(100, Math.round(params.dots)));
    material.uniforms.dots.value = dots;
    material.uniforms.dotRadius.value = params.dotRatio * latticeSpacing(dots);
    material.uniforms.diffuse.value = params.diffuse;
    material.uniforms.oceanDots.value = params.oceanDots;
    material.uniforms.rim.value = params.rim;
    material.uniforms.baseColor.value = rgb(params.base);
    material.uniforms.dotColor.value = rgb(params.dot);
    material.uniforms.glowColor.value = rgb(params.glow);
  };
  apply();

  const swap = (name: 'land' | 'tint', data: Uint8Array | null, cols: number, rows: number, format: typeof RedFormat | typeof RGBAFormat) => {
    const prev = material.uniforms[name].value as DataTexture;
    const next = data ? new DataTexture(data, cols, rows, format, UnsignedByteType) : emptyTexture(format);
    next.magFilter = NearestFilter;
    next.minFilter = NearestFilter;
    next.flipY = false; // row 0 of the data is lat 90, sampled at v = 0
    next.needsUpdate = true;
    material.uniforms[name].value = next;
    if (name === 'land') land = next; else tint = next;
    prev.dispose();
  };

  return {
    material,
    setLand: (data, cols, rows) => swap('land', data, cols, rows, RedFormat),
    setTint: (data, cols, rows) => swap('tint', data, cols, rows, RGBAFormat),
    setParams: (p) => { Object.assign(params, p); apply(); },
    dispose: () => { land.dispose(); tint.dispose(); material.dispose(); },
  };
}
