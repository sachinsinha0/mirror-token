# Mirror Link

A Figma plugin that scans your designs for unlinked colors and text styles, matches them to your design system tokens, and links them in bulk.

## Why

When designs are imported into Figma (via tools like Design Mirror or manual copy-paste), design tokens often get broken — colors show as raw hex values instead of linked variables, and text appears as raw font specs instead of linked text styles. Mirror Link detects these broken connections and re-links them to your design system.

## Features

- **Color scanning** — Detects fills and strokes not bound to color variables or paint styles
- **Text style scanning** — Detects text nodes not linked to text styles
- **Smart matching** — Uses CIELAB color distance for colors, font size + weight scoring for typography
- **Confidence levels** — Exact, High, Medium, Low — so you know how reliable each match is
- **Multi-library support** — Configure multiple design system library files
- **Bulk linking** — Select and link all matched tokens in one click
- **Text group view** — Groups identical typography for efficient batch fixing
- **CSV export** — Export scan results for team review
- **Dark mode** — Adapts to Figma's light/dark theme
- **Design Mirror integration** — Auto-scans after Design Mirror imports

## Setup

1. Install the plugin in Figma
2. On first launch, the onboarding wizard guides you through:
   - Adding your **Figma Personal Access Token** (for fetching text styles via REST API)
   - Adding your **design system library file key(s)**
3. Click **Scan** to detect unlinked tokens on the current page

### Getting Your Library File Key

Open your design system library in Figma. The file key is in the URL:
```
figma.com/design/YOUR_FILE_KEY/My-Design-System
                 ^^^^^^^^^^^^^^
```

## Development

```bash
npm install
npm run build        # Build plugin + UI
npm run watch        # Watch mode for development
npm run typecheck    # TypeScript check (both configs)
npm test             # Run unit tests
```

### Architecture

```
src/
  shared/types.ts     — Shared type definitions (message protocol, data types)
  plugin/
    main.ts           — Message handler, scan orchestration, settings
    scanner.ts        — Node scanning logic
    matcher.ts        — Color matching (CIELAB) and text matching algorithms
    fixer.ts          — Applies fixes (binds variables, applies text styles)
    variables.ts      — Loads color tokens and typography from Figma APIs
    utils.ts          — Shared utilities (hex conversion, weight parsing)
  ui/
    App.tsx           — Main React component
    components/       — UI components (Dashboard, IssueList, Settings, etc.)
    hooks/            — Custom hooks (usePluginMessages)
    utils/            — REST API calls, messaging utilities
```

### Build System

- **Plugin**: esbuild bundles `src/plugin/main.ts` into `dist/code.js`
- **UI**: Vite + React builds `src/ui/` into `dist/index.html` (single inlined file via vite-plugin-singlefile)

## Design Mirror Integration

If you use the [Design Mirror](https://github.com/sachinsinha0/design-mirror-releases) macOS app, Mirror Link auto-detects recent imports and triggers a scan automatically. Design Mirror sets `pluginData('designMirrorLastImport')` with a timestamp; Mirror Link checks this on launch.

## Privacy

See [PRIVACY.md](PRIVACY.md). API tokens are stored in Figma's encrypted per-user client storage. No data is sent to third parties.

## License

MIT
