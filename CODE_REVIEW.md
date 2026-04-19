# Mirror Token — Code Review

Full code review across all 35+ source files. Findings organized by priority.

---

## MUST FIX (5 items) — Breaks functionality or security

### 1. API token cached in localStorage (Security)
**File:** `src/ui/App.tsx:40, 71, 90`
**Issue:** The UI caches the Figma API token in browser `localStorage`, which is accessible to XSS attacks and persists in plaintext. The plugin-side correctly uses encrypted `figma.clientStorage`, but the UI duplicates it insecurely.
**Fix:** Remove all `localStorage` reads/writes for `mirrortoken_apiToken`. Rely solely on the plugin's `clientStorage` round-trip via `load-settings`/`settings-loaded` messages.

### 2. Unguarded JSON.parse in scanner (Crash risk)
**File:** `src/plugin/scanner.ts:92`
**Issue:** `JSON.parse(ignoredRaw)` will throw if `ignoredIssues` pluginData is corrupted, crashing the entire scan.
**Fix:** Wrap in try-catch: `try { JSON.parse(ignoredRaw) } catch { [] }`

### 3. `return changed || true` always returns true (Logic bug)
**File:** `src/plugin/fixer.ts:174`
**Issue:** The fallback text fix path always reports success even when no changes were applied. Masks real failures.
**Fix:** Change to `return changed;`

### 4. Version mismatch between manifest and package.json
**Files:** `manifest.json:4` says `1.0.0`, `package.json:3` says `0.1.0`
**Fix:** Align both to the same version.

### 5. No timeout on REST API fetch (UI freeze risk)
**File:** `src/ui/utils/figmaApi.ts:20`
**Issue:** Fetch to Figma API has no timeout. If API hangs, UI freezes indefinitely.
**Fix:** Add AbortController with 15s timeout.

---

## SHOULD FIX (10 items) — UX, accessibility, or potential bugs

### 6. ConfirmDialog missing accessibility attributes
**File:** `src/ui/components/ConfirmDialog.tsx`
**Fix:** Add `role="alertdialog"`, `aria-labelledby`, `aria-describedby`, and Esc key handler.

### 7. Icon buttons missing aria-label
**Files:** `App.tsx:245` (settings gear), `Settings.tsx:88` (remove library x button)
**Fix:** Add `aria-label="Settings"`, `aria-label="Remove library"`.

### 8. No debounce on search filter input
**File:** `src/ui/components/FilterBar.tsx:25`
**Issue:** Every keystroke re-filters the entire issue list. Can cause jank on large scans.
**Fix:** Add 200ms debounce.

### 9. CSV export revokeObjectURL too early
**File:** `src/ui/App.tsx:166`
**Issue:** URL revoked synchronously before download may have started.
**Fix:** `setTimeout(() => URL.revokeObjectURL(url), 2000)`

### 10. Dark mode CSS gaps — health bar and debug log
**File:** `src/ui/styles.css`
**Issue:** `.health-bar-fill` uses hardcoded `#16A34A`. `.debug-log` uses hardcoded `#1a1a2e` / `#a0ffa0`.
**Fix:** Replace with `--mt-color-*` variables.

### 11. Empty catch blocks hide failures
**Files:** `fixer.ts:155`, `main.ts:183`, `variables.ts:66`
**Issue:** Multiple `catch (e) {}` blocks silently swallow errors. Users get no feedback when operations fail.
**Fix:** Add `console.warn` to each.

### 12. No React error boundary
**File:** `src/ui/App.tsx`
**Issue:** If any component crashes, the entire UI goes blank with no recovery.
**Fix:** Add ErrorBoundary wrapper component.

### 13. Unused `fixAll` export
**File:** `src/ui/hooks/usePluginMessages.ts:65-67` and `src/ui/App.tsx:23`
**Issue:** `fixAll` is defined and destructured but never called anywhere.
**Fix:** Remove from hook and App.tsx.

### 14. Unused `EmptyState` component
**File:** `src/ui/components/EmptyState.tsx`
**Issue:** Never imported or used. IssueList and TextGroupList define their own empty states.
**Fix:** Remove the file, or use it consistently.

### 15. Missing .gitignore entries
**File:** `.gitignore`
**Fix:** Add `.env`, `*.log`, `.cache/`, `coverage/`

---

## NICE TO FIX (8 items) — Code quality and polish

### 16. Inconsistent `var` vs `const/let`
**Files:** Throughout `App.tsx`, `figmaApi.ts`, `TextGroupList.tsx`
**Fix:** Replace all `var` with `const`/`let`.

### 17. Inline styles should be in CSS
**Files:** `App.tsx:249`, `Settings.tsx:70,74,82,91`, `Onboarding.tsx`
**Fix:** Move to stylesheet classes.

### 18. `as any` cast in IssueList virtual scrolling
**File:** `src/ui/components/IssueList.tsx:86`
**Fix:** Properly type the discriminated union instead of casting.

### 19. tsconfig.ui.json missing `lib` definition
**File:** `tsconfig.ui.json`
**Fix:** Add `"lib": ["ES2020", "DOM"]`.

### 20. Duplicate scoring logic between matcher and scanner
**Files:** `matcher.ts:215-244` (`findBestTextMatch`) and `scanner.ts:23-76` (`findBestTypographyMatch`)
**Fix:** Consolidate into one function.

### 21. VALID_TYPES array manually maintained
**File:** `src/plugin/main.ts:22`
**Issue:** Adding a new message type to `UIMessage` without updating `VALID_TYPES` silently drops messages.
**Fix:** Add a comment warning, or derive from type at build time.

### 22. No focus-visible styles
**File:** `src/ui/styles.css`
**Fix:** Add `:focus-visible` styles for all interactive elements.

### 23. Add keyboard navigation to CategoryTabs
**File:** `src/ui/components/CategoryTabs.tsx`
**Fix:** Add `role="tablist"` and arrow key navigation.

---

## NOT ISSUES (confirmed correct)

- React hook dependencies in App.tsx — all correct
- ResizeObserver cleanup in IssueList — properly disconnected
- Message listener cleanup in usePluginMessages — properly unsubscribed
- clientStorage async usage — all properly awaited
- Confidence filtering logic (exact/high only for colors) — intentional design
- pluginData for library keys — intentional team-sharing design
