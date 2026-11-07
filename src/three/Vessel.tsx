/**
 * Own vessel rendering — GLB when one is registered, procedural otherwise.
 *
 * The swap is driven entirely by the asset registry (Documents 15, 29): drop a
 * validated CC0 model into public/models/, add its entry, and this component
 * picks it up with no further code change. Until then the procedural hull
 * renders, so the demo never depends on an asset being present.
 */

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVoyageStore } from "@/stores/voyageStore";
import { vesselModelFor } from "./vesselModels";

/** Procedural hull — the guaranteed fallback (master prompt FAILURE HANDLING). */
function ProceduralHull() {
  return (
    <>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.5, 0.7, 6]} />
        <meshStandardMaterial color="#9db4cc" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, 3.6]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.75, 1.6, 4]} />
        <meshStandardMaterial color="#9db4cc" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.95, -0.4]} castShadow>
        <boxGeometry args={[1.1, 0.8, 2]} />
        <meshStandardMaterial color="#b8c9db" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.55, -0.2]} castShadow>
        <boxGeometry args={[0.85, 0.45, 1.1]} />
        <meshStandardMaterial color="#dce6f0" metalness={0.25} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.3, -0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 6]} />
        <meshStandardMaterial color="#c3d3e4" />
      </mesh>
      <mesh position={[0, 2.95, -0.4]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshBasicMaterial color="#4da3ff" />
      </mesh>
    </>
  );
}

/**
 * Loads a registered GLB. Normalises it to a known length so that whatever
 * scale the artist authored in, the hull ends up the right size relative to
 * the sea and the port — the "scale/orientation validation" pipeline stage
 * from Document 15, enforced at runtime.
 */
function GlbHull({
  path,
  scale,
  orientationOffsetDeg,
}: {
  path: string;
  scale: number;
  orientationOffsetDeg: number;
}) {
  const { scene } = useGLTF(path, false);
  const ref = useRef<THREE.Group>(null);
  // Cloning inside render rebuilds the entire model graph — and its materials
  // — on every render, which forces repeated shader compiles during playback.
  const model = useMemo(() => scene.clone(), [scene]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = ref.current;

    // Reset before measuring so the effect is idempotent: it re-runs when the
    // model or its orientation changes, and must not compound the offsets it
    // applied last time.
    object.position.set(0, 0, 0);
    object.scale.setScalar(1);
    object.updateWorldMatrix(true, true);

    // Sketchfab hulls carry arbitrary authoring rotations on their root nodes —
    // the tanker's is 173 degrees about X, which renders it upside-down, and a
    // yaw-only offset cannot undo that. Rather than hand-tune each import,
    // derive the orientation from the geometry: measure the mesh in its own
    // local space, then rotate so its longest axis runs along +Z (the scene's
    // bow convention) and its shortest horizontal axis stays the beam.
    const local = new THREE.Box3();
    const v = new THREE.Vector3();
    model.updateWorldMatrix(true, true);
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      if (!bb) return;
      // Corners in the mesh's own local frame, ignoring node rotations.
      for (const x of [bb.min.x, bb.max.x])
        for (const y of [bb.min.y, bb.max.y])
          for (const z of [bb.min.z, bb.max.z]) local.expandByPoint(v.set(x, y, z));
    });

    const localSize = local.getSize(new THREE.Vector3());
    // Longest local axis is the hull's length; of the remaining two the larger
    // is its height (superstructure), the smaller its beam.
    const axes: Array<[number, 'x' | 'y' | 'z']> = [
      [localSize.x, 'x'],
      [localSize.y, 'y'],
      [localSize.z, 'z'],
    ];
    axes.sort((a, b) => b[0] - a[0]);
    const lengthAxis = axes[0][1];
    const heightAxis = axes[1][1];

    // Build a basis that maps the model's own length/height axes onto the
    // scene's +Z (bow) and +Y (up).
    const pick = (a: 'x' | 'y' | 'z') =>
      new THREE.Vector3(a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0);
    const forward = pick(lengthAxis);
    const up = pick(heightAxis);
    const right = new THREE.Vector3().crossVectors(up, forward);
    // Columns are the scene axes expressed in model space, so the inverse of
    // this basis rotates the model into the scene's frame.
    const basis = new THREE.Matrix4().makeBasis(right, up, forward).invert();
    model.quaternion.setFromRotationMatrix(basis);
    model.updateWorldMatrix(true, true);
    object.updateWorldMatrix(true, true);

    // Normalise: measure the model and rescale so its longest axis matches the
    // procedural hull's ~7 unit length. Box3.setFromObject measures in world
    // space, so the group's yaw is already folded into these bounds.
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (longest > 0) {
      // Keep the hero vessel prominent without letting a large source GLB fill
      // the entire bridge viewport. The procedural fallback is ~7 units long.
      const target = 10;
      object.scale.setScalar((target / longest) * scale);
    }
    object.updateWorldMatrix(true, true);

    // Re-measure after scaling, then seat the hull: keel on the waterline, and
    // centred over the origin in plan. Centring matters because an imported GLB
    // may carry its geometry far from its own origin (the cruise ship's is
    // ~24,000 units out); without this the hull scales correctly but sits
    // outside the camera's view entirely.
    const scaled = new THREE.Box3().setFromObject(object);
    const centre = scaled.getCenter(new THREE.Vector3());
    object.position.x -= centre.x;
    object.position.z -= centre.z;
    object.position.y -= scaled.min.y;

    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        // The source GLB contains large transformed sub-mesh bounds which can
        // produce kilometre-long shadow-map wedges on the sea. Direct and sky
        // lighting still give the hull its form without that artifact.
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });
  }, [model, scale, orientationOffsetDeg]);

  return (
    <group
      ref={ref}
      rotation={[0, THREE.MathUtils.degToRad(orientationOffsetDeg), 0]}
    >
      <primitive object={model} />
    </group>
  );
}

export function OwnVessel({ heading }: { heading: number }) {
  const group = useRef<THREE.Group>(null);
  // The model follows whichever vessel the voyage was planned with.
  const vesselType = useVoyageStore((s) => s.vessel.type);
  const asset = vesselModelFor(vesselType);

  useFrame((_, deltaSeconds) => {
    if (!group.current) return;
    // Smoothly rotate toward the commanded heading so a course change reads as
    // a turn rather than a snap — Document 10's visible payoff.
    const target = THREE.MathUtils.degToRad(-heading);
    const current = group.current.rotation.y;
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    // Frame-rate independent damping: the turn takes the same wall-clock time
    // whatever the refresh rate.
    const damping = 1 - Math.exp(-deltaSeconds * 4.2);
    group.current.rotation.y = current + delta * damping;
  });

  return (
    <group ref={group}>
      {asset ? (
        // Suspense fallback keeps the hull visible while the GLB streams in.
        <Suspense fallback={<ProceduralHull />}>
          <GlbHull
            path={asset.path}
            scale={asset.scale}
            orientationOffsetDeg={asset.orientationOffsetDeg}
          />
        </Suspense>
      ) : (
        <ProceduralHull />
      )}
    </group>
  );
}

