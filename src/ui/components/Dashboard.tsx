import React from 'react';

interface Props {
  colorCount: number;
  textCount: number;
  totalLinked: number;
  totalScanned: number;
  scanDuration: number;
  colorTokensLoaded: number;
  textStylesLoaded: number;
}

export function Dashboard({
  colorCount,
  textCount,
  totalLinked,
  totalScanned,
  scanDuration,
  colorTokensLoaded,
  textStylesLoaded,
}: Props) {
  const totalIssues = colorCount + textCount;
  const totalTokens = totalLinked + totalIssues;
  const healthPercent = totalTokens > 0 ? Math.round((totalLinked / totalTokens) * 100) : 100;

  return (
    <div className="dashboard">
      <div className="dashboard-cards">
        <div className={'card ' + (colorCount > 0 ? 'card--issue' : 'card--ok')}>
          <div className="card-value">{colorCount}</div>
          <div className="card-label">Unlinked Colors</div>
        </div>
        <div className={'card ' + (textCount > 0 ? 'card--issue' : 'card--ok')}>
          <div className="card-value">{textCount}</div>
          <div className="card-label">Unlinked Text</div>
        </div>
        <div className={'card ' + (totalIssues > 0 ? 'card--issue' : 'card--ok')}>
          <div className="card-value">{totalIssues}</div>
          <div className="card-label">Total Issues</div>
        </div>
      </div>

      <div className="health-bar-container">
        <div className="health-bar-label">
          <span>Token Health</span>
          <span>{healthPercent}%</span>
        </div>
        <div className="health-bar">
          <div
            className="health-bar-fill"
            style={{ width: healthPercent + '%' }}
          />
        </div>
        <div className="health-bar-meta">
          {totalScanned} nodes scanned in {(scanDuration / 1000).toFixed(1)}s
          {' \u00B7 '}
          {colorTokensLoaded} color tokens, {textStylesLoaded} text styles loaded
        </div>
      </div>
    </div>
  );
}
