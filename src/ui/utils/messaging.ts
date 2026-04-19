import { UIMessage, PluginMessage } from '../../shared/types';

/** Post a typed message from UI to plugin */
export function postToPlugin(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

/** Listen for messages from plugin */
export function onPluginMessage(handler: (msg: PluginMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    if (event.data?.pluginMessage) {
      handler(event.data.pluginMessage);
    }
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
