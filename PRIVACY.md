# Privacy Policy — Mirror Link

## Data Storage

- **API tokens** are stored locally on your machine via Figma's encrypted client storage (`figma.clientStorage`). They are never shared with other file editors or sent to any server other than `api.figma.com`.
- **Library file keys** are stored in Figma plugin data on the document, shared with other editors of the same file. These are non-sensitive identifiers.
- **Scan results** are held in memory during the plugin session and are not persisted.

## Network Access

The plugin makes HTTPS requests only to `api.figma.com` to fetch published text styles from your design system library. Your Figma Personal Access Token is sent as an authentication header (`X-FIGMA-TOKEN`) in these requests.

## No External Data Collection

No data is collected, stored externally, or transmitted to third parties. The plugin runs entirely within Figma's plugin sandbox and your browser.

## File Access

During scanning, the plugin reads node properties (colors, text styles, font sizes) in read mode. During linking, it modifies color variable bindings and text style assignments on nodes you have selected.
