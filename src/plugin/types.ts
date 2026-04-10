// ============================================================
// Shared types for plugin ↔ UI message protocol
// ============================================================

// --- Color types ---

export interface RGBA {
  r: number; // 0–1
  g: number;
  b: number;
  a: number;
}

// --- Token catalog ---

export interface ColorToken {
  id: string;
  key: string;
  name: string;
  source: 'variable' | 'paint-style';
  collectionName: string;
  color: RGBA;
  hex: string;
  allColors: RGBA[];
}

// --- Scan issues ---

export type Confidence = 'exact' | 'high' | 'medium' | 'low';

export interface ColorMatch {
  tokenId: string;
  tokenName: string;
  tokenSource: 'variable' | 'paint-style';
  collectionName: string;
  hex: string;
  distance: number;
  confidence: Confidence;
}

export interface ColorIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  property: 'fill' | 'stroke';
  paintIndex: number;
  rawHex: string;
  rawRGBA: RGBA;
  match: ColorMatch | null;
}

// --- Typography ---

export interface TypographyGroup {
  name: string;
  textStyleId: string | null;
  fontSize: number | null;
  fontSizeVarId: string | null;
  lineHeight: number | null;
  lineHeightVarId: string | null;
  letterSpacing: number | null;
  letterSpacingVarId: string | null;
  fontWeight: number | null;
  fontWeightVarId: string | null;
}

export interface TextIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  suggestedGroup: string | null;
  suggestedGroupData: TypographyGroup | null;
  suggestedStyleId: string | null;
  suggestedStyleName: string | null;
  confidence: Confidence | null;
}

// Grouped text issues by font signature
export interface TextGroup {
  key: string;            // "Inter/Regular/14"
  fontFamily: string;     // "Inter"
  fontWeight: string;     // "Regular"
  fontSize: number;       // 14
  nodeIds: string[];      // all matching node IDs
  count: number;          // number of nodes
  suggestedStyleName: string | null;  // auto-suggested best match
  suggestedStyleId: string | null;    // Figma Text Style ID
}

export interface ScanResults {
  colorIssues: ColorIssue[];
  textIssues: TextIssue[];
  textGroups: TextGroup[];          // NEW: grouped by font signature
  availableTextStyles: Array<{ id: string; name: string; fontSize: number; fontWeight: number }>; // for dropdown
  totalNodesScanned: number;
  totalLinkedTokens: number;
  scanDurationMs: number;
  colorTokensLoaded: number;
  textStylesLoaded: number;
}

// --- UI → Plugin messages ---

export type UIMessage =
  | { type: 'scan'; scope: 'page' | 'selection'; textStyleKeys?: Array<{ key: string; name: string }> }
  | { type: 'fix-all'; minConfidence: Confidence }
  | { type: 'link-selected'; colorIssueIds: string[]; textIssueIds: string[] }
  | { type: 'select-text-group'; nodeIds: string[] }
  | { type: 'select-node'; nodeId: string }
  | { type: 'save-settings'; apiToken: string; libraryFileKey: string }
  | { type: 'load-settings' }
  | { type: 'text-style-keys'; keys: Array<{ key: string; name: string }> };

// --- Plugin → UI messages ---

export type PluginMessage =
  | { type: 'scan-started'; totalNodes: number }
  | { type: 'loading-tokens'; message: string }
  | { type: 'scan-progress'; processed: number; total: number }
  | { type: 'scan-complete'; results: ScanResults }
  | { type: 'fix-started'; total: number }
  | { type: 'fix-progress'; done: number; total: number }
  | { type: 'fix-complete'; fixed: number; failed: number }
  | { type: 'debug-log'; lines: string[] }
  | { type: 'settings-loaded'; apiToken: string; libraryFileKey: string }
  | { type: 'need-text-styles'; apiToken: string; libraryFileKey: string }
  | { type: 'text-styles-imported'; count: number };
