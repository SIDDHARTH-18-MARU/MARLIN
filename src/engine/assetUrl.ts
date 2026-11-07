/**
 * Single helper for building URLs to files served out of `public/`.
 *
 * Vite rewrites bare `/foo.glb` references only inside HTML/CSS and in module
 * imports — never in plain strings held in TypeScript data tables. Those stay
 * literal, so a build deployed under a subdirectory (`base: '/marlin/'`)
 * requests `/models/x.glb` instead of `/marlin/models/x.glb` and 404s.
 *
 * Routing every public-asset reference through here keeps the app working both
 * at the domain root and under a sub-path. `import.meta.env.BASE_URL` is
 * injected by Vite at build time and always ends with a slash.
 */

/**
 * Resolve a path relative to the app's base URL.
 *
 * Accepts either form — `assetUrl('models/x.glb')` and `assetUrl('/models/x.glb')`
 * are equivalent — so existing leading-slash call sites can be migrated without
 * rewriting each string.
 */
export function assetUrl(pathFromPublicRoot: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = pathFromPublicRoot.replace(/^\/+/, '');
  return `${cleanBase}${cleanPath}`;
}
