# Browser QA

From the project root, with Node 22.23.4:

    npm ci --ignore-scripts
    npm ci --prefix qa --ignore-scripts
    npm run lint
    npm exec -- tsc -b
    npm test
    npm run build
    npm run build -- --base=/MARLIN/ --outDir=.private/phase2-pages

The smoke harness uses an installed Google Chrome via Playwright's chrome channel and Playwright's Firefox and WebKit. Install the latter from their reviewed locked toolchain: `node qa/node_modules/playwright/cli.js install firefox webkit`. Use `PLAYWRIGHT_BROWSERS_PATH` if the browser downloads should stay in a private local directory. Browser installation may require network access and OS libraries. The test server listens only on loopback. Each browser context blocks external page requests.

    node qa/marlin-smoke.mjs chromium dist / approve
    node qa/marlin-smoke.mjs chromium .private/phase2-pages /MARLIN/ reject
    node qa/marlin-smoke.mjs firefox dist / approve
    node qa/marlin-smoke.mjs webkit dist / reject
    node qa/mobile-bridge.mjs

The Pages workflow also runs Firefox, WebKit and the mobile Bridge check against the `/MARLIN/` build. For the Bridge check use `node qa/mobile-bridge.mjs .private/phase2-pages /MARLIN/`. It prints its result to the terminal.

The multi-browser smoke harness writes results under `.private/phase2-qa`. No preview server or SPA rewrite is used. Screenshots and raw evidence stay private unless reviewed and selected for the README. Passing Axe checks cover the scanned states and rules; use manual assistive-technology and physical-device checks before any public demo.
