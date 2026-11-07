/**
 * Capability probe. Cached, because it allocates a real WebGL context to test
 * with — calling it per render would exhaust the browser's context budget on
 * its own.
 */
let webglSupport: boolean | undefined;

export function webglAvailable(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  webglSupport = probeWebgl();
  return webglSupport;
}

function probeWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!ctx) return false;
    // Release the probe context immediately. Browsers allow only ~16 live
    // WebGL contexts and evict the oldest when that ceiling is hit — which
    // kills the real scene's context and blanks the canvas to black. A probe
    // must never hold one open.
    ctx.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
