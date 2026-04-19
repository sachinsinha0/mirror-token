import React, { useEffect, useRef } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-panel"
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-title" id="confirm-title">{title}</div>
        <div className="confirm-text" id="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
