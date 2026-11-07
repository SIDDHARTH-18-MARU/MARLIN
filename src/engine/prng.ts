// Deterministic seeded PRNG + noise helpers.
// MARLIN never uses Math.random() for anything that affects a metric the
// operator sees — every "random-looking" field (storm shape, wave texture,
// route perturbation) is a pure function of its inputs so the demo replays
// identically every time.

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seedStr: string): () => number {
  return mulberry32(hashString(seedStr));
}

/** Smooth pseudo-noise built from a small sum of sine waves — deterministic, continuous, cheap. */
export function smoothField(x: number, y: number, t: number, seed: number): number {
  const s = seed % 1000;
  let v = 0;
  v += Math.sin(x * 0.9 + s * 0.31 + t * 0.11) * 0.5;
  v += Math.sin(y * 1.3 - s * 0.17 + t * 0.07) * 0.3;
  v += Math.sin((x + y) * 0.5 + s * 0.53 - t * 0.05) * 0.2;
  return v; // roughly in [-1, 1]
}
