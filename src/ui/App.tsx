import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePluginMessages } from './hooks/usePluginMessages';
import { Dashboard } from './components/Dashboard';
import { ProgressBar } from './components/ProgressBar';
import { CategoryTabs, TabId } from './components/CategoryTabs';
import { IssueList } from './components/IssueList';
import { BulkActions } from './components/BulkActions';
import { TextGroupList } from './components/TextGroupList';
import { Settings } from './components/Settings';
import { Logo } from './components/Logo';
import { Onboarding } from './components/Onboarding';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FilterBar, SortMode, ConfidenceFilter } from './components/FilterBar';
import { fetchMultiLibraryTextStyles } from './utils/figmaApi';
import { LibraryEntry } from '../shared/types';
import { postToPlugin } from './utils/messaging';

function App() {
  const {
    status,
    results,
    progress,
    fixResult,
    debugLines,
    loadingMessage,
    errorMessage,
    scan,
    linkSelected,
    selectNode,
  } = usePluginMessages();

  const [showDebug, setShowDebug] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scope, setScope] = useState<'page' | 'selection'>('page');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Token loaded from plugin's encrypted clientStorage via load-settings message
  const [apiToken, setApiToken] = useState('');
  const [libraryFileKeys, setLibraryFileKeys] = useState<LibraryEntry[]>(() => {
    try {
      var raw = localStorage.getItem('mirrorlink_fileKeys');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  });
  const [textStyleStatus, setTextStyleStatus] = useState('');
  const [showConfirmLink, setShowConfirmLink] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((val: string) => {
    setFilterSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 200);
  }, []);
  const [filterSort, setFilterSort] = useState<SortMode>('default');
  const [filterConfidence, setFilterConfidence] = useState<ConfidenceFilter>('all');
  const [onboarded, setOnboarded] = useState(() => {
    try { return localStorage.getItem('mirrorlink_onboarded') === '1'; } catch (e) { return false; }
  });

  // Also load from plugin data (as backup)
  useEffect(() => {
    postToPlugin({ type: 'load-settings' });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      var msg = event.data?.pluginMessage;
      if (!msg) return;

      if (msg.type === 'settings-loaded') {
        if (msg.apiToken) {
          setApiToken(msg.apiToken);
        }
        if (msg.libraryFileKeys && msg.libraryFileKeys.length > 0) {
          setLibraryFileKeys(msg.libraryFileKeys);
          try { localStorage.setItem('mirrorlink_fileKeys', JSON.stringify(msg.libraryFileKeys)); } catch (e) {}
        }
      }

      if (msg.type === 'text-styles-imported') {
        setTextStyleStatus('Imported ' + msg.count + ' text styles');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSaveSettings = (token: string, keys: LibraryEntry[]) => {
    setApiToken(token);
    setLibraryFileKeys(keys);
    try { localStorage.setItem('mirrorlink_fileKeys', JSON.stringify(keys)); } catch (e) {}
    postToPlugin({ type: 'save-settings', apiToken: token, libraryFileKeys: keys });
  };

  const handleOnboardingComplete = (token: string, keys: LibraryEntry[]) => {
    handleSaveSettings(token, keys);
    setOnboarded(true);
    try { localStorage.setItem('mirrorlink_onboarded', '1'); } catch (e) {}
  };

  // All fixable issue IDs
  const fixableIds = useMemo(() => {
    if (!results) return new Set<string>();
    const ids = new Set<string>();
    for (const i of results.colorIssues) {
      if (i.match && (i.match.confidence === 'exact' || i.match.confidence === 'high')) {
        ids.add(i.id);
      }
    }
    for (const i of results.textIssues) {
      if (i.suggestedStyleName) {
        ids.add(i.id);
      }
    }
    return ids;
  }, [results]);

  const toggleSelect = useCallback((issueId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => { setSelectedIds(new Set(fixableIds)); }, [fixableIds]);
  const deselectAll = useCallback(() => { setSelectedIds(new Set()); }, []);

  const requestLinkSelected = useCallback(() => {
    if (!results || selectedIds.size === 0) return;
    setShowConfirmLink(true);
  }, [results, selectedIds]);

  const confirmLinkSelected = useCallback(() => {
    if (!results) return;
    const colorIds: string[] = [];
    const textIds: string[] = [];
    for (const issue of results.colorIssues) {
      if (selectedIds.has(issue.id) && issue.match) colorIds.push(issue.id);
    }
    for (const issue of results.textIssues) {
      if (selectedIds.has(issue.id) && issue.suggestedStyleName) textIds.push(issue.id);
    }
    linkSelected(colorIds, textIds);
    setSelectedIds(new Set());
    setShowConfirmLink(false);
  }, [results, selectedIds, linkSelected]);

  const handleExport = () => {
    if (!results) return;
    const rows = [['Type', 'Node Name', 'Node ID', 'Raw Value', 'Suggested Match', 'Confidence']];
    for (const issue of results.colorIssues) {
      rows.push(['Color (' + issue.property + ')', issue.nodeName, issue.nodeId, issue.rawHex, issue.match ? issue.match.tokenName + ' (' + issue.match.hex + ')' : 'No match', issue.match ? issue.match.confidence : '']);
    }
    for (const issue of results.textIssues) {
      rows.push(['Text', issue.nodeName, issue.nodeId, issue.fontFamily + ' ' + issue.fontWeight + ' ' + issue.fontSize + 'px', issue.suggestedStyleName || 'No match', issue.confidence || '']);
    }
    const csv = rows.map((r) => r.map((c) => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mirror-link-report.csv';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  };

  const handleSelectTextGroup = useCallback((nodeIds: string[]) => {
    postToPlugin({ type: 'select-text-group', nodeIds: nodeIds });
  }, []);

  const handleApplyTextStyle = useCallback((nodeIds: string[], textStyleId: string) => {
    postToPlugin({ type: 'fix-text-group', nodeIds: nodeIds, textStyleId: textStyleId });
  }, []);

  const handleApplyAllTextStyles = useCallback((assignments: Array<{ nodeIds: string[]; textStyleId: string }>) => {
    // Merge into a single batched message
    postToPlugin({ type: 'fix-text-groups-batch', assignments: assignments });
  }, []);


  // Filtered and sorted color issues
  const filteredColorIssues = useMemo(() => {
    if (!results) return [];
    var list = results.colorIssues.slice();
    // Search filter
    if (debouncedSearch) {
      var q = debouncedSearch.toLowerCase();
      list = list.filter(function(i) { return i.nodeName.toLowerCase().indexOf(q) !== -1; });
    }
    // Confidence filter
    if (filterConfidence === 'matched') {
      list = list.filter(function(i) { return i.match !== null; });
    } else if (filterConfidence === 'unmatched') {
      list = list.filter(function(i) { return i.match === null; });
    }
    // Sort
    if (filterSort === 'name-asc') {
      list.sort(function(a, b) { return a.nodeName.localeCompare(b.nodeName); });
    } else if (filterSort === 'confidence-desc') {
      var order: Record<string, number> = { exact: 0, high: 1, medium: 2, low: 3 };
      list.sort(function(a, b) {
        var ca = a.match ? (order[a.match.confidence] ?? 4) : 5;
        var cb = b.match ? (order[b.match.confidence] ?? 4) : 5;
        return ca - cb;
      });
    }
    return list;
  }, [results, debouncedSearch, filterSort, filterConfidence]);

  const allSelected = fixableIds.size > 0 && selectedIds.size === fixableIds.size;
  const hasApiToken = apiToken.length > 0;
  const hasLibraries = libraryFileKeys.some((l) => l.key.length > 0);

  // Show onboarding for first-time users
  if (!onboarded && !hasApiToken) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="app">
      {/* Settings overlay */}
      {showSettings && (
        <Settings
          apiToken={apiToken}
          libraryFileKeys={libraryFileKeys}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Confirm link dialog */}
      {showConfirmLink && (
        <ConfirmDialog
          title="Link Tokens"
          message={'Link ' + selectedIds.size + ' token' + (selectedIds.size !== 1 ? 's' : '') + ' to your design system? This cannot be undone.'}
          confirmLabel="Link Tokens"
          onConfirm={confirmLinkSelected}
          onCancel={() => setShowConfirmLink(false)}
        />
      )}

      {/* Header */}
      <div className="header">
        <div className="header-title">
          <Logo size={18} />
          Mirror Link
        </div>
        <div className="header-controls">
          <button
            className="btn btn--ghost"
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
            style={{ padding: '4px 6px', fontSize: '14px' }}
          >
            &#9881;
          </button>
          <select
            className="scope-select"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'page' | 'selection')}
          >
            <option value="page">Current Page</option>
            <option value="selection">Selection</option>
          </select>
          <button
            className="btn btn--primary"
            onClick={async () => {
              setSelectedIds(new Set());
              setTextStyleStatus('');

              var token = apiToken;
              var libs = libraryFileKeys.filter(function(l) { return l.key; });

              console.log('[Mirror Link UI] Scan clicked. apiToken=' + (token ? 'set (' + token.length + ' chars)' : 'empty') + ' libraries=' + libs.length);

              // Fetch text styles via REST API BEFORE scanning
              var keys: Array<{ key: string; name: string }> = [];
              if (token && libs.length > 0) {
                try {
                  setTextStyleStatus('Fetching text styles from ' + libs.length + ' librar' + (libs.length === 1 ? 'y' : 'ies') + '...');
                  console.log('[Mirror Link UI] Fetching text styles from REST API...');
                  var fetched = await fetchMultiLibraryTextStyles(libs, token);
                  keys = fetched;
                  setTextStyleStatus('Found ' + keys.length + ' text styles');
                  console.log('[Mirror Link UI] Got ' + keys.length + ' text style keys');
                } catch (err: any) {
                  setTextStyleStatus('API error: ' + (err.message || err));
                  console.error('[Mirror Link UI] REST API error:', err);
                }
              } else {
                if (!token) console.log('[Mirror Link UI] No API token — skipping text style fetch');
                if (libs.length === 0) console.log('[Mirror Link UI] No library file keys — skipping text style fetch');
              }

              // Send scan WITH text style keys
              console.log('[Mirror Link UI] Sending scan with ' + keys.length + ' text style keys');
              scan(scope, keys.length > 0 ? keys : undefined);
            }}
            disabled={status === 'scanning' || status === 'fixing' || status === 'loading'}
          >
            {status === 'loading' ? 'Loading...' : status === 'scanning' ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </div>

      {/* Setup warning */}
      {(!hasApiToken || !hasLibraries) && status === 'idle' && (
        <div className="notification" style={{ background: 'var(--mt-color-warning-bg)', borderColor: 'var(--mt-color-warning-border)', color: 'var(--mt-color-warning-text)' }}>
          Click &#9881; to configure your {!hasApiToken && !hasLibraries ? 'API token and library file keys' : !hasApiToken ? 'Figma API token' : 'library file keys'} for text style linking.
        </div>
      )}

      {/* Text style loading status */}
      {textStyleStatus && (
        <div className="notification" style={{ background: 'var(--mt-color-info-bg)', borderColor: 'var(--mt-color-info-border)', color: 'var(--mt-color-info-text)' }}>
          {textStyleStatus}
        </div>
      )}

      {/* Loading tokens */}
      {status === 'loading' && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <div className="loading-text">{loadingMessage}</div>
        </div>
      )}

      {/* Scanning progress */}
      {status === 'scanning' && (
        <div>
          <ProgressBar done={progress.done} total={progress.total} label="Scanning nodes..." />
          <div style={{ textAlign: 'center', padding: '0 16px 8px' }}>
            <button
              className="btn btn--secondary"
              onClick={() => postToPlugin({ type: 'cancel-scan' })}
              style={{ fontSize: 10 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fixing progress */}
      {status === 'fixing' && (
        <ProgressBar done={progress.done} total={progress.total} label="Linking tokens..." />
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="error-state">
          <div className="error-state-icon">!</div>
          <div className="error-state-message">Scan failed</div>
          <div className="error-state-detail">{errorMessage}</div>
          <button className="btn btn--primary" onClick={() => scan(scope)} style={{ marginTop: 8 }}>
            Try Again
          </button>
        </div>
      )}

      {/* Fix result notification */}
      {fixResult && (
        <div className="notification">
          Linked {fixResult.fixed} token{fixResult.fixed !== 1 ? 's' : ''} to your design system.
          {fixResult.failed > 0 && ' ' + fixResult.failed + ' failed.'}
        </div>
      )}

      {/* Results */}
      {results && status === 'done' && (
        <>
          <Dashboard
            colorCount={results.colorIssues.length}
            textCount={results.textIssues.length}
            totalLinked={results.totalLinkedTokens}
            totalScanned={results.totalNodesScanned}
            scanDuration={results.scanDurationMs}
            colorTokensLoaded={results.colorTokensLoaded || 0}
            textStylesLoaded={results.textStylesLoaded || 0}
          />

          <CategoryTabs
            active={activeTab}
            colorCount={results.colorIssues.length}
            textCount={results.textIssues.length}
            onChange={setActiveTab}
          />

          {/* Show grouped text view for Text tab, color list for Colors/All */}
          {activeTab === 'text' && results.textGroups && results.textGroups.length > 0 ? (
            <TextGroupList
              groups={results.textGroups}
              availableStyles={results.availableTextStyles || []}
              onSelectGroup={handleSelectTextGroup}
              onApplyStyle={handleApplyTextStyle}
              onApplyAll={handleApplyAllTextStyles}
            />
          ) : (
            <>
              <FilterBar
                search={filterSearch}
                onSearchChange={handleSearchChange}
                sort={filterSort}
                onSortChange={setFilterSort}
                confidenceFilter={filterConfidence}
                onConfidenceFilterChange={setFilterConfidence}
                visibleCount={filteredColorIssues.length}
                totalCount={results.colorIssues.length}
              />
              <IssueList
                colorIssues={filteredColorIssues}
                textIssues={[]}
                activeTab={activeTab}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectNode={selectNode}
              />

              <BulkActions
                selectedCount={selectedIds.size}
                totalFixable={fixableIds.size}
                onLinkSelected={requestLinkSelected}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                allSelected={allSelected}
                onExport={handleExport}
                disabled={false}
              />
            </>
          )}
        </>
      )}

      {/* Idle state */}
      {status === 'idle' && (
        <div className="idle-state">
          <div className="idle-state-icon">
            <Logo size={48} />
          </div>
          <div className="idle-state-text">
            Click <strong>Scan</strong> to detect unlinked design tokens on this page.
          </div>
        </div>
      )}

      {/* Debug log toggle */}
      {debugLines.length > 0 && (
        <div className="debug-section">
          <button
            className="btn btn--ghost"
            onClick={() => setShowDebug(!showDebug)}
            style={{ width: '100%', textAlign: 'left', padding: '6px 16px', fontSize: '10px' }}
          >
            {showDebug ? 'Hide' : 'Show'} Debug Log ({debugLines.length} lines)
          </button>
          {showDebug && (
            <div>
              <div style={{ textAlign: 'right', padding: '4px 16px 0' }}>
                <button
                  className="btn btn--ghost"
                  style={{ fontSize: 9 }}
                  onClick={() => {
                    try { navigator.clipboard.writeText(debugLines.join('\n')); } catch (e) {}
                  }}
                >
                  Copy
                </button>
              </div>
              <pre className="debug-log">{debugLines.join('\n')}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
