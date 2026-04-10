import React from 'react';

interface Props {
  message: string;
}

export function EmptyState({ message }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">&#10003;</div>
      <div className="empty-state-text">{message}</div>
    </div>
  );
}
