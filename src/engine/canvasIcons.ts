// Small canvas-drawn glyphs used as Cesium billboards. MARLIN does not ship
// licensed GLB/glTF hull models for this prototype (see README/Methodology
// > Future Work) — these vector glyphs stand in for the vessel and
// environment markers described in the frontend spec. The VesselEntity
// rendering path is isolated in CesiumGlobe.tsx specifically so a real
// per-type GLB model can be swapped in later without touching simulation
// logic.

const cache = new Map<string, string>();

function withCache(key: string, build: () => string): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const uri = build();
  cache.set(key, uri);
  return uri;
}

export function shipIconDataUri(color: string): string {
  return withCache(`ship:${color}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(24, 24);
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(11, 14);
    ctx.lineTo(0, 7);
    ctx.lineTo(-11, 14);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(5,8,13,0.9)';
    ctx.stroke();
    return canvas.toDataURL();
  });
}

export function arrowIconDataUri(color: string): string {
  return withCache(`arrow:${color}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(16, 16);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 11);
    ctx.lineTo(0, -9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(5, -4);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fill();
    return canvas.toDataURL();
  });
}

export function portIconDataUri(): string {
  return withCache('port', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(10, 10);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#dce6ee';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#33d6e0';
    ctx.stroke();
    return canvas.toDataURL();
  });
}
