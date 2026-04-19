import React, { useState } from 'react';
import { LibraryEntry } from '../../shared/types';
import { extractFileInfo } from '../utils/extractFileKey';

interface Props {
  apiToken: string;
  libraryFileKeys: LibraryEntry[];
  onSave: (apiToken: string, libraryFileKeys: LibraryEntry[]) => void;
  onClose: () => void;
}

interface LibraryInput {
  raw: string;   // what user typed (URL or key)
  label: string; // auto-extracted or existing label
}

function toInputs(entries: LibraryEntry[]): LibraryInput[] {
  if (entries.length === 0) return [{ raw: '', label: '' }];
  return entries.map((e) => ({ raw: e.key, label: e.label }));
}

export function Settings({ apiToken, libraryFileKeys, onSave, onClose }: Props) {
  const [token, setToken] = useState(apiToken);
  const [libraries, setLibraries] = useState<LibraryInput[]>(toInputs(libraryFileKeys));

  const handleSave = () => {
    const cleaned: LibraryEntry[] = [];
    for (const lib of libraries) {
      const info = extractFileInfo(lib.raw);
      if (info.key) {
        cleaned.push({ key: info.key, label: info.label || lib.label || 'Library' });
      }
    }
    onSave(token.trim(), cleaned);
    onClose();
  };

  const updateLibraryUrl = (index: number, value: string) => {
    setLibraries((prev) => {
      const next = prev.slice();
      const info = extractFileInfo(value);
      next[index] = { raw: value, label: info.label || prev[index].label };
      return next;
    });
  };

  const addLibrary = () => {
    setLibraries((prev) => [...prev, { raw: '', label: '' }]);
  };

  const removeLibrary = (index: number) => {
    setLibraries((prev) => prev.filter((_, i) => i !== index));
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
              Generate at figma.com/settings &rarr; Personal Access Tokens.
              Required to load text styles from design system libraries.
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">Design System Libraries</label>
            <div className="settings-hint" style={{ marginBottom: 8 }}>
              Paste the Figma URL of each library file. The name is extracted automatically.
            </div>

            {libraries.map((lib, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="settings-input"
                    style={{ flex: 1 }}
                    value={lib.raw}
                    onChange={(e) => updateLibraryUrl(i, e.target.value)}
                    placeholder="https://figma.com/design/..."
                  />
                  {libraries.length > 1 && (
                    <button
                      className="btn btn--ghost"
                      onClick={() => removeLibrary(i)}
                      style={{ padding: '4px 6px', fontSize: 12 }}
                      title="Remove library"
                      aria-label="Remove library"
                    >
                      &times;
                    </button>
                  )}
                </div>
                {lib.label && (
                  <div style={{ fontSize: 10, color: 'var(--figma-color-text-secondary, #999)', marginTop: 3, paddingLeft: 2 }}>
                    {lib.label}
                  </div>
                )}
              </div>
            ))}

            <button
              className="btn btn--secondary"
              onClick={addLibrary}
              style={{ fontSize: 11, marginTop: 4 }}
            >
              + Add Library
            </button>
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
