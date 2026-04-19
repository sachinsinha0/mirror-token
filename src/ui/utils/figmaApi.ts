/**
 * Fetch published text styles from Figma library files via the REST API.
 * This runs in the UI iframe (which has network access).
 */

import { LibraryEntry } from '../../shared/types';

export interface TextStyleKey {
  key: string;
  name: string;
  description: string;
}

async function fetchStylesFromFile(
  fileKey: string,
  apiToken: string
): Promise<TextStyleKey[]> {
  var url = 'https://api.figma.com/v1/files/' + fileKey + '/styles';

  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, 15000);

  var res: Response;
  try {
    res = await fetch(url, {
      headers: { 'X-FIGMA-TOKEN': apiToken },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    var errorText = await res.text().catch(function() { return ''; });
    throw new Error('Figma API error ' + res.status + ': ' + errorText);
  }

  var data = await res.json();

  if (!data || !data.meta || !data.meta.styles) {
    throw new Error('Unexpected API response format');
  }

  // Filter for TEXT styles only
  var textStyles: TextStyleKey[] = [];
  for (var i = 0; i < data.meta.styles.length; i++) {
    var style = data.meta.styles[i];
    if (style.style_type === 'TEXT') {
      textStyles.push({
        key: style.key,
        name: style.name,
        description: style.description || '',
      });
    }
  }

  return textStyles;
}

/**
 * Fetch text styles from a single library file.
 */
export async function fetchLibraryTextStyles(
  fileKey: string,
  apiToken: string
): Promise<TextStyleKey[]> {
  return fetchStylesFromFile(fileKey, apiToken);
}

/**
 * Fetch text styles from multiple library files and merge results.
 * Deduplicates by style key.
 */
export async function fetchMultiLibraryTextStyles(
  libraries: LibraryEntry[],
  apiToken: string
): Promise<TextStyleKey[]> {
  var allStyles: TextStyleKey[] = [];
  var seenKeys = new Set<string>();

  for (var i = 0; i < libraries.length; i++) {
    if (!libraries[i].key) continue;
    try {
      var styles = await fetchStylesFromFile(libraries[i].key, apiToken);
      for (var j = 0; j < styles.length; j++) {
        if (!seenKeys.has(styles[j].key)) {
          seenKeys.add(styles[j].key);
          allStyles.push(styles[j]);
        }
      }
    } catch (err) {
      console.error('[Mirror Link] Failed to fetch from library "' + libraries[i].label + '" (' + libraries[i].key + '):', err);
    }
  }

  return allStyles;
}
