// Subtitle parser utility powered by subsrt-ts
import subsrt from 'subsrt-ts';
import type { ContentCaption } from 'subsrt-ts/dist/types/handler';

export interface ParsedSubtitle {
  text: string;
  characterCount: number;
  wordCount: number;
  lineCount: number;
}

export interface SubtitleEntry {
  start: number;  // milliseconds
  end: number;    // milliseconds
  text: string;
}

function getFormatOption(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const formatMap: Record<string, string> = {
    srt: 'srt',
    vtt: 'vtt',
    ass: 'ass',
    ssa: 'ssa',
    sub: 'sub',
    sbv: 'sbv',
    lrc: 'lrc',
  };
  return formatMap[ext] || 'srt';
}

function parseContent(content: string, fileName: string): ContentCaption[] {
  const format = getFormatOption(fileName);
  const captions = subsrt.parse(content, { format });
  return captions.filter((c): c is ContentCaption => c.type === 'caption');
}

export function parseSubtitleEntries(content: string, fileName: string): SubtitleEntry[] {
  try {
    return parseContent(content, fileName).map(c => ({
      start: c.start,
      end: c.end,
      text: c.text || c.content || '',
    }));
  } catch (error) {
    console.error('Error parsing subtitle entries:', error);
    return [];
  }
}

export function detectSubtitleFormat(_content: string, fileName: string): string {
  const ext = getFormatOption(fileName);
  return ext.toUpperCase();
}

function cleanSubtitleText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/^\[.*?\]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSubtitleFile(content: string, fileName: string): ParsedSubtitle {
  try {
    const captions = parseContent(content, fileName);

    if (captions.length === 0) {
      return {
        text: content.trim(),
        characterCount: content.trim().length,
        wordCount: content.trim().split(/\s+/).filter(w => w.length > 0).length,
        lineCount: content.trim().split('\n').length,
      };
    }

    const allText = captions
      .map(c => cleanSubtitleText(c.text || c.content || ''))
      .filter(t => t.length > 0)
      .join(' ');
    const words = allText.split(/\s+/).filter(w => w.length > 0);

    return { text: allText, characterCount: allText.length, wordCount: words.length, lineCount: captions.length };
  } catch (error) {
    console.error('Error parsing subtitle file:', error);
    return {
      text: content.trim(),
      characterCount: content.trim().length,
      wordCount: content.trim().split(/\s+/).filter(w => w.length > 0).length,
      lineCount: content.trim().split('\n').length,
    };
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    return `${hours}h ${mins}m ${secs}s`;
  }
}

export function formatCharacterCount(count: number): string {
  return count.toLocaleString();
}
