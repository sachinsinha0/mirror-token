import { describe, it, expect } from 'vitest';
import { extractFileKey, extractFileInfo } from '../utils/extractFileKey';

describe('extractFileKey', () => {
  it('extracts key from figma.com/design/ URL', () => {
    expect(extractFileKey('https://www.figma.com/design/AbC123xYz/My-File')).toBe('AbC123xYz');
  });

  it('extracts key from figma.com/file/ URL', () => {
    expect(extractFileKey('https://figma.com/file/AbC123xYz/My-File')).toBe('AbC123xYz');
  });

  it('extracts branch key from branch URL', () => {
    expect(extractFileKey('https://www.figma.com/design/AbC123xYz/branch/BranchKey99/My-File')).toBe('BranchKey99');
  });

  it('handles URL without https://', () => {
    expect(extractFileKey('figma.com/design/AbC123xYz/My-File')).toBe('AbC123xYz');
  });

  it('handles URL with query params', () => {
    expect(extractFileKey('https://figma.com/design/AbC123xYz/My-File?node-id=1-2')).toBe('AbC123xYz');
  });

  it('returns raw key as-is', () => {
    expect(extractFileKey('AbC123xYz')).toBe('AbC123xYz');
  });

  it('trims whitespace', () => {
    expect(extractFileKey('  AbC123xYz  ')).toBe('AbC123xYz');
  });

  it('returns empty string for empty input', () => {
    expect(extractFileKey('')).toBe('');
    expect(extractFileKey('   ')).toBe('');
  });
});

describe('extractFileInfo', () => {
  it('extracts key and label from design URL', () => {
    var info = extractFileInfo('https://figma.com/design/AbC123xYz/My-Design-System');
    expect(info.key).toBe('AbC123xYz');
    expect(info.label).toBe('My Design System');
  });

  it('extracts key and label from file URL', () => {
    var info = extractFileInfo('https://figma.com/file/AbC123xYz/Olympus-Tokens');
    expect(info.key).toBe('AbC123xYz');
    expect(info.label).toBe('Olympus Tokens');
  });

  it('extracts branch key and label from branch URL', () => {
    var info = extractFileInfo('https://figma.com/design/AbC123xYz/branch/BrK/Dark-Theme');
    expect(info.key).toBe('BrK');
    expect(info.label).toBe('Dark Theme');
  });

  it('decodes URL-encoded file names', () => {
    var info = extractFileInfo('https://figma.com/design/AbC123xYz/My%20Design%20System');
    expect(info.label).toBe('My Design System');
  });

  it('returns empty label for raw key', () => {
    var info = extractFileInfo('AbC123xYz');
    expect(info.key).toBe('AbC123xYz');
    expect(info.label).toBe('');
  });

  it('returns empty key and label for empty input', () => {
    var info = extractFileInfo('');
    expect(info.key).toBe('');
    expect(info.label).toBe('');
  });

  it('handles URL with only key and no file name', () => {
    var info = extractFileInfo('https://figma.com/design/AbC123xYz');
    expect(info.key).toBe('AbC123xYz');
    expect(info.label).toBe('');
  });
});
