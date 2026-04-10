import React from 'react';

interface Props {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  count: number;
  suggestedStyleName: string | null;
  onSelect: () => void;
}

export function TextGroupRow({
  fontFamily, fontWeight, fontSize, count,
  suggestedStyleName, onSelect,
}: Props) {
  return (
    <div className="text-group-row">
      <div className="text-group-left">
        <div className="text-group-font">
          {fontFamily} {fontWeight} {fontSize}px
        </div>
        <div className="text-group-meta">
          <span className="text-group-count">{count} node{count !== 1 ? 's' : ''}</span>
          {suggestedStyleName && (
            <span className="text-group-hint">&rarr; {suggestedStyleName}</span>
          )}
        </div>
      </div>
      <button className="btn btn--select-group" onClick={onSelect}>
        Select
      </button>
    </div>
  );
}
