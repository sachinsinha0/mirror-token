import React from 'react';

interface Props {
  selectedCount: number;
  totalFixable: number;
  onLinkSelected: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  allSelected: boolean;
  onExport: () => void;
  disabled: boolean;
}

export function BulkActions({
  selectedCount,
  totalFixable,
  onLinkSelected,
  onSelectAll,
  onDeselectAll,
  allSelected,
  onExport,
  disabled,
}: Props) {
  if (totalFixable === 0) return null;

  return (
    <div className="bulk-actions">
      <div className="bulk-actions-left">
        <button
          className="btn btn--select-all"
          onClick={allSelected ? onDeselectAll : onSelectAll}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        <span className="bulk-actions-count">
          {selectedCount} of {totalFixable} selected
        </span>
      </div>
      <div className="bulk-actions-right">
        <button className="btn btn--ghost" onClick={onExport} disabled={disabled}>
          CSV
        </button>
        <button
          className="btn btn--link"
          onClick={onLinkSelected}
          disabled={disabled || selectedCount === 0}
        >
          Link {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
      </div>
    </div>
  );
}
