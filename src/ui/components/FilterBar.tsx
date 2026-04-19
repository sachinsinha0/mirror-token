import React from 'react';

export type SortMode = 'default' | 'name-asc' | 'confidence-desc';
export type ConfidenceFilter = 'all' | 'matched' | 'unmatched';

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  sort: SortMode;
  onSortChange: (val: SortMode) => void;
  confidenceFilter: ConfidenceFilter;
  onConfidenceFilterChange: (val: ConfidenceFilter) => void;
  visibleCount: number;
  totalCount: number;
}

export function FilterBar({
  search, onSearchChange,
  sort, onSortChange,
  confidenceFilter, onConfidenceFilterChange,
  visibleCount, totalCount,
}: Props) {
  return (
    <div className="filter-bar">
      <input
        type="text"
        className="filter-search"
        placeholder="Search nodes..."
        aria-label="Search nodes by name"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="filter-select"
        aria-label="Filter by match status"
        value={confidenceFilter}
        onChange={(e) => onConfidenceFilterChange(e.target.value as ConfidenceFilter)}
      >
        <option value="all">All</option>
        <option value="matched">Matched</option>
        <option value="unmatched">No match</option>
      </select>
      <select
        className="filter-select"
        aria-label="Sort order"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortMode)}
      >
        <option value="default">Default</option>
        <option value="name-asc">Name A-Z</option>
        <option value="confidence-desc">Confidence</option>
      </select>
      {visibleCount !== totalCount && (
        <span className="filter-count">{visibleCount}/{totalCount}</span>
      )}
    </div>
  );
}
