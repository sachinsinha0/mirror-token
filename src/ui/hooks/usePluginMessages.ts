import { useState, useEffect, useCallback } from 'react';
import { ScanResults, PluginMessage, UIMessage } from '../../shared/types';
import { onPluginMessage, postToPlugin } from '../utils/messaging';

type Status = 'idle' | 'scanning' | 'loading' | 'fixing' | 'done' | 'error';

export function usePluginMessages() {
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<ScanResults | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [fixResult, setFixResult] = useState<{ fixed: number; failed: number } | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const unsub = onPluginMessage((msg: PluginMessage) => {
      switch (msg.type) {
        case 'scan-started':
          setStatus('loading');
          setLoadingMessage('Loading design system tokens...');
          setProgress({ done: 0, total: msg.totalNodes });
          setFixResult(null);
          setErrorMessage('');
          break;
        case 'loading-tokens':
          setStatus('loading');
          setLoadingMessage(msg.message || 'Loading...');
          break;
        case 'scan-progress':
          setStatus('scanning');
          setProgress({ done: msg.processed, total: msg.total });
          break;
        case 'scan-complete':
          setStatus('done');
          setResults(msg.results);
          break;
        case 'fix-started':
          setStatus('fixing');
          setProgress({ done: 0, total: msg.total });
          break;
        case 'fix-progress':
          setProgress({ done: msg.done, total: msg.total });
          break;
        case 'fix-complete':
          setFixResult({ fixed: msg.fixed, failed: msg.failed });
          setStatus('done');
          break;
        case 'scan-error':
          setStatus('error');
          setErrorMessage(msg.message);
          break;
        case 'debug-log':
          setDebugLines(msg.lines || []);
          break;
      }
    });
    return unsub;
  }, []);

  const scan = useCallback((scope: 'page' | 'selection', textStyleKeys?: Array<{ key: string; name: string }>) => {
    postToPlugin({ type: 'scan', scope: scope, textStyleKeys: textStyleKeys } as UIMessage);
  }, []);

  const linkSelected = useCallback((colorIssueIds: string[], textIssueIds: string[]) => {
    postToPlugin({ type: 'link-selected', colorIssueIds, textIssueIds } as UIMessage);
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    postToPlugin({ type: 'select-node', nodeId } as UIMessage);
  }, []);

  return {
    status,
    results,
    progress,
    fixResult,
    debugLines,
    loadingMessage,
    errorMessage,
    scan,
    linkSelected,
    selectNode,
  };
}
