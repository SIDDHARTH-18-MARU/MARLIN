/**
 * The captain's 3D navigation view — Document 17.
 *
 * A tactical, ship-centric scene rather than a globe: own vessel, its route
 * ahead, nearby traffic, and the sea state. Built on React Three Fiber
 * (Document 03 sanctions R3F for self-contained non-geospatial scenes, which
 * is exactly what a bridge view is).
 *
 * Performance follows Document 25: one detailed own-ship, traffic drawn as
 * cheap low-poly hulls, no per-frame allocation, and no attempt at
 * photorealism away from the camera focus.
 */

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Route, TrafficContact } from "@/features/captain/bridgeTypes";
import { positionAlongRoute } from "@/features/captain/bridgeScenario";
import { Landfall } from "./Landfall";
import { Atmosphere } from "./Atmosphere";
import { Ocean } from "./Ocean";
import { OwnVessel } from "./Vessel";

/** Metres-per-degree scaling, flattened to a local tangent plane. */
const SCALE = 900;

function project(
  lat: number,
  lon: number,
  originLat: number,
  originLon: number,
): [number, number] {
  const x = (lon - originLon) * SCALE * Math.cos((originLat * Math.PI) / 180);
  const z = -(lat - originLat) * SCALE;
  return [x, z];
}

/** Background traffic — deliberately cheap geometry (Document 14). */

// Materials are created ONCE at module scope and shared by every contact.
// Declaring <meshStandardMaterial> inline creates a new material per contact
// per render; when a contact crosses the CPA threshold its colour flips, and
// each flip is a fresh shader compile — which is visible as a stutter during
// playback.
const HULL_FAR = new THREE.MeshStandardMaterial({
  color: "#7d8fa3",
  roughness: 0.8,
});
const HULL_NEAR = new THREE.MeshStandardMaterial({
  color: "#c96a6a",
  roughness: 0.8,
});
const DECK_FAR = new THREE.MeshStandardMaterial({
  color: "#95a7ba",
  roughness: 0.8,
});
const DECK_NEAR = new THREE.MeshStandardMaterial({
  color: "#dd8080",
  roughness: 0.8,
});

// Geometry is shared too — four boxes for the whole fleet rather than two per
// contact (Document 25: instancing/reuse over per-object allocation).
const WP_GEO = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12);
const WP_MATS = new Map<string, THREE.MeshBasicMaterial>();
function wpMaterial(color: string, dimmed: boolean) {
  const key = `${color}-${dimmed}`;
  let m = WP_MATS.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: dimmed ? 0.25 : 0.75,
    });
    WP_MATS.set(key, m);
  }
  return m;
}

const HULL_GEO = new THREE.BoxGeometry(0.9, 0.5, 3.2);
const DECK_GEO = new THREE.BoxGeometry(0.6, 0.5, 1);

function TrafficVessels({
  contacts,
  originLat,
  originLon,
}: {
  contacts: TrafficContact[];
  originLat: number;
  originLon: number;
}) {
  return (
    <>
      {contacts.map((c) => {
        const [x, z] = project(
          c.position.latitude,
          c.position.longitude,
          originLat,
          originLon,
        );
        const close = c.cpaNm < 1.5;
        return (
          <group
            key={c.id}
            position={[x, 0, z]}
            rotation={[0, THREE.MathUtils.degToRad(-c.heading), 0]}
          >
            <mesh
              position={[0, 0.2, 0]}
              geometry={HULL_GEO}
              material={close ? HULL_NEAR : HULL_FAR}
            />
            <mesh
              position={[0, 0.75, -0.3]}
              geometry={DECK_GEO}
              material={close ? DECK_NEAR : DECK_FAR}
            />
          </group>
        );
      })}
    </>
  );
}

/** The assigned route drawn ahead of the vessel. */
function RouteLine({
  route,
  originLat,
  originLon,
  color,
  dimmed,
}: {
  route: Route;
  originLat: number;
  originLon: number;
  color: string;
  dimmed?: boolean;
}) {
  const points = useMemo(() => {
    return route.waypoints.map((w) => {
      const [x, z] = project(
        w.position.latitude,
        w.position.longitude,
        originLat,
        originLon,
      );
      return new THREE.Vector3(x, 0.12, z);
    });
  }, [route, originLat, originLon]);

  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points],
  );

  // Building the Line and its material inline means a new material — and so a
  // fresh shader compile — on every render. Memoise both.
  const line = useMemo(
    () =>
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: dimmed ? 0.25 : 0.9,
        }),
      ),
    [geometry, color, dimmed],
  );

  return (
    <>
      <primitive object={line} />
      {points.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, 0.15, p.z]}
          geometry={WP_GEO}
          material={wpMaterial(color, Boolean(dimmed))}
        />
      ))}
    </>
  );
}

/** Chase camera locked behind the vessel. */
function ChaseCamera({ heading }: { heading: number }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  // Hoisted so the frame loop never allocates.
  const targetGoal = useRef(new THREE.Vector3(0, 1.7, 0));
  const desired = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const rad = THREE.MathUtils.degToRad(-heading);
    const dist = 42;
    // Offset slightly off the centreline so the hull reads in three-quarter
    // view rather than as a flat stern-on silhouette.
    desired.current.set(
      -Math.sin(rad) * dist + Math.cos(rad) * 10,
      12.5,
      -Math.cos(rad) * dist - Math.sin(rad) * 10,
    );
    // Frame-rate independent damping, so the chase settles at the same rate
    // regardless of refresh rate.
    const positionDamping = 1 - Math.exp(-delta * 4.2);
    const targetDamping = 1 - Math.exp(-delta * 7.5);
    camera.position.lerp(desired.current, positionDamping);
    target.current.lerp(targetGoal.current, targetDamping);
    camera.lookAt(target.current);
  });

  return null;
}

export interface BridgeSceneProps {
  activeRoute: Route;
  alternateRoute?: Route;
  minute: number;
  heading: number;
  traffic: TrafficContact[];
  waveHeight: number;
  stormActive: boolean;
  /** 0 = clear, 1 = full storm. */
  storminess: number;
  cloudCoverPct: number;
  speed: number;
  /** Highlight the alternate route while a reroute is under review. */
  alternateFocused?: boolean;
}

export function BridgeScene({
  activeRoute,
  alternateRoute,
  minute,
  heading,
  traffic,
  waveHeight,
  stormActive,
  storminess,
  cloudCoverPct,
  speed,
  alternateFocused = false,
}: BridgeSceneProps) {
  // Everything is positioned relative to own vessel, which sits at the origin.
  const pos = positionAlongRoute(activeRoute, minute);

  // Context-loss listeners are attached to the canvas in onCreated, which has
  // no teardown hook of its own. Holding the remover here lets the component
  // detach them on unmount instead of leaking one pair per mount — the bridge
  // is mounted and unmounted every time the captain leaves and returns.
  const contextCleanupRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      contextCleanupRef.current?.();
      contextCleanupRef.current = null;
    },
    [],
  );

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 12.5, -42], fov: 56, near: 0.1, far: 60000 }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        // ACES filmic (R3F's default) rolls bright values toward white, and
        // the sky dome outputs high-intensity colour. At exposure 1.0 the
        // whole dome desaturates to a flat white field. Pulling exposure down
        // keeps the sky's blue instead of clipping it.
        toneMappingExposure: 0.55,
      }}
      shadows={false}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;

        // If the browser evicts this context (too many live contexts, GPU
        // reset, tab backgrounded), prevent the default so the canvas is
        // eligible for restoration instead of staying black forever.
        const onLost = (e: Event) => {
          e.preventDefault();
        };
        const onRestored = () => {
          gl.setSize(canvas.clientWidth, canvas.clientHeight);
        };
        canvas.addEventListener("webglcontextlost", onLost, false);
        canvas.addEventListener("webglcontextrestored", onRestored, false);
        contextCleanupRef.current = () => {
          canvas.removeEventListener("webglcontextlost", onLost, false);
          canvas.removeEventListener("webglcontextrestored", onRestored, false);
        };
      }}
    >
      {/* Fog tinted to the horizon so distant land dissolves into haze
          rather than clipping at the far plane. */}
      <fog attach="fog" args={[stormActive ? "#768593" : "#a9c8dc", 120, 1450]} />

      <Atmosphere
        storminess={storminess}
        cloudCoverPct={cloudCoverPct}
        heading={heading}
      />

      <Ocean
        waveHeight={waveHeight}
        storminess={storminess}
        speed={speed}
        heading={heading}
      />

      <OwnVessel heading={heading} />
      <ChaseCamera heading={heading} />

      <TrafficVessels
        contacts={traffic}
        originLat={pos.latitude}
        originLon={pos.longitude}
      />

      {/* Destination approach — appears as the vessel closes the coast */}
      <Landfall
        lat={pos.latitude}
        lon={pos.longitude}
        route={activeRoute}
        heading={heading}
      />

      {alternateRoute && (
        <RouteLine
          route={alternateRoute}
          originLat={pos.latitude}
          originLon={pos.longitude}
          color={alternateFocused ? "#fbbf24" : "#8aa4c4"}
          dimmed={!alternateFocused}
        />
      )}
      <RouteLine
        route={activeRoute}
        originLat={pos.latitude}
        originLon={pos.longitude}
        color="#4da3ff"
      />
    </Canvas>
  );
}
