import React from 'react';
import { IssueRow } from './IssueRow';
import { TabId } from './CategoryTabs';

interface Props {
  colorIssues: any[];
  textIssues: any[];
  activeTab: TabId;
  selectedIds: Set<string>;
  onToggleSelect: (issueId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export function IssueList({
  colorIssues,
  textIssues,
  activeTab,
  selectedIds,
  onToggleSelect,
  onSelectNode,
}: Props) {
  const showColors = activeTab === 'all' || activeTab === 'colors';
  const showText = activeTab === 'all' || activeTab === 'text';

  const visibleColors = showColors ? colorIssues : [];
  const visibleText = showText ? textIssues : [];

  if (visibleColors.length === 0 && visibleText.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#10003;</div>
        <div className="empty-state-text">
          {activeTab === 'all'
            ? 'All tokens are linked!'
            : `No unlinked ${activeTab} found!`}
        </div>
      </div>
    );
  }

  return (
    <div className="issue-list">
      {visibleColors.map((issue: any) => (
        <IssueRow
          key={issue.id}
          kind="color"
          issue={issue}
          selected={selectedIds.has(issue.id)}
          onToggle={() => onToggleSelect(issue.id)}
          onSelect={() => onSelectNode(issue.nodeId)}
        />
      ))}
      {visibleText.map((issue: any) => (
        <IssueRow
          key={issue.id}
          kind="text"
          issue={issue}
          selected={selectedIds.has(issue.id)}
          onToggle={() => onToggleSelect(issue.id)}
          onSelect={() => onSelectNode(issue.nodeId)}
        />
      ))}
    </div>
  );
}
