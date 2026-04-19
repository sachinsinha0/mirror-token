// Re-export all shared types so existing plugin imports continue to work.
export type {
  RGBA,
  ColorToken,
  Confidence,
  ColorMatch,
  ColorIssue,
  TypographyGroup,
  TextIssue,
  TextGroup,
  ScanResults,
  LibraryEntry,
  UIMessage,
  PluginMessage,
} from '../shared/types';
