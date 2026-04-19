/**
 * Extract a Figma file key and file name from a URL or raw key string.
 *
 * Supported formats:
 *   https://www.figma.com/design/AbC123xYz/My-Design-System
 *   https://figma.com/file/AbC123xYz/My-Design-System
 *   https://www.figma.com/design/AbC123xYz/branch/BranchKey/My-Design-System  → uses BranchKey
 *   AbC123xYz  (raw key, returned as-is with empty label)
 */
export function extractFileInfo(input: string): { key: string; label: string } {
  var trimmed = input.trim();
  if (!trimmed) return { key: '', label: '' };

  // Try to parse as URL
  try {
    var url = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed);
    if (url.hostname === 'figma.com' || url.hostname === 'www.figma.com') {
      var parts = url.pathname.split('/').filter(Boolean);
      // /design/:fileKey/:fileName or /file/:fileKey/:fileName
      if ((parts[0] === 'design' || parts[0] === 'file') && parts[1]) {
        // Check for branch: /design/:fileKey/branch/:branchKey/:fileName
        if (parts[2] === 'branch' && parts[3]) {
          var branchName = parts[4] ? decodeURIComponent(parts[4]).replace(/-/g, ' ') : '';
          return { key: parts[3], label: branchName };
        }
        var fileName = parts[2] ? decodeURIComponent(parts[2]).replace(/-/g, ' ') : '';
        return { key: parts[1], label: fileName };
      }
    }
  } catch (e) {
    // Not a valid URL — treat as raw key
  }

  // Return as-is (raw key, no label)
  return { key: trimmed, label: '' };
}

/** Convenience: extract just the key. */
export function extractFileKey(input: string): string {
  return extractFileInfo(input).key;
}
