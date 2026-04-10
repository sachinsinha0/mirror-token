import { useState, useEffect, useCallback } from 'react';
import { onPluginMessage, postToPlugin } from '../utils/messaging';

interface ScanResults {
  colorIssues: any[];
  textIssues: any[];
  totalNodesScanned: number;
  totalLinkedTokens: number;
  scanDurationMs: number;
}

type Status = 'idle' | 'scanning' | 'loading' | 'fixing' | 'done';

export function usePluginMessages() {
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<ScanResults | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [fixResult, setFixResult] = useState<{ fixed: number; failed: number } | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    const unsub = onPluginMessage((msg) => {
      switch (msg.type) {
        case 'scan-started':
          setStatus('loading');
          setLoadingMessage('Loading design system tokens...');
          setProgress({ done: 0, total: msg.totalNodes });
          setFixResult(null);
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
        case 'debug-log':
          setDebugLines(msg.lines || []);
          break;
      }
    });
    return unsub;
  }, []);

  const scan = useCallback((scope: 'page' | 'selection', textStyleKeys?: Array<{ key: string; name: string }>) => {
    postToPlugin({ type: 'scan', scope: scope, textStyleKeys: textStyleKeys });
  }, []);

  const fixAll = useCallback((minConfidence: string) => {
    postToPlugin({ type: 'fix-all', minConfidence });
  }, []);

  const linkSelected = useCallback((colorIssueIds: string[], textIssueIds: string[]) => {
    postToPlugin({ type: 'link-selected', colorIssueIds, textIssueIds });
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    postToPlugin({ type: 'select-node', nodeId });
  }, []);

  return {
    status,
    results,
    progress,
    fixResult,
    debugLines,
    loadingMessage,
    scan,
    fixAll,
    linkSelected,
    selectNode,
  };
}
