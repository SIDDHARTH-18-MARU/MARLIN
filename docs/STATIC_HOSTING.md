# Static release and hosting

The production client has no API, server-side simulation, database, identity provider or credentials. Hash routing keeps deep links on the single index document. Session data is held in memory and cleared on reload. An exported JSON file belongs to the operator.

| Target | Build | Artifact and routes |
| --- | --- | --- |
| Local/root HTTPS host, including Render Static Sites | npm ci --ignore-scripts; npm run build | Publish only dist/. A bookmark is /#/plan. |
| GitHub Pages project site named MARLIN | npm ci --ignore-scripts; npm run build -- --base=/MARLIN/ | Upload only dist/ as the Pages build artifact. A bookmark is /MARLIN/#/plan. Use the actual repository slug and case. |

Build with Node 22.23.4. Keep site root and build base aligned: modules, favicon, the copied Cesium worker/asset tree and generated GLBs must resolve from the same origin. Do not use a dev or preview server for hosting or use a fallback HTML response for missing JS, WASM or GLB files. Deploy the complete build together and keep the previous known artifact available for rollback.

For a host that permits custom headers, use HTTPS and nosniff. Revalidate index.html and the stable worker, tile and hull URLs; immutable caching is appropriate only for hashed JS/CSS. Test a prospective CSP against workers, data URLs and 3D assets on the actual host before enabling it. The local fixture's headers and caching are test evidence for the file layout, not guarantees about a provider.

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) supports a project subpath and can publish an artifact from Actions; check repo visibility and account limits before choosing it. [Render Static Sites](https://render.com/docs/static-sites) supports a root site, CDN and configurable headers; confirm account build and bandwidth limits and whether overages could incur charges before approval. Neither service is required for local use.

## GitHub Pages

The [Pages workflow](../.github/workflows/pages.yml) validates pushes and pull requests to main without uploading a Pages artifact or deploying. It checks the reviewed Git inventory, source and artifact secrets, dependency advisories, lint, types, Vitest, both static builds and browser QA. Every Pages publication starts with a new, manually dispatched run from main. GitHub's workflow token and deployment OIDC are sufficient; no personal token is used in CI.

1. Review contributor, challenge and asset rights for any change to the approved release. Preserve the original-code MIT license and third-party notices. For an inventory change, update scripts/release-source.txt, then re-seal and rescan the exact source. Keep archives, personal/submission materials, private manifests/evidence, installs and generated output out of Git.
2. After separate source publication approval, publish the reviewed main of a repository named MARLIN. Run the verification workflow with its publish input off. Review a hosted runner pass before enabling Pages.
3. After separate hosting approval, in Settings → Pages select **GitHub Actions** as the source. Restrict the github-pages environment to the main branch and use a deployment reviewer if available on the selected plan. Confirm the expected account, site visibility and cost. Set the repository Actions variable MARLIN_PAGES_ENABLED to the literal value true. GitHub should not be configured to serve a branch or repository root.
4. From Actions choose **Validate MARLIN and deploy Pages**, select main and explicitly enable publish. The job verifies main, repository name, opt-in variable and a tracked, non-empty LICENSE before it uploads dist. The deploy job needs that job to succeed and has only pages: write and id-token: write. Those gates supplement the recorded legal approval; they do not prove it.
5. Verify the resulting HTTPS URL on an incognito desktop session and a physical phone before sharing. Check direct `/MARLIN/#/plan` and reload, all same-origin resources including worker, imagery and hull requests, the two decision paths, accessibility and JSON export. Confirm no private path or unexpected file is served. Pages handles live headers and caching; the local test server does not simulate its CDN.

Rollback: remove the opt-in variable to halt future dispatches; this alone does not take the site offline. If the current site must be withdrawn, disable Pages in Settings. For a content rollback, prepare a reviewed revert to the last known-good source, run all checks in a new workflow run, and manually deploy that exact new main SHA. Keep the previous release SHA and privately retain the verified artifact for comparison. Avoid force pushes or a manual file upload that bypasses verification.

## Repository About

- **Description:** Browser-based maritime voyage simulator for comparing modeled fuel, time and risk, with operator-led rerouting and replay. Built by Team Topaz.
- **Topics:** maritime, simulation, route-planning, cesiumjs, react, typescript, vite, data-visualization.
- **Website:** Leave blank until the actual Pages endpoint is verified. The expected project URL format is `https://<owner>.github.io/MARLIN/`.
