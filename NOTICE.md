# Notices

Original project attribution: **Team Topaz**. MARLIN's original code is licensed under the [MIT License](LICENSE), also included as LICENSE.txt in the static build. See [contributors](CONTRIBUTORS.md). Third-party material keeps its own terms and attribution.

The five vessel hulls in public/assets/vessels are generated locally by scripts/generate-vessel-models.mjs. They depict generic simulation profiles. This release excludes imported vessel models, standalone Draco copies, original challenge submissions, the starter social-logo sprite and the original starter favicon. The current favicon is a small MARLIN navigation mark drawn in SVG.

CesiumJS is Apache-2.0. [CesiumJS license and bundled notices](public/notices/CesiumJS-LICENSE.md) travel with the static build. Cesium's bundled Natural Earth II imagery is used locally for geographic context; see [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/). Keep the imagery credit and Cesium notices in the interface and deployed artifact. No external font, Ion account, external imagery service or ship tracking feed is required. MARLIN's production build removes the bundled default Ion access token from the engine's Ion module; the build preserves the Cesium license and credits.

Application icons are supplied by Lucide under ISC. JavaScript and CSS dependencies keep their own licenses. The static build emits THIRD-PARTY-NOTICES.txt from the installed bundled packages. It retains the MT19937 notice in the locked mersenne-twister source and the D3 notices shipped with victory-vendor. The additional license texts in docs/third-party come from the [React Three Fiber package's recorded source revision](https://github.com/pmndrs/react-three-fiber/blob/0a107412ac64667b1908422e859447952f57feef/LICENSE) and [Victory v37.3.6](https://github.com/FormidableLabs/victory/blob/v37.3.6/LICENSE.txt).

The locked bitmap-sdf 1.0.4 package declares MIT, and its [versioned upstream readme](https://github.com/dy/bitmap-sdf/blob/78de3569d32404a7009f62bea3befca55838118a/readme.md#license) gives the 2017 Dima Yv. attribution and Plotly support credit. The [npm release](https://registry.npmjs.org/bitmap-sdf/1.0.4) and exact source tree do not ship a standalone license file. The generated notice retains the upstream wording and appends the unmodified [SPDX MIT text](docs/third-party/bitmap-sdf-MIT-SPDX.txt). The template's copyright fields are deliberately unchanged; the actual dependency attribution is supplied separately above the text. This notice covers the dependency, not MARLIN's original code.

Any “needs review” entry is a release blocker. See [release checks](docs/STATIC_HOSTING.md).

README images depict the fixed synthetic demonstration. They contain no actual vessel, voyage, account or operational data.
