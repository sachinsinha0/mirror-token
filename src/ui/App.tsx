import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { usePluginMessages } from './hooks/usePluginMessages';
import { Dashboard } from './components/Dashboard';
import { ProgressBar } from './components/ProgressBar';
import { CategoryTabs, TabId } from './components/CategoryTabs';
import { IssueList } from './components/IssueList';
import { BulkActions } from './components/BulkActions';
import { TextGroupList } from './components/TextGroupList';
import { Settings } from './components/Settings';
import { fetchLibraryTextStyles } from './utils/figmaApi';
import { postToPlugin } from './utils/messaging';

function App() {
  const {
    status,
    results,
    progress,
    fixResult,
    debugLines,
    loadingMessage,
    scan,
    fixAll,
    linkSelected,
    selectNode,
  } = usePluginMessages();

  const [showDebug, setShowDebug] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scope, setScope] = useState<'page' | 'selection'>('page');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Use localStorage for instant access (no async roundtrip needed)
  const [apiToken, setApiToken] = useState(() => {
    try { return localStorage.getItem('mirrortoken_apiToken') || ''; } catch (e) { return ''; }
  });
  const [libraryFileKey, setLibraryFileKey] = useState(() => {
    try { return localStorage.getItem('mirrortoken_fileKey') || 'VCFZJgU9KnGWy7KtxBxSy1'; } catch (e) { return 'VCFZJgU9KnGWy7KtxBxSy1'; }
  });
  const [textStyleStatus, setTextStyleStatus] = useState('');

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
          try { localStorage.setItem('mirrortoken_apiToken', msg.apiToken); } catch (e) {}
        }
        if (msg.libraryFileKey) {
          setLibraryFileKey(msg.libraryFileKey);
          try { localStorage.setItem('mirrortoken_fileKey', msg.libraryFileKey); } catch (e) {}
        }
      }

      if (msg.type === 'text-styles-imported') {
        setTextStyleStatus('Imported ' + msg.count + ' text styles');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSaveSettings = (token: string, fileKey: string) => {
    setApiToken(token);
    try { localStorage.setItem('mirrortoken_apiToken', token); } catch (e) {}
    try { localStorage.setItem('mirrortoken_fileKey', fileKey); } catch (e) {}
    setLibraryFileKey(fileKey);
    postToPlugin({ type: 'save-settings', apiToken: token, libraryFileKey: fileKey });
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

  const handleLinkSelected = useCallback(() => {
    if (!results || selectedIds.size === 0) return;
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
    a.download = 'mirror-token-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectTextGroup = useCallback((nodeIds: string[]) => {
    postToPlugin({ type: 'select-text-group', nodeIds: nodeIds });
  }, []);

  const allSelected = fixableIds.size > 0 && selectedIds.size === fixableIds.size;
  const hasApiToken = apiToken.length > 0;

  return (
    <div className="app">
      {/* Settings overlay */}
      {showSettings && (
        <Settings
          apiToken={apiToken}
          libraryFileKey={libraryFileKey}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Header */}
      <div className="header">
        <div className="header-title">
          <span className="header-icon">&#9672;</span>
          Mirror Token
        </div>
        <div className="header-controls">
          <button
            className="btn btn--ghost"
            onClick={() => setShowSettings(true)}
            title="Settings"
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

              // Read token fresh (in case state is stale)
              var token = apiToken;
              if (!token) {
                try { token = localStorage.getItem('mirrortoken_apiToken') || ''; } catch (e) {}
              }
              var fileKey = libraryFileKey || 'VCFZJgU9KnGWy7KtxBxSy1';

              console.log('[Mirror Token UI] Scan clicked. apiToken=' + (token ? 'set (' + token.length + ' chars)' : 'empty') + ' fileKey=' + fileKey);

              // Fetch text styles via REST API BEFORE scanning
              var keys: Array<{ key: string; name: string }> = [];
              if (token) {
                try {
                  setTextStyleStatus('Fetching text styles...');
                  console.log('[Mirror Token UI] Fetching text styles from REST API...');
                  var fetched = await fetchLibraryTextStyles(fileKey, token);
                  keys = fetched;
                  setTextStyleStatus('Found ' + keys.length + ' text styles');
                  console.log('[Mirror Token UI] Got ' + keys.length + ' text style keys');
                } catch (err: any) {
                  setTextStyleStatus('API error: ' + (err.message || err));
                  console.error('[Mirror Token UI] REST API error:', err);
                }
              } else {
                console.log('[Mirror Token UI] No API token — skipping text style fetch');
              }

              // Send scan WITH text style keys
              console.log('[Mirror Token UI] Sending scan with ' + keys.length + ' text style keys');
              scan(scope, keys.length > 0 ? keys : undefined);
            }}
            disabled={status === 'scanning' || status === 'fixing' || status === 'loading'}
          >
            {status === 'loading' ? 'Loading...' : status === 'scanning' ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </div>

      {/* API token warning */}
      {!hasApiToken && status === 'idle' && (
        <div className="notification" style={{ background: '#FFF8E1', borderColor: '#FFE082', color: '#F57F17' }}>
          Click &#9881; to add your Figma API token for text style linking.
        </div>
      )}

      {/* Text style loading status */}
      {textStyleStatus && (
        <div className="notification" style={{ background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D4ED8' }}>
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
        <ProgressBar done={progress.done} total={progress.total} label="Scanning nodes..." />
      )}

      {/* Fixing progress */}
      {status === 'fixing' && (
        <ProgressBar done={progress.done} total={progress.total} label="Linking tokens..." />
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
              onSelectGroup={handleSelectTextGroup}
            />
          ) : (
            <>
              <IssueList
                colorIssues={results.colorIssues}
                textIssues={[]}
                activeTab={activeTab}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectNode={selectNode}
              />

              <BulkActions
                selectedCount={selectedIds.size}
                totalFixable={fixableIds.size}
                onLinkSelected={handleLinkSelected}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                allSelected={allSelected}
                onExport={handleExport}
                disabled={status === 'fixing'}
              />
            </>
          )}
        </>
      )}

      {/* Idle state */}
      {status === 'idle' && (
        <div className="idle-state">
          <div className="idle-state-icon">&#128269;</div>
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
            <pre className="debug-log">{debugLines.join('\n')}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
