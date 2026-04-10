import React from 'react';

interface Props {
  done: number;
  total: number;
  label: string;
}

export function ProgressBar({ done, total, label }: Props) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="progress-container">
      <div className="progress-label">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-meta">
        {done} / {total}
      </div>
    </div>
  );
}
