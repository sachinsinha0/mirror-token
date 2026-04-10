import React from 'react';

export type TabId = 'colors' | 'text' | 'all';

interface Props {
  active: TabId;
  colorCount: number;
  textCount: number;
  onChange: (tab: TabId) => void;
}

export function CategoryTabs({ active, colorCount, textCount, onChange }: Props) {
  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: colorCount + textCount },
    { id: 'colors', label: 'Colors', count: colorCount },
    { id: 'text', label: 'Text', count: textCount },
  ];

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${active === tab.id ? 'tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          <span className="tab-badge">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
