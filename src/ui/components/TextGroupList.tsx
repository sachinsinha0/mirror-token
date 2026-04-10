import React from 'react';
import { TextGroupRow } from './TextGroupRow';

interface TextGroup {
  key: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  nodeIds: string[];
  count: number;
  suggestedStyleName: string | null;
  suggestedStyleId: string | null;
}

interface Props {
  groups: TextGroup[];
  onSelectGroup: (nodeIds: string[]) => void;
}

export function TextGroupList({ groups, onSelectGroup }: Props) {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#10003;</div>
        <div className="empty-state-text">All text is linked!</div>
      </div>
    );
  }

  var totalNodes = 0;
  for (var i = 0; i < groups.length; i++) { totalNodes += groups[i].count; }

  return (
    <div className="text-group-container">
      <div className="text-group-header">
        {groups.length} unique font groups ({totalNodes} nodes)
      </div>
      <div className="text-group-list">
        {groups.map((g) => (
          <TextGroupRow
            key={g.key}
            fontFamily={g.fontFamily}
            fontWeight={g.fontWeight}
            fontSize={g.fontSize}
            count={g.count}
            suggestedStyleName={g.suggestedStyleName}
            onSelect={() => onSelectGroup(g.nodeIds)}
          />
        ))}
      </div>
      <div className="text-group-footer">
        Click <strong>Select</strong> to highlight nodes on canvas, then apply a text style from Figma's Design panel.
      </div>
    </div>
  );
}
