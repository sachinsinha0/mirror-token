import React, { useState, useMemo } from 'react';
import { TextGroupRow } from './TextGroupRow';
import { TextGroup } from '../../shared/types';

interface AvailableStyle {
  id: string;
  name: string;
  fontSize: number;
  fontWeight: number;
}

interface Props {
  groups: TextGroup[];
  availableStyles: AvailableStyle[];
  onSelectGroup: (nodeIds: string[]) => void;
  onApplyStyle?: (nodeIds: string[], textStyleId: string) => void;
  onApplyAll?: (assignments: Array<{ nodeIds: string[]; textStyleId: string }>) => void;
}

export function TextGroupList({ groups, availableStyles, onSelectGroup, onApplyStyle, onApplyAll }: Props) {
  // Per-group chosen style id, keyed by group.key. Seeded with suggested id.
  const initialChoices = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of groups) map[g.key] = g.suggestedStyleId || '';
    return map;
  }, [groups]);

  const [choices, setChoices] = useState<Record<string, string>>(initialChoices);

  // Resync when groups change (new scan)
  React.useEffect(() => { setChoices(initialChoices); }, [initialChoices]);

  const updateChoice = (key: string, styleId: string) => {
    setChoices((prev) => ({ ...prev, [key]: styleId }));
  };

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#10003;</div>
        <div className="empty-state-text">All text is linked!</div>
      </div>
    );
  }

  var totalNodes = 0;
  var groupsWithChoice = 0;
  for (var i = 0; i < groups.length; i++) {
    totalNodes += groups[i].count;
    if (choices[groups[i].key]) groupsWithChoice++;
  }

  const handleApplyAll = () => {
    if (!onApplyAll) return;
    const assignments: Array<{ nodeIds: string[]; textStyleId: string }> = [];
    for (const g of groups) {
      const styleId = choices[g.key];
      if (styleId) assignments.push({ nodeIds: g.nodeIds, textStyleId: styleId });
    }
    if (assignments.length > 0) onApplyAll(assignments);
  };

  return (
    <div className="text-group-container">
      <div className="text-group-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>{groups.length} unique font groups ({totalNodes} nodes)</span>
        {onApplyAll && groupsWithChoice > 0 && (
          <button
            className="btn btn--fix"
            onClick={handleApplyAll}
            title={'Apply suggested/chosen style to all ' + groupsWithChoice + ' group' + (groupsWithChoice !== 1 ? 's' : '')}
            style={{ fontSize: 10 }}
          >
            Apply All ({groupsWithChoice})
          </button>
        )}
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
            chosenStyleId={choices[g.key] || ''}
            availableStyles={availableStyles}
            onChangeStyle={(styleId) => updateChoice(g.key, styleId)}
            onSelect={() => onSelectGroup(g.nodeIds)}
            onApplyStyle={onApplyStyle ? (styleId) => onApplyStyle(g.nodeIds, styleId) : undefined}
          />
        ))}
      </div>
      <div className="text-group-footer">
        Pick a style from the dropdown if suggestion is wrong. <strong>Apply</strong> links one group. <strong>Apply All</strong> links every group at once.
      </div>
    </div>
  );
}
