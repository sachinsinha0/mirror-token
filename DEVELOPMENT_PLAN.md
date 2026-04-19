# Mirror Token — Future Development Plan

## Context

Mirror Token is a Figma plugin that scans designs for broken/unlinked design tokens and re-links them to the design system. It's part of the **Design Mirror ecosystem**:

1. **Design Mirror macOS App** → copies designs into Figma via Figma MCP
2. **Mirror Token Plugin** (this project) → detects and fixes broken tokens after import

Current state: **v0.1.0**, single commit, core features work but has significant security, scalability, UX, and portability gaps. Currently hardcoded to the Olympus design system — cannot be used publicly by teams with different design systems.

---

## PHASE 1: Security & Correctness (Foundation)

_Goal: Eliminate security risks and fix type errors. Nothing else should ship until these are resolved._

### 1.1 — Move API Token to `figma.clientStorage` (CRITICAL)

**Problem:** `main.ts:55-56` stores API tokens via `figma.root.setPluginData()` — visible to ALL file editors.

**Changes:**
- `src/plugin/main.ts` — Replace `setPluginData/getPluginData` for `figmaApiToken` with `figma.clientStorage.setAsync/getAsync` (per-user, encrypted)
- Add one-time migration: if old `pluginData` token exists, move it to `clientStorage` and wipe the old value
- Keep `libraryFileKey` in `pluginData` (non-sensitive, team-shareable)

### 1.2 — Fix All TypeScript Errors

**Changes:**
- `src/plugin/variables.ts` — Remove duplicate `import { TypographyGroup }` on line 234; rename shadowed `result` variable on line 455
- `src/ui/hooks/usePluginMessages.ts` — Replace the incomplete local `ScanResults` interface (missing `colorTokensLoaded`, `textStylesLoaded`, `textGroups`) with import from plugin types
- `src/ui/components/IssueList.tsx` — Replace `any[]` props with proper `ColorIssue[]` and `TextIssue[]`
- `src/ui/utils/messaging.ts` — Type `postToPlugin` to accept `UIMessage`, type `onPluginMessage` callback to accept `PluginMessage`

**Verification:** `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.ui.json` both pass with 0 errors.

### 1.3 — Add Runtime Message Validation

**Changes:**
- `src/plugin/main.ts` — Add `validateMessage()` guard at top of `onmessage` handler; add `default` case to switch
- `src/ui/utils/messaging.ts` — Type both functions properly (done in 1.2)

### 1.4 — Fix issueCounter Leak

**Changes:**
- `src/plugin/scanner.ts` — Reset `issueCounter = 0` at start of `scanNodes()`

### 1.5 — Remove Hardcoded Olympus Default File Key

**Problem:** Default `VCFZJgU9KnGWy7KtxBxSy1` appears in 3 places. Non-Olympus users get silent API errors.

**Changes:**
- `src/plugin/main.ts:63` — Change default to `''`
- `src/ui/App.tsx:38,194` — Change defaults to `''`
- `src/ui/components/Settings.tsx:51` — Update placeholder to generic hint

---

## PHASE 2: Design-System-Agnostic (Portability)

_Goal: Any team with any design system can use the plugin._

### 2.1 — Remove Hardcoded Olympus Typography Fallback

**Problem:** `variables.ts:432-452` has 11 hardcoded Olympus entries (Headline 1-5, Body 1-2, etc.).

**Changes:**
- `src/plugin/variables.ts` — Remove `olympusTypo` array and loop entirely
- Return empty `TypographyGroup[]` when no text styles found
- UI: detect `textStylesLoaded === 0` and show helpful setup message

### 2.2 — Support Multiple Library Files

**Problem:** Single `libraryFileKey` — teams with multiple libraries (foundations + components) can't use it.

**Changes:**
- `src/plugin/types.ts` — Change settings to `libraryFileKeys: Array<{ key: string; label: string }>`
- `src/ui/components/Settings.tsx` — Add/remove library entries (simple list UI)
- `src/ui/utils/figmaApi.ts` — Iterate over all keys and merge results
- `src/plugin/main.ts` — Store as JSON in `pluginData`; migrate old single-key format

### 2.3 — Rename Plugin ID

**Changes:**
- `manifest.json` — Change `"id": "mirror-token-olympus"` to `"id": "mirror-token"`

### 2.4 — Consolidate Duplicate Utility Functions

**Problem:** 3 copies of `rgbaToHex`, 3 different weight-parsing functions across files.

**Changes:**
- New file: `src/plugin/utils.ts` — canonical `rgbaToHex`, `parseWeightToNumber`, `weightNumberToFigmaStyle`, `normalizeWeight`
- Update `scanner.ts`, `matcher.ts`, `variables.ts`, `fixer.ts` to import from `utils.ts`

---

## PHASE 3: UX, Scalability & Polish

_Goal: Performant on large files, usable by designers, polished for public release._

### 3.1 — First-Time User Onboarding

**Problem:** No guidance for new users. Empty state just says "Click Scan" but scan fails silently without config.

**Changes:**
- New component: `src/ui/components/Onboarding.tsx` — 3-step setup flow (welcome → API token → library key)
- `src/ui/App.tsx` — Show onboarding when no token/library configured
- Store `hasCompletedOnboarding` in `figma.clientStorage`

### 3.2 — Error States

**Problem:** Scan failures, invalid tokens, wrong file keys all fail silently.

**Changes:**
- `src/plugin/types.ts` — Add `{ type: 'scan-error'; message: string }` message
- `src/plugin/main.ts` — Wrap `handleScan` in try/catch, send `scan-error` on failure
- `src/ui/App.tsx` — New `error` status with clear message and "Try Again" button
- `src/ui/utils/figmaApi.ts` — Detect 401 (invalid token) vs 404 (wrong file key) vs 429 (rate limit) specifically

### 3.3 — Confirmation Before Bulk Linking

**Changes:**
- New component: `src/ui/components/ConfirmDialog.tsx`
- `src/ui/App.tsx` — Show dialog before `handleLinkSelected`: "Link N tokens? This cannot be undone."

### 3.4 — Color Token CIELAB Cache

**Problem:** `findBestColorMatch` computes `rgbToLab()` for every token on every call. O(nodes × tokens × modes).

**Changes:**
- `src/plugin/types.ts` — Add `labColors: [number, number, number][]` to `ColorToken`
- `src/plugin/matcher.ts` — Pre-compute Lab values once at load time; compute input Lab once per call

### 3.5 — Chunked Node Scanning + Cancel

**Problem:** `findAll()` loads entire page tree. Dangerous on 50k+ node pages. No way to cancel.

**Changes:**
- `src/plugin/main.ts` — Walk `figma.currentPage.children` recursively, yield every N nodes via `setTimeout(0)`
- `src/plugin/scanner.ts` — Accept cancellation token, check at batch boundaries
- `src/plugin/types.ts` — Add `{ type: 'cancel-scan' }` message
- `src/ui/App.tsx` — Show "Cancel" button during scan
- Cache token catalog between scans (skip reload if < 30s old)

### 3.6 — Virtual Scrolling for Issue Lists

**Changes:**
- `package.json` — Add `react-window` dependency
- `src/ui/components/IssueList.tsx` — Wrap in `FixedSizeList` (row height ~52px)
- `src/ui/components/TextGroupList.tsx` — Same treatment

### 3.7 — Filter & Sort Results

**Changes:**
- New component: `src/ui/components/FilterBar.tsx` — Confidence filter checkboxes, sort dropdown, search input
- `src/ui/App.tsx` — Apply filters via `useMemo` before passing to `IssueList`

### 3.8 — Dark Mode Support

**Problem:** Hardcoded hex colors (`#FFF3F0`, `#F0FFF4`, `#1B8A5A`, `#DC2626`, etc.) break on Figma dark theme.

**Changes:**
- `src/ui/styles.css` — Replace all hardcoded colors with CSS custom properties; add dark variants using Figma's `--figma-color-*` variables
- `src/ui/components/IssueRow.tsx` — Move inline `confidenceColors` to CSS variables

### 3.9 — "Apply Style" on Text Groups

**Problem:** `fixTextGroupNodes` exists in `fixer.ts` but is never called. Text groups have "Select" but no "Apply".

**Changes:**
- `src/plugin/types.ts` — Add `{ type: 'fix-text-group'; nodeIds: string[]; textStyleId: string }` message
- `src/plugin/main.ts` — Handle message, call `fixTextGroupNodes`
- `src/ui/components/TextGroupRow.tsx` — Add "Apply" button when `suggestedStyleId` exists; show style dropdown when no suggestion

### 3.10 — Small UX Polish
- Add `title={nodeName}` tooltips on truncated names (`IssueRow.tsx`, `TextGroupRow.tsx`)
- Add `role="progressbar"` + aria attributes to `ProgressBar.tsx`
- Add copy-to-clipboard button for debug log
- Make notifications dismissible

---

## PHASE 4: Publishing & Ecosystem Integration

_Goal: Figma Community ready, CI pipeline, Design Mirror integration._

### 4.1 — Audit `enableProposedApi`

**Changes:**
- Test plugin with `enableProposedApi: false` in `manifest.json`
- If `getLocalVariablesAsync` fails, fall back to collection iteration (S1 already does this)
- Remove flag if all critical paths work

### 4.2 — Manifest Metadata

**Changes:**
- `manifest.json` — Add `"version": "1.0.0"`, `"description": "..."` fields

### 4.3 — Test Infrastructure

**Changes:**
- `package.json` — Add `vitest`
- `src/plugin/__tests__/` — Unit tests for: `rgbaToHex`, `colorDistance`, `findBestColorMatch`, `parseWeightToNumber`, `findBestTypographyMatch`
- Target: 80% coverage on pure functions in `matcher.ts`, `scanner.ts`, `utils.ts`

### 4.4 — CI Pipeline

**Changes:**
- `.github/workflows/ci.yml` — `npm ci` → `typecheck` → `test` → `build`

### 4.5 — Design Mirror Integration

**Problem:** After Design Mirror imports designs, user must manually open Mirror Token and click Scan.

**Changes:**
- `src/plugin/main.ts` — On plugin open, check `figma.root.getPluginData('designMirrorLastImport')` for recent timestamp; auto-trigger scan if < 60s old
- `src/plugin/types.ts` — Add `{ type: 'auto-scan-triggered' }` message
- UI shows "Scan triggered by Design Mirror import"

### 4.6 — Documentation & License

**Changes:**
- New: `README.md` — Description, install, usage, architecture, link to Design Mirror
- New: `LICENSE` — MIT
- New: `PRIVACY.md` — Data handling documentation (required for Figma Community)

### 4.7 — Plugin Listing Assets
- 128x128 icon from existing logo SVGs
- 1920x960 cover image showing plugin UI
- Community listing description

---

## Phase Dependencies

```
Phase 1 (security/correctness) → no external deps, do first
Phase 2 (agnostic)             → depends on 1.2, 1.5
Phase 3 (UX/scale)             → depends on 2.4 (consolidated utils)
Phase 4 (publishing)           → depends on all above
```

Within each phase, tasks are independent unless noted.

---

## Verification Plan

After each phase:
1. `npm run typecheck` passes (both tsconfigs)
2. `npm run build` succeeds
3. Load plugin in Figma dev mode, run a full scan on a test page
4. Phase 1: Verify `figma.root.getPluginData('figmaApiToken')` returns empty after migration
5. Phase 2: Test with a non-Olympus library file key; verify no Olympus-specific behavior
6. Phase 3: Test on a page with 10k+ nodes; verify cancel works; test dark mode
7. Phase 4: Run `npm test`; verify CI green; submit to Figma Community review

---

## Key Files (Most Frequently Modified)

| File | Phases |
|---|---|
| `src/plugin/main.ts` | 1.1, 1.3, 1.5, 2.2, 3.2, 3.5, 3.9, 4.5 |
| `src/plugin/types.ts` | 1.2, 1.3, 2.2, 3.2, 3.4, 3.5, 3.9, 4.5 |
| `src/plugin/variables.ts` | 1.2, 2.1, 2.4, 3.5 |
| `src/ui/App.tsx` | 1.5, 3.1, 3.2, 3.3, 3.7 |
| `src/ui/styles.css` | 3.8 |
| `src/plugin/matcher.ts` | 2.4, 3.4 |
| `src/plugin/scanner.ts` | 1.4, 2.4, 3.5 |
| `manifest.json` | 2.3, 4.1, 4.2 |
