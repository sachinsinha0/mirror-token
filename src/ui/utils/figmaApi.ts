/**
 * Fetch published text styles from a Figma library file via the REST API.
 * This runs in the UI iframe (which has network access).
 */

export interface TextStyleKey {
  key: string;
  name: string;
  description: string;
}

export async function fetchLibraryTextStyles(
  fileKey: string,
  apiToken: string
): Promise<TextStyleKey[]> {
  const url = 'https://api.figma.com/v1/files/' + fileKey + '/styles';

  const res = await fetch(url, {
    headers: {
      'X-FIGMA-TOKEN': apiToken,
    },
  });

  if (!res.ok) {
    var errorText = await res.text().catch(function() { return ''; });
    throw new Error('Figma API error ' + res.status + ': ' + errorText);
  }

  const data = await res.json();

  if (!data || !data.meta || !data.meta.styles) {
    throw new Error('Unexpected API response format');
  }

  // Filter for TEXT styles only
  const textStyles: TextStyleKey[] = [];
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
