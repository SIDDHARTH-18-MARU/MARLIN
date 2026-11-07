/**
 * Coastline, port and maritime infrastructure — Document 16.
 *
 * The destination has to be somewhere the captain can *see* arriving, not an
 * abstract waypoint. This renders the approach: land mass, harbour structures,
 * channel buoys and a lighthouse, all placed relative to own vessel so they
 * grow from the horizon as the transit progresses.
 *
 * Per Document 16, infrastructure is deliberately simplified geometry — the
 * rendering budget belongs to the hero vessel near the camera, not to distant
 * scenery.
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { Route } from "@/features/captain/bridgeTypes";

/** Nautical miles between two lat/long points. */
function distanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3440.065; // Earth radius in NM
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** A low-poly headland. Irregular outline so it doesn't read as a box. */
function Landmass({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    // Hand-tuned outline: a bay flanked by two promontories.
    s.moveTo(-260, -140);
    s.lineTo(-190, -18);
    s.lineTo(-120, 6);
    s.lineTo(-64, -12);
    s.lineTo(-30, 20);
    s.lineTo(26, 24);
    s.lineTo(74, -6);
    s.lineTo(132, 12);
    s.lineTo(196, -20);
    s.lineTo(268, -128);
    s.lineTo(268, -300);
    s.lineTo(-260, -300);
    s.closePath();
    return s;
  }, []);

  const geom = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, {
        depth: 9,
        bevelEnabled: true,
        bevelSize: 3.5,
        bevelThickness: 2.2,
        bevelSegments: 2,
      }),
    [shape],
  );

  return (
    <group position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <mesh geometry={geom} receiveShadow castShadow>
        <meshStandardMaterial color="#4a5b46" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

/** Harbour: breakwater arms, quay, cranes, and a cluster of buildings. */
function Port({ position }: { position: [number, number, number] }) {
  const buildings = useMemo(
    () =>
      // Deterministic layout — no random placement (master prompt MOCK DATA).
      [
        [-26, 7, 12, 9, 14],
        [-10, 10, 16, 7, 10],
        [8, 8, 11, 12, 16],
        [26, 12, 14, 8, 11],
        [44, 6, 9, 10, 13],
      ] as const,
    [],
  );

  return (
    <group position={position}>
      {/* Breakwater arms enclosing the harbour basin */}
      <mesh position={[-58, 1.4, 26]} rotation={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[76, 3, 7]} />
        <meshStandardMaterial color="#6b6f70" roughness={0.95} />
      </mesh>
      <mesh position={[58, 1.4, 26]} rotation={[0, -0.42, 0]} castShadow>
        <boxGeometry args={[76, 3, 7]} />
        <meshStandardMaterial color="#6b6f70" roughness={0.95} />
      </mesh>

      {/* Quay */}
      <mesh position={[0, 1.6, -12]} castShadow receiveShadow>
        <boxGeometry args={[128, 3.4, 34]} />
        <meshStandardMaterial color="#7d817f" roughness={0.92} />
      </mesh>

      {/* Terminal buildings */}
      {buildings.map(([x, h, w, d, z], i) => (
        <mesh key={i} position={[x, 3.3 + h / 2, -22 - z * 0.4]} castShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={i % 2 ? "#95a0a6" : "#aab3b8"}
            roughness={0.85}
          />
        </mesh>
      ))}

      {/* Container cranes — the silhouette that reads instantly as "port" */}
      {[-34, -6, 22].map((x, i) => (
        <group key={i} position={[x, 3.3, -6]}>
          <mesh position={[-5, 11, 0]} castShadow>
            <boxGeometry args={[1.4, 22, 1.4]} />
            <meshStandardMaterial color="#c8862f" roughness={0.7} />
          </mesh>
          <mesh position={[5, 11, 0]} castShadow>
            <boxGeometry args={[1.4, 22, 1.4]} />
            <meshStandardMaterial color="#c8862f" roughness={0.7} />
          </mesh>
          <mesh position={[0, 22, 6]} castShadow>
            <boxGeometry args={[13, 1.6, 26]} />
            <meshStandardMaterial color="#d99a3f" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Silos */}
      {[62, 72, 82].map((x, i) => (
        <mesh key={i} position={[x, 3.3 + 7, -26]} castShadow>
          <cylinderGeometry args={[3.4, 3.4, 14, 10]} />
          <meshStandardMaterial color="#b9c0c4" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Channel marker buoy. Red to port, green to starboard (IALA A). */
function Buoy({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position} scale={0.55}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.7, 0.9, 2.4, 8]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <coneGeometry args={[0.5, 1.4, 8]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function Lighthouse({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[3.4, 4.6, 4, 10]} />
        <meshStandardMaterial color="#8d9296" roughness={0.9} />
      </mesh>
      <mesh position={[0, 12, 0]} castShadow>
        <cylinderGeometry args={[2, 2.9, 16, 12]} />
        <meshStandardMaterial color="#e8e2d8" roughness={0.75} />
      </mesh>
      <mesh position={[0, 17.5, 0]}>
        <cylinderGeometry args={[2.3, 2.3, 3, 12]} />
        <meshStandardMaterial color="#3f4448" roughness={0.6} />
      </mesh>
      {/* Lamp */}
      <mesh position={[0, 17.5, 0]}>
        <sphereGeometry args={[1.3, 10, 10]} />
        <meshBasicMaterial color="#ffd97a" />
      </mesh>
      <pointLight position={[0, 17.5, 0]} intensity={110} distance={130} color="#ffd97a" />
    </group>
  );
}

export interface LandfallProps {
  /** Own vessel's current position. */
  lat: number;
  lon: number;
  /** The destination waypoint (final point of the active route). */
  route: Route;
  /** Own vessel's heading in degrees — the camera looks along this axis. */
  heading: number;
}

/**
 * Renders the destination approach when the vessel is close enough for land to
 * be plausibly visible. Beyond that range nothing is drawn, which keeps the
 * open-sea passage empty and makes the landfall feel earned.
 */
export function Landfall({ lat, lon, route, heading }: LandfallProps) {
  const dest = route.waypoints[route.waypoints.length - 1];
  const dLat = dest.position.latitude;
  const dLon = dest.position.longitude;

  const rangeNm = distanceNm(lat, lon, dLat, dLon);

  // Land becomes visible from ~34 NM, roughly when high ground would break the
  // horizon. Before that, open sea.
  if (rangeNm > 34) return null;

  // The raw projection puts land thousands of units away — far outside the
  // camera's useful range and the fog. Instead, keep the true *bearing* to the
  // destination but compress the *distance* onto a visible band, so land
  // appears on the horizon at 34 NM and closes steadily to alongside at 0.
  // Place the harbour along the vessel's own heading rather than the raw
  // bearing to the waypoint. The chase camera looks down the heading axis, so
  // this is what keeps landfall dead ahead and in frame as the vessel closes.
  // Must match ChaseCamera's convention exactly: the camera sits behind the
  // ship at (-sin, -cos) of rad, so dead ahead is (+sin, +cos) of the same rad.
  const rad = THREE.MathUtils.degToRad(-heading);
  const VISIBLE_FAR = 560; // scene units at first sight
  const VISIBLE_NEAR = 105; // scene units when alongside
  const visualRange =
    VISIBLE_NEAR + (rangeNm / 34) * (VISIBLE_FAR - VISIBLE_NEAR);
  const x = Math.sin(rad) * visualRange;
  const z = Math.cos(rad) * visualRange;

  // Approach channel buoys, stepping back from the harbour toward the vessel
  // along the same inbound axis.
  const bx = Math.sin(rad);
  const bz = Math.cos(rad);

  return (
    <group>
      {/* Land sits beyond the port along the same axis, so the harbour reads
          as carved into the coast rather than floating in front of it. */}
      <Landmass
        position={[x + bx * 150, -1.5, z + bz * 150]}
        rotation={-rad}
      />
      <Port position={[x, 0, z]} />
      {/* Lighthouse on the headland, offset abeam of the harbour mouth. */}
      <Lighthouse position={[x - bz * 78, 0, z + bx * 78]} />

      {/* Channel markers stepping out from the harbour mouth */}
      {[1, 2, 3, 4].map((i) => {
        const d = i * 34;
        const ox = x - bx * d;
        const oz = z - bz * d;
        // Offset perpendicular to the inbound track for the port/starboard pair
        const px = -bz * 11;
        const pz = bx * 11;
        return (
          <group key={i}>
            <Buoy position={[ox + px, 0, oz + pz]} color="#2f9e4f" />
            <Buoy position={[ox - px, 0, oz - pz]} color="#c0392b" />
          </group>
        );
      })}
    </group>
  );
}

