import React from 'react';

interface AvailableStyle {
  id: string;
  name: string;
  fontSize: number;
  fontWeight: number;
}

interface Props {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  count: number;
  suggestedStyleName: string | null;
  chosenStyleId: string;
  availableStyles: AvailableStyle[];
  onChangeStyle: (styleId: string) => void;
  onSelect: () => void;
  onApplyStyle?: (textStyleId: string) => void;
}

export function TextGroupRow({
  fontFamily, fontWeight, fontSize, count,
  suggestedStyleName, chosenStyleId, availableStyles,
  onChangeStyle, onSelect, onApplyStyle,
}: Props) {
  const chosenStyle = availableStyles.find((s) => s.id === chosenStyleId);
  const displayName = chosenStyle?.name || suggestedStyleName;

  return (
    <div className="text-group-row">
      <div className="text-group-left">
        <div className="text-group-font">
          {fontFamily} {fontWeight} {fontSize}px
        </div>
        <div className="text-group-meta" style={{ flexWrap: 'wrap' }}>
          <span className="text-group-count">{count} node{count !== 1 ? 's' : ''}</span>
          {availableStyles.length > 0 ? (
            <span className="text-group-picker">
              &rarr;{' '}
              <select
                className="text-group-select"
                value={chosenStyleId}
                onChange={(e) => onChangeStyle(e.target.value)}
                aria-label="Choose text style"
                onClick={(e) => e.stopPropagation()}
              >
                {!chosenStyleId && <option value="">(pick a style)</option>}
                {availableStyles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.fontSize}px
                  </option>
                ))}
              </select>
            </span>
          ) : displayName ? (
            <span className="text-group-hint">&rarr; {displayName}</span>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button className="btn btn--select-group" onClick={onSelect}>
          Select
        </button>
        {chosenStyleId && onApplyStyle && (
          <button
            className="btn btn--fix"
            onClick={() => onApplyStyle(chosenStyleId)}
            title={'Apply "' + displayName + '" to ' + count + ' node' + (count !== 1 ? 's' : '')}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}
