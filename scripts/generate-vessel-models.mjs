import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDirectory = join(process.cwd(), "public", "assets", "vessels");
mkdirSync(outputDirectory, { recursive: true });

const materials = [
  [0.08, 0.32, 0.42, 1],
  [0.82, 0.34, 0.12, 1],
  [0.72, 0.8, 0.82, 1],
  [0.18, 0.21, 0.24, 1],
  [0.88, 0.68, 0.16, 1],
  [0.15, 0.48, 0.42, 1]
];

const vesselDesigns = {
  "container-ship": [
    [-0.2, 0, 0.35, 9.5, 2.4, 0.7, 0],
    [-3.4, 0, 1.25, 1.5, 2.0, 1.2, 2],
    [-3.75, 0, 2.0, 0.65, 1.6, 0.45, 3],
    [-0.8, -0.55, 1.15, 1.1, 0.8, 0.72, 1],
    [-0.8, 0.55, 1.15, 1.1, 0.8, 0.72, 4],
    [0.45, -0.55, 1.15, 1.1, 0.8, 0.72, 4],
    [0.45, 0.55, 1.15, 1.1, 0.8, 0.72, 1],
    [1.7, -0.55, 1.15, 1.1, 0.8, 0.72, 1],
    [1.7, 0.55, 1.15, 1.1, 0.8, 0.72, 4]
  ],
  tanker: [
    [0, 0, 0.35, 10.2, 2.5, 0.7, 3],
    [-3.6, 0, 1.2, 1.7, 2.0, 1.1, 2],
    [-0.8, 0, 0.98, 1.35, 1.8, 0.42, 1],
    [0.85, 0, 0.98, 1.35, 1.8, 0.42, 1],
    [2.5, 0, 0.98, 1.35, 1.8, 0.42, 1],
    [0.8, 0, 1.45, 4.9, 0.18, 0.18, 4]
  ],
  "bulk-carrier": [
    [0, 0, 0.35, 9.8, 2.55, 0.72, 3],
    [-3.55, 0, 1.22, 1.55, 2.0, 1.2, 2],
    [-1.55, 0, 0.96, 1.45, 1.82, 0.32, 4],
    [0.2, 0, 0.96, 1.45, 1.82, 0.32, 4],
    [1.95, 0, 0.96, 1.45, 1.82, 0.32, 4]
  ],
  "passenger-vessel": [
    [0, 0, 0.4, 9.2, 2.6, 0.8, 0],
    [-0.6, 0, 1.25, 6.5, 2.15, 0.85, 2],
    [-1.05, 0, 2.05, 5.3, 1.9, 0.7, 2],
    [-1.45, 0, 2.68, 3.7, 1.55, 0.55, 2],
    [-2.2, 0, 3.18, 0.5, 0.7, 0.55, 1],
    [0.2, -0.98, 1.8, 4.0, 0.08, 0.12, 4],
    [0.2, 0.98, 1.8, 4.0, 0.08, 0.12, 4]
  ],
  "general-cargo": [
    [0, 0, 0.35, 8.8, 2.35, 0.7, 5],
    [-3.15, 0, 1.22, 1.5, 1.9, 1.15, 2],
    [-0.75, 0, 0.98, 2.0, 1.72, 0.32, 3],
    [1.65, 0, 0.98, 2.0, 1.72, 0.32, 3],
    [0.35, 0, 1.85, 0.18, 0.18, 1.8, 4],
    [1.08, 0, 2.45, 1.65, 0.16, 0.16, 4]
  ]
};

function addBox(target, [cx, cy, cz, sx, sy, sz, material]) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2;
  const y0 = cy - sy / 2, y1 = cy + sy / 2;
  const z0 = cz - sz / 2, z1 = cz + sz / 2;
  const faces = [
    [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],[1,0,0]],
    [[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[-1,0,0]],
    [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],[0,1,0]],
    [[x1,y0,z0],[x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[0,-1,0]],
    [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]],
    [[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],[x0,y0,z0],[0,0,-1]]
  ];
  const bucket = target[material] ??= { positions: [], normals: [], indices: [] };
  for (const face of faces) {
    const start = bucket.positions.length / 3;
    const normal = face[4];
    for (let i = 0; i < 4; i += 1) {
      bucket.positions.push(...face[i]);
      bucket.normals.push(...normal);
    }
    bucket.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
}

function align4(buffer, padByte = 0) {
  const remainder = buffer.length % 4;
  return remainder === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(4 - remainder, padByte)]);
}

function createGlb(parts) {
  const buckets = {};
  for (const part of parts) addBox(buckets, part);
  const bufferViews = [];
  const accessors = [];
  const primitives = [];
  const binaryParts = [];
  let byteOffset = 0;

  const pushBuffer = (typedArray, target) => {
    const raw = align4(Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength));
    const index = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: typedArray.byteLength, target });
    binaryParts.push(raw);
    byteOffset += raw.length;
    return index;
  };

  for (const [materialIndex, bucket] of Object.entries(buckets)) {
    const positions = new Float32Array(bucket.positions);
    const normals = new Float32Array(bucket.normals);
    const indices = new Uint16Array(bucket.indices);
    const positionView = pushBuffer(positions, 34962);
    const normalView = pushBuffer(normals, 34962);
    const indexView = pushBuffer(indices, 34963);
    const xs = bucket.positions.filter((_, i) => i % 3 === 0);
    const ys = bucket.positions.filter((_, i) => i % 3 === 1);
    const zs = bucket.positions.filter((_, i) => i % 3 === 2);
    const positionAccessor = accessors.length;
    accessors.push({ bufferView: positionView, componentType: 5126, count: positions.length / 3, type: "VEC3", min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)], max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)] });
    const normalAccessor = accessors.length;
    accessors.push({ bufferView: normalView, componentType: 5126, count: normals.length / 3, type: "VEC3" });
    const indexAccessor = accessors.length;
    accessors.push({ bufferView: indexView, componentType: 5123, count: indices.length, type: "SCALAR", min: [0], max: [positions.length / 3 - 1] });
    primitives.push({ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, indices: indexAccessor, material: Number(materialIndex) });
  }

  const binary = Buffer.concat(binaryParts);
  const gltf = {
    asset: { version: "2.0", generator: "MARLIN offline vessel generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives }],
    materials: materials.map((color, index) => ({
      name: `MARLIN material ${index + 1}`,
      pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0.12, roughnessFactor: 0.68 }
    })),
    buffers: [{ byteLength: binary.length }],
    bufferViews,
    accessors
  };
  const json = align4(Buffer.from(JSON.stringify(gltf), "utf8"), 0x20);
  const totalLength = 12 + 8 + json.length + 8 + binary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binaryHeader, binary]);
}

for (const [name, design] of Object.entries(vesselDesigns)) {
  writeFileSync(join(outputDirectory, `${name}.glb`), createGlb(design));
}

console.log(`Generated ${Object.keys(vesselDesigns).length} offline vessel models in ${outputDirectory}`);
