/**
 * Sky, sun and image-based lighting — the realism layer.
 *
 * Uses drei's Sky (Preetham atmospheric scattering) so the sea and hull are lit
 * by a physically-plausible sky rather than bare directional lights.
 *
 * Two choices matter here and were arrived at by fixing what looked wrong:
 *
 *  • The sun sits high and slightly ahead of the vessel, not low behind it. A
 *    low sun renders the anti-solar sky as a flat white band with no gradient,
 *    and pushes a warm cast onto the water until it reads as sand.
 *  • Lighting is near-neutral in colour. Warm "golden hour" light tints a
 *    low-roughness sea pink, which destroys the read of water more than any
 *    amount of geometry detail can rescue.
 *
 * Conditions track the simulation, so the storm visibly rolls in — Document 13's
 * time-linked environmental layers.
 */

import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

export interface AtmosphereProps {
  /** 0 = clear, 1 = full storm. Drives haze, sun elevation and cloud cover. */
  storminess: number;
  cloudCoverPct: number;
  /** Vessel heading in degrees — the sun is anchored relative to it. */
  heading: number;
}

/**
 * Sun direction shared by the sky dome and the shadow-casting light.
 *
 * The sun is placed *relative to the vessel's heading* rather than fixed in
 * world space. The chase camera looks along the heading, so a world-fixed sun
 * drifts arbitrarily as the ship turns — sometimes directly behind the camera,
 * which renders the anti-solar sky as a flat white field with no gradient.
 * Anchoring it off the port bow keeps the blue part of the dome in frame and
 * the glitter path on the water, through every course change.
 */
function sunVector(storminess: number, heading: number): THREE.Vector3 {
  // Elevation ~38° clear, dropping under storm cloud. Below the zenith so the
  // sky shows a real gradient rather than uniform brightness overhead.
  const elevationDeg = THREE.MathUtils.lerp(38, 24, storminess);
  // 55° off the bow, to port.
  const azimuthDeg = heading - 55;

  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  // Scene convention: bow direction is (sin, cos) of -heading.
  const theta = THREE.MathUtils.degToRad(-azimuthDeg);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

/**
 * Fixed cloudscape layout — deterministic, no Math.random (master prompt).
 * Two decks: a broad low deck that reads as weather, and a sparser high deck
 * that gives the sky depth.
 */
const CLOUD_LAYOUT = Array.from({ length: 12 }, (_, i) => {
  const low = i < 8;
  const n = low ? 8 : 4;
  const k = low ? i : i - 8;
  // Golden-angle spiral spreads them without visible rows.
  const angle = k * 2.39996 + (low ? 0 : 1.1);
  const radius = (low ? 165 : 360) + ((k * 97) % (low ? 190 : 260));
  return {
    x: Math.cos(angle) * radius,
    y: low ? 68 + ((k * 31) % 42) : 180 + ((k * 43) % 75),
    z: Math.sin(angle) * radius,
    spread: low ? 78 + ((k * 37) % 52) : 150 + ((k * 53) % 80),
    height: low ? 24 : 34,
    volume: low ? 52 + ((k * 29) % 28) : 86 + ((k * 41) % 42),
    segments: low ? 12 : 9,
    _n: n,
  };
});

const CLOUD_PUFF_GEOMETRY = new THREE.IcosahedronGeometry(1, 2);
const CLOUD_PUFFS = [
  { x: -0.42, y: -0.02, z: 0.04, scale: 0.64 },
  { x: -0.18, y: 0.12, z: -0.05, scale: 0.82 },
  { x: 0.08, y: 0.2, z: 0.02, scale: 1 },
  { x: 0.34, y: 0.08, z: -0.04, scale: 0.76 },
  { x: 0.5, y: -0.05, z: 0.06, scale: 0.56 },
] as const;

const FORWARD_CLOUD_ANCHORS = [
  [-92, 58, 235],
  [108, 78, 345],
  [-18, 118, 480],
] as const;

const HAZE_VERTEX_SHADER = `
  varying float vHazeHeight;
  void main() {
    vHazeHeight = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HAZE_FRAGMENT_SHADER = `
  uniform vec3 uHazeColor;
  varying float vHazeHeight;
  void main() {
    float rise = smoothstep(0.02, 0.20, vHazeHeight);
    float fall = 1.0 - smoothstep(0.28, 0.92, vHazeHeight);
    gl_FragColor = vec4(uHazeColor, rise * fall * 0.34);
  }
`;

export function Atmosphere({
  storminess,
  cloudCoverPct,
  heading,
}: AtmosphereProps) {
  // Heading and storminess are continuous and change every frame while the
  // simulation plays. Feeding those straight into <Sky> and <Clouds> makes
  // them rebuild their shaders and volumes ~60x/second, which reads on screen
  // as flicker. Quantising means new props arrive only when the value has
  // actually moved enough to be visible.
  const qHeading = Math.round(heading / 8) * 8;
  const qStorm = Math.round(storminess * 12) / 12;

  const sun = useMemo(
    () => sunVector(qStorm, qHeading),
    [qStorm, qHeading],
  );
  const sunPosition = useMemo<[number, number, number]>(
    () => [sun.x * 1000, sun.y * 1000, sun.z * 1000],
    [sun],
  );

  // A FIXED set of clouds, always mounted. Varying the count remounts every
  // <Cloud> whenever cover changes, which is the main source of flicker during
  // playback. Cover is expressed as opacity instead, so clouds fade in and out
  // rather than popping into existence.
  const cover = THREE.MathUtils.clamp(cloudCoverPct / 100, 0, 1);

  const hazeUniforms = useMemo(
    () => ({ uHazeColor: { value: new THREE.Color("#a9c8dc") } }),
    [],
  );
  hazeUniforms.uHazeColor.value.set(qStorm > 0.5 ? "#768593" : "#a9c8dc");

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={sunPosition}
        // Turbidity drives haze. Clear tropical air is low; storm air is thick.
        turbidity={THREE.MathUtils.lerp(1.6, 13, qStorm)}
        // Rayleigh drives how blue the sky reads. Keep it high when clear —
        // this is what stops the dome washing out to white.
        rayleigh={THREE.MathUtils.lerp(3.2, 0.6, qStorm)}
        mieCoefficient={THREE.MathUtils.lerp(0.004, 0.022, qStorm)}
        mieDirectionalG={THREE.MathUtils.lerp(0.79, 0.93, qStorm)}
      />

      {/* A very light cylindrical haze veil makes the sea/sky junction read
          as atmospheric depth rather than the edge of a rendered plane. */}
      <mesh position={[0, 70, 0]} renderOrder={-1}>
        <cylinderGeometry args={[1250, 1250, 180, 96, 1, true]} />
        <shaderMaterial
          uniforms={hazeUniforms}
          vertexShader={HAZE_VERTEX_SHADER}
          fragmentShader={HAZE_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Sun. Near-neutral colour: a warm sun turns the sea pink. */}
      <directionalLight
        position={sunPosition}
        intensity={THREE.MathUtils.lerp(6.5, 2.2, storminess)}
        color={storminess > 0.5 ? "#c4ccd6" : "#fffaf0"}
        castShadow={false}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={300}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0005}
      />

      {/* Sky fill, so shadowed sides of the hull are blue-grey, not black. */}
      <hemisphereLight
        args={[
          storminess > 0.5 ? "#9aa7b6" : "#a8ccf0",
          storminess > 0.5 ? "#2a3844" : "#123048",
          THREE.MathUtils.lerp(3.2, 2.2, storminess),
        ]}
      />

      {/* Small ambient floor so nothing crushes to pure black. */}
      <ambientLight intensity={THREE.MathUtils.lerp(0.6, 1.0, storminess)} />

      <group>
        {CLOUD_LAYOUT.map((c, i) => {
          // Each cloud has its own threshold, so higher cover brings
          // progressively more of them in rather than all at once.
          const threshold = i / CLOUD_LAYOUT.length;
          const local = THREE.MathUtils.clamp((cover - threshold) * 2.6, 0, 1);
          const opacity = local * THREE.MathUtils.lerp(0.68, 0.95, qStorm);

          if (opacity <= 0.01) return null;
          const color = qStorm > 0.5 ? "#737d88" : "#f4f8fb";
          const anchor = FORWARD_CLOUD_ANCHORS[i];
          const headingRad = THREE.MathUtils.degToRad(-qHeading);
          const position: [number, number, number] = anchor
            ? [
                anchor[0] * Math.cos(headingRad) + anchor[2] * Math.sin(headingRad),
                anchor[1],
                -anchor[0] * Math.sin(headingRad) + anchor[2] * Math.cos(headingRad),
              ]
            : [c.x, c.y, c.z];
          return (
            <group key={i} position={position} rotation={[0, i * 0.47, 0]}>
              {CLOUD_PUFFS.map((puff, puffIndex) => (
                <mesh
                  key={puffIndex}
                  geometry={CLOUD_PUFF_GEOMETRY}
                  position={[puff.x * c.spread, puff.y * c.height, puff.z * c.spread]}
                  scale={[c.spread * 0.34 * puff.scale, c.height * 0.72 * puff.scale, c.spread * 0.22 * puff.scale]}
                >
                  <meshLambertMaterial
                    color={color}
                    transparent
                    opacity={opacity * 0.72}
                    depthWrite={false}
                  />
                </mesh>
              ))}
            </group>
          );
        })}
      </group>

    </>
  );
}
