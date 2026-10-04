# Sources and modifications

These are vendored, pinned snapshots, not claims to the upstream authors' work
and not automatic trackers of the latest versions.

| Included skills | Source and pinned commit | License |
| --- | --- | --- |
| `visual-explainer` | [nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer/tree/528b71feb85dab5d92b82c3554880826f50a75da), v0.8.1 | MIT, in skill folder |
| `baoyu-design` | [JimLiu/baoyu-design](https://github.com/JimLiu/baoyu-design/tree/f27b3103a9b4c2f6236df0fc6c38d3d0d66301b1), v1.1.1 | MIT, in skill folder |
| `d3-viz` | [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates/tree/2b19c0ab4b6f4df0e86a4317c260790591d34241/cli-tool/components/skills/creative-design/claude-d3js-skill), v1.29.2 | Repository MIT license, in skill folder |
| Ten Data skills | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/c754c940bac9cdd9923ad08fee7d50a15edd71be/data), plugin v1.1.0 | Apache-2.0, in each skill folder |

The D3 skill is attributed to [chrisvoncsefalvay/claude-d3js-skill](https://github.com/chrisvoncsefalvay/claude-d3js-skill/tree/e198c87d03f1c9811acbff681886fac24baee53d);
the seven original content files matched that revision when the pinned stack
was assembled. This distribution uses the MIT-licensed aggregator snapshot.

Data skills: `analyze`, `build-dashboard`, `create-viz`, `data-context-extractor`,
`data-visualization`, `explore-data`, `sql-queries`, `statistical-analysis`,
`validate-data`, and `write-query`.

## Integration modifications (2026-10-04)

- `telegram-visual-brief`, its exporter, PDF packer, receipts, tests, and installation
  tools are project integration code. This public edition removes host-specific
  paths and report rules, supports a private rendering runtime and single-page
  PDFs, and records receipts against the actual attachment.
- Specialist skill entrypoints include local routing/data-truth guidance carried
  from the reviewed installation. `baoyu-design` also includes an OpenClaw adapter;
  generic harness instructions yield to the router for Telegram delivery.
- Local installation metadata is excluded. Original specialist support assets
  and source are retained. Each specialist's LICENSE governs that content.

`baoyu-design` includes upstream vendored React/ReactDOM, Babel, fflate, and a
Figma materializer. Original notices in those files are retained. Additional
React, Babel, and fflate license texts are under `licenses/`. Other upstream
dependencies are installed only when their optional workflows are requested.

The Telegram runtime installs Playwright (Apache-2.0), Pillow (HPND), and PyMuPDF
(AGPL/commercial licensing), each under its own package license. These binaries
are downloaded during setup, not redistributed here. Consult those projects'
terms when redistributing runtime software or embedding it in another product.
