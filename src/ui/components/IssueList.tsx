import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { IssueRow } from './IssueRow';
import { TabId } from './CategoryTabs';
import { ColorIssue, TextIssue } from '../../shared/types';

interface Props {
  colorIssues: ColorIssue[];
  textIssues: TextIssue[];
  activeTab: TabId;
  selectedIds: Set<string>;
  onToggleSelect: (issueId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

type ListItem =
  | { kind: 'color'; issue: ColorIssue }
  | { kind: 'text'; issue: TextIssue };

const ROW_HEIGHT = 54;
const OVERSCAN = 5;

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

  const items: ListItem[] = useMemo(() => {
    const list: ListItem[] = [];
    if (showColors) {
      for (const issue of colorIssues) list.push({ kind: 'color', issue });
    }
    if (showText) {
      for (const issue of textIssues) list.push({ kind: 'text', issue });
    }
    return list;
  }, [colorIssues, textIssues, showColors, showText]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) setScrollTop(containerRef.current.scrollTop);
  }, []);

  if (items.length === 0) {
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

  // Virtual windowing: only render visible rows
  const totalHeight = items.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);

  const visibleItems = [];
  for (let i = startIndex; i < endIndex; i++) {
    const item = items[i];
    visibleItems.push(
      <div key={item.issue.id} style={{ position: 'absolute', top: i * ROW_HEIGHT, width: '100%', height: ROW_HEIGHT }}>
        <IssueRow
          kind={item.kind}
          issue={item.issue as any}
          selected={selectedIds.has(item.issue.id)}
          onToggle={() => onToggleSelect(item.issue.id)}
          onSelect={() => onSelectNode(item.issue.nodeId)}
        />
      </div>
    );
  }

  return (
    <div className="issue-list" ref={containerRef} onScroll={handleScroll}>
      <div style={{ position: 'relative', height: totalHeight }}>
        {visibleItems}
      </div>
    </div>
  );
}
