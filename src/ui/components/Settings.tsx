import React, { useState } from 'react';

interface Props {
  apiToken: string;
  libraryFileKey: string;
  onSave: (apiToken: string, libraryFileKey: string) => void;
  onClose: () => void;
}

export function Settings({ apiToken, libraryFileKey, onSave, onClose }: Props) {
  const [token, setToken] = useState(apiToken);
  const [fileKey, setFileKey] = useState(libraryFileKey);

  const handleSave = () => {
    onSave(token.trim(), fileKey.trim());
    onClose();
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>

        <div className="settings-body">
          <div className="settings-field">
            <label className="settings-label">Figma Personal Access Token</label>
            <input
              type="password"
              className="settings-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="figd_..."
            />
            <div className="settings-hint">
              Generate at figma.com/settings → Personal Access Tokens.
              Required to load text styles from the design system library.
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">Library File Key</label>
            <input
              type="text"
              className="settings-input"
              value={fileKey}
              onChange={(e) => setFileKey(e.target.value)}
              placeholder="VCFZJgU9KnGWy7KtxBxSy1"
            />
            <div className="settings-hint">
              The file key from your library's Figma URL:
              figma.com/design/<strong>FILE_KEY</strong>/...
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn--primary" onClick={handleSave} disabled={!token.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
