import React, { useState } from 'react';
import { Logo } from './Logo';
import { LibraryEntry } from '../../shared/types';
import { extractFileInfo } from '../utils/extractFileKey';

interface Props {
  onComplete: (apiToken: string, libraryFileKeys: LibraryEntry[]) => void;
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [libraryUrl, setLibraryUrl] = useState('');

  const info = extractFileInfo(libraryUrl);

  const handleFinish = () => {
    const libs: LibraryEntry[] = info.key
      ? [{ key: info.key, label: info.label || 'Library' }]
      : [];
    onComplete(token.trim(), libs);
  };

  return (
    <div className="onboarding">
      {step === 0 && (
        <div className="onboarding-step">
          <Logo size={56} />
          <h2 className="onboarding-title">Welcome to Mirror Link</h2>
          <p className="onboarding-text">
            Scan your Figma designs for unlinked colors and text styles, then link them back to your design system in bulk.
          </p>
          <button className="btn btn--primary onboarding-btn" onClick={() => setStep(1)}>
            Get Started
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-step">
          <div className="onboarding-step-num">Step 1 of 2</div>
          <h2 className="onboarding-title">Figma API Token</h2>
          <p className="onboarding-text">
            A personal access token lets the plugin fetch text styles from your design system library.
          </p>
          <input
            type="password"
            className="settings-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="figd_..."
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div className="settings-hint">
            Generate one at figma.com/settings &rarr; Personal Access Tokens
          </div>
          <div className="onboarding-actions">
            <button className="btn btn--secondary" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn--primary" onClick={() => setStep(2)} disabled={!token.trim()}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-step">
          <div className="onboarding-step-num">Step 2 of 2</div>
          <h2 className="onboarding-title">Design System Library</h2>
          <p className="onboarding-text">
            Paste the Figma URL of your design system library. You can add more later in Settings.
          </p>
          <input
            type="text"
            className="settings-input"
            value={libraryUrl}
            onChange={(e) => setLibraryUrl(e.target.value)}
            placeholder="https://figma.com/design/..."
            style={{ width: '100%', marginBottom: 4 }}
          />
          {info.label && (
            <div style={{ fontSize: 11, color: 'var(--figma-color-text-secondary, #999)', marginBottom: 8 }}>
              {info.label}
            </div>
          )}
          <div className="onboarding-actions">
            <button className="btn btn--secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn--primary" onClick={handleFinish}>
              {libraryUrl.trim() ? 'Save & Start' : 'Skip & Start'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
