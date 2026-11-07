/**
 * Sea surface — Gerstner waves with environment reflection.
 *
 * Replaces the earlier sine-displaced plane. Two changes carry most of the
 * realism: the wave shape is Gerstner rather than sinusoidal (crests sharpen,
 * troughs broaden, which is how real swell behaves), and the material is
 * physical with low roughness, so it reflects the drei Sky instead of being
 * flat-shaded blue.
 *
 * Displacement runs on the GPU via onBeforeCompile rather than in a JS loop,
 * which keeps a 200×200 grid affordable — Document 25's performance rule.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Hoisted so the frame loop never allocates. */
const CALM_WATER = new THREE.Color("#1e6ba5");
const STORM_WATER = new THREE.Color("#284b64");
const CALM_HORIZON = new THREE.Color("#9dbdce");
const STORM_HORIZON = new THREE.Color("#71818e");

export interface OceanProps {
  /** Significant wave height in metres. Drives amplitude. */
  waveHeight: number;
  storminess: number;
  /** Own vessel speed in knots. Drives the wake. */
  speed: number;
  /** Own vessel heading in degrees, so the wake trails astern through turns. */
  heading: number;
}

export function Ocean({ waveHeight, storminess, speed, heading }: OceanProps) {

  const uniforms = useRef({
    uTime: { value: 0 },
    uAmp: { value: 0.35 },
    // Wake: hull speed drives width and foam intensity. The vessel sits at the
    // origin, so the wake is generated around (0,0) and trails along -Z.
    uSpeed: { value: 0 },
    uFoam: { value: 0 },
    // Unit vector pointing where the bow is heading, in sea-plane coords.
    uHeading: { value: new THREE.Vector2(0, 1) },
    uHorizonColor: { value: CALM_HORIZON.clone() },
  });

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(2600, 2600, 200, 200),
    [],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#1e6ba5"),
      roughness: 0.30,
      metalness: 0.0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.4,
      // Sea is not a mirror: cap how much sky it returns, or the surface
      // washes out to the sky's own colour at grazing angles.
      reflectivity: 0.32,
    });

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.current.uTime;
      shader.uniforms.uAmp = uniforms.current.uAmp;
      shader.uniforms.uSpeed = uniforms.current.uSpeed;
      shader.uniforms.uFoam = uniforms.current.uFoam;
      shader.uniforms.uHeading = uniforms.current.uHeading;
      shader.uniforms.uHorizonColor = uniforms.current.uHorizonColor;

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           uniform float uAmp;
           varying vec2 vSeaPos;

           // One Gerstner wave: displaces along the direction of travel as well
           // as vertically, which is what sharpens crests.
           vec3 gerstner(vec2 pos, vec2 dir, float steep, float wavelength, float speed, float t) {
             float k = 6.28318 / wavelength;
             float c = sqrt(9.8 / k) * speed;
             vec2 d = normalize(dir);
             float f = k * (dot(d, pos) - c * t);
             float a = steep / k;
             return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
           }`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec2 p = transformed.xy;
           vec3 disp = vec3(0.0);
           // Superposed waves at differing scales and headings read as real
           // sea rather than a repeating pattern.
           disp += gerstner(p, vec2( 1.0,  0.22), 0.26, 13.7, 0.9, uTime);
           disp += gerstner(p, vec2(-0.42, 1.0 ), 0.20, 7.3, 1.1, uTime);
           disp += gerstner(p, vec2( 0.83,-0.55), 0.15, 4.1, 1.25, uTime);
           disp += gerstner(p, vec2(-0.15,-1.0 ), 0.11, 2.3, 1.45, uTime);
           disp += gerstner(p, vec2( 0.6,  0.8 ), 0.07, 1.3, 1.7, uTime);
           transformed.x += disp.x * uAmp;
           transformed.z += disp.z * uAmp;
           transformed.y += disp.y * uAmp;

           // Recompute the normal from neighbouring samples so lighting and
           // reflections follow the displaced surface.
           float e = 0.4;
           vec3 dx = vec3(e, 0.0, 0.0);
           vec3 dz = vec3(0.0, 0.0, e);
           vec3 hx = gerstner(p + vec2(e, 0.0), vec2(1.0, 0.22), 0.26, 13.7, 0.9, uTime)
                   + gerstner(p + vec2(e, 0.0), vec2(-0.42, 1.0), 0.20, 7.3, 1.1, uTime);
           vec3 hz = gerstner(p + vec2(0.0, e), vec2(1.0, 0.22), 0.26, 13.7, 0.9, uTime)
                   + gerstner(p + vec2(0.0, e), vec2(-0.42, 1.0), 0.20, 7.3, 1.1, uTime);
           vec3 ta = normalize(vec3(e, (hx.y - disp.y) * uAmp, 0.0));
           vec3 tb = normalize(vec3(0.0, (hz.y - disp.y) * uAmp, e));
           objectNormal = normalize(cross(tb, ta));
           #ifdef USE_TANGENT
             vObjectNormal = objectNormal;
           #endif
           vNormal = normalize(normalMatrix * objectNormal);
           // Plane is rotated -90deg about X, so local xy maps to world xz.
           vSeaPos = vec2(transformed.x, -transformed.y);`,
        );

      // ── Fragment: Kelvin wake ────────────────────────────────────────────
      // A real hull leaves a V-shaped wake at a near-constant half-angle
      // (~19.5deg) regardless of speed, plus turbulent foam along the
      // centreline. Computing it here rather than as overlay geometry means
      // the foam follows the displaced surface instead of floating over it.
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           uniform float uSpeed;
           uniform float uFoam;
           uniform vec2 uHeading;
           uniform vec3 uHorizonColor;
           varying vec2 vSeaPos;

           float hash(vec2 p) {
             return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
           }

           float noise(vec2 p) {
             vec2 i = floor(p);
             vec2 f = fract(p);
             f = f * f * (3.0 - 2.0 * f);
             return mix(
               mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
               f.y);
           }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           {
             // Fine deterministic variation keeps the sea readable at bridge
             // distance even when the sun is outside the camera view.
             float surfaceNoise = noise(vSeaPos * 0.075 + vec2(uTime * 0.035, -uTime * 0.02));
             float swellBand = sin(vSeaPos.x * 0.055 + vSeaPos.y * 0.032 + uTime * 0.45) * 0.5 + 0.5;
             diffuseColor.rgb *= 0.72 + surfaceNoise * 0.22 + swellBand * 0.08;

             // Project into the hull frame: along-track and across-track.
             vec2 fwd = normalize(uHeading);
             vec2 side = vec2(-fwd.y, fwd.x);
             float astern = -dot(vSeaPos, fwd);   // distance behind the hull
             float lateral = abs(dot(vSeaPos, side));

             if (astern > 0.0 && uFoam > 0.001) {
               // Fade the whole wake out with distance astern.
               float life = exp(-astern * 0.016);

               // Kelvin arms: foam concentrated near the V envelope.
               float arm = lateral - astern * 0.3639;   // tan(19.99 deg)
               float arms = exp(-abs(arm) * 0.42);

               // Turbulent centreline churn directly behind the stern.
               float centre = exp(-lateral * 0.34) * exp(-astern * 0.045);

               // Break both up with drifting noise so they read as foam
               // rather than as painted geometry.
               vec2 np = vec2(vSeaPos.x * 0.6, (vSeaPos.y + uTime * 3.5) * 0.35);
               float churn = noise(np) * 0.6 + noise(np * 2.7) * 0.4;

               float foam = (arms * 0.55 + centre * 0.75) * life;
               foam *= 0.55 + churn * 0.75;
               foam = clamp(foam * uFoam, 0.0, 1.0);

               // Foam is bright, desaturated and slightly blue-white.
               diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.87, 0.93), foam);
             }

             // Fade the distant water into the atmospheric horizon. This
             // removes the hard plane/sky seam without a texture or cubemap.
             float horizonMix = smoothstep(420.0, 1320.0, length(vSeaPos));
             diffuseColor.rgb = mix(diffuseColor.rgb, uHorizonColor, horizonMix * 0.86);
           }`,
        );
    };

    return m;
  }, []);

  useFrame((_, delta) => {
    uniforms.current.uTime.value += delta;
    uniforms.current.uSpeed.value = speed;
    // Scene convention: the hull is rotated by -heading about Y, so its bow
    // direction in sea-plane coords is (sin, cos) of that same angle.
    const rad = THREE.MathUtils.degToRad(-heading);
    uniforms.current.uHeading.value.set(Math.sin(rad), Math.cos(rad));
    // Foam builds with speed and with a rougher sea; a stopped vessel leaves
    // no wake at all.
    const foamTarget = 0;
    uniforms.current.uFoam.value +=
      (foamTarget - uniforms.current.uFoam.value) * 0.05;
    // Amplitude follows the real sea state from the simulation.
    const target = 0.22 + waveHeight * 0.30;
    // Frame-rate independent damping: the same visual settling time whether
    // the scene runs at 30 or 144 fps.
    const damping = 1 - Math.exp(-delta * 2.4);
    uniforms.current.uAmp.value +=
      (target - uniforms.current.uAmp.value) * damping;

    {
      const mat = material;
      // Water darkens and dulls under storm cloud.
      mat.color.lerp(storminess > 0.5 ? STORM_WATER : CALM_WATER, damping);
      uniforms.current.uHorizonColor.value.lerp(
        storminess > 0.5 ? STORM_HORIZON : CALM_HORIZON,
        damping,
      );
      // Assigning roughness every frame is safe (it is a uniform, not a
      // shader define) but only write it when it actually moves.
      const nextRough = THREE.MathUtils.lerp(0.30, 0.58, storminess);
      if (Math.abs(mat.roughness - nextRough) > 0.001) {
        mat.roughness = nextRough;
      }
    }
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    />
  );
}
