import React from 'react';
import { ColorSwatch } from './ColorSwatch';

interface ColorIssueRowProps {
  kind: 'color';
  issue: {
    id: string;
    nodeId: string;
    nodeName: string;
    property: string;
    rawHex: string;
    match: {
      tokenId: string;
      tokenName: string;
      tokenSource: string;
      collectionName: string;
      hex: string;
      distance: number;
      confidence: string;
    } | null;
  };
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

interface TextIssueRowProps {
  kind: 'text';
  issue: {
    id: string;
    nodeId: string;
    nodeName: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    suggestedStyleName: string | null;
    confidence: string | null;
  };
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

type Props = ColorIssueRowProps | TextIssueRowProps;

const confidenceColors: Record<string, string> = {
  exact: 'var(--mt-color-confidence-exact)',
  high: 'var(--mt-color-confidence-high)',
  medium: 'var(--mt-color-confidence-medium)',
  low: 'var(--mt-color-confidence-low)',
};

const confidenceLabels: Record<string, string> = {
  exact: 'Exact',
  high: 'High',
  medium: 'Med',
  low: 'Low',
};

export function IssueRow(props: Props) {
  const { issue, selected, onToggle, onSelect } = props;
  const confidence = props.kind === 'color' ? props.issue.match?.confidence : props.issue.confidence;
  // Colors: only exact/high (to avoid changing visible color)
  // Text: any confidence is fine (applying a text style is safe)
  const hasMatch = props.kind === 'color' ? !!props.issue.match : !!props.issue.suggestedStyleName;
  const canLink = props.kind === 'text'
    ? hasMatch
    : (confidence === 'exact' || confidence === 'high');

  return (
    <div className={`issue-row ${selected ? 'issue-row--selected' : ''}`}>
      {/* Checkbox — only show if there's a match to link */}
      <div className="issue-row-check">
        {canLink ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="issue-checkbox"
          />
        ) : (
          <span className="issue-no-match-dot" title={confidence ? 'Low confidence — linking would change color' : 'No matching token found'} />
        )}
      </div>

      {/* Main content — click to navigate to node */}
      <div className="issue-row-main" onClick={onSelect} title="Click to select in canvas">
        <div className="issue-node-name" title={issue.nodeName}>{issue.nodeName}</div>

        {props.kind === 'color' ? (
          <div className="issue-detail">
            <ColorSwatch hex={props.issue.rawHex} />
            <span className="issue-hex">{props.issue.rawHex}</span>
            <span className="issue-property">{props.issue.property}</span>

            {props.issue.match && (
              <>
                <span className="issue-arrow">&rarr;</span>
                <ColorSwatch hex={props.issue.match.hex} />
                <span className="issue-match-name">{props.issue.match.tokenName}</span>
              </>
            )}
          </div>
        ) : (
          <div className="issue-detail">
            <span className="issue-text-info">
              {props.issue.fontFamily} {props.issue.fontWeight} {props.issue.fontSize}px
            </span>
            {props.issue.suggestedStyleName && (
              <>
                <span className="issue-arrow">&rarr;</span>
                <span className="issue-match-name">{props.issue.suggestedStyleName}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Confidence badge */}
      {confidence && (
        <span
          className="confidence-badge"
          style={{ backgroundColor: confidenceColors[confidence] || '#999' }}
        >
          {confidenceLabels[confidence] || confidence}
        </span>
      )}
    </div>
  );
}
