// Subtitle parser utility to extract text content from various subtitle formats

export interface ParsedSubtitle {
  text: string;
  characterCount: number;
  wordCount: number;
  lineCount: number;
}

export interface SubtitleEntry {
  start: string;
  end: string;
  text: string;
}

/**
 * Parse SRT (SubRip) format subtitles
 */
function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    // Skip the sequence number (first line)
    const timeLine = lines[1];
    const textLines = lines.slice(2);
    
    // Parse timestamp line (e.g., "00:00:01,000 --> 00:00:04,000")
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (timeMatch) {
      entries.push({
        start: timeMatch[1],
        end: timeMatch[2],
        text: textLines.join(' ').trim()
      });
    }
  }
  
  return entries;
}

/**
 * Parse VTT (WebVTT) format subtitles
 */
function parseVTT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const lines = content.split('\n');
  let i = 0;
  
  // Skip header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Look for timestamp line (e.g., "00:00:01.000 --> 00:00:04.000")
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timeMatch) {
      const start = timeMatch[1];
      const end = timeMatch[2];
      
      i++;
      const textLines: string[] = [];
      
      // Collect text lines until empty line or next timestamp
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        textLines.push(lines[i].trim());
        i++;
      }
      
      if (textLines.length > 0) {
        entries.push({
          start,
          end,
          text: textLines.join(' ').trim()
        });
      }
    } else {
      i++;
    }
  }
  
  return entries;
}

/**
 * Parse ASS/SSA format subtitles
 */
function parseASS(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Look for dialogue lines (Format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text)
    if (trimmedLine.startsWith('Dialogue:')) {
      const parts = trimmedLine.split(',');
      if (parts.length >= 10) {
        const start = parts[1].trim();
        const end = parts[2].trim();
        const text = parts.slice(9).join(',').trim();
        
        // Remove ASS formatting tags (e.g., {\an8}, {\c&H00FF00&})
        const cleanText = text.replace(/\{[^}]*\}/g, '').trim();
        
        if (cleanText) {
          entries.push({
            start,
            end,
            text: cleanText
          });
        }
      }
    }
  }
  
  return entries;
}

/**
 * Clean subtitle text by removing HTML tags and formatting
 */
function cleanSubtitleText(text: string): string {
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove formatting markers
    .replace(/\{[^}]*\}/g, '')
    // Remove speaker names in brackets
    .replace(/^\[.*?\]\s*/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse subtitle file and extract text content
 */
export function parseSubtitleFile(content: string, fileName: string): ParsedSubtitle {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  let entries: SubtitleEntry[] = [];
  
  try {
    switch (extension) {
      case 'srt':
        entries = parseSRT(content);
        break;
      case 'vtt':
        entries = parseVTT(content);
        break;
      case 'ass':
      case 'ssa':
        entries = parseASS(content);
        break;
      default:
        // Try to auto-detect format
        if (content.includes('WEBVTT')) {
          entries = parseVTT(content);
        } else if (content.includes('--&gt;') || content.includes('-->')) {
          entries = parseSRT(content);
        } else if (content.includes('[Script Info]') || content.includes('Dialogue:')) {
          entries = parseASS(content);
        } else {
          // Fallback: treat as plain text
          return {
            text: content.trim(),
            characterCount: content.trim().length,
            wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
            lineCount: content.trim().split('\n').length
          };
        }
        break;
    }
    
    // Extract and clean all text
    const allText = entries
      .map(entry => cleanSubtitleText(entry.text))
      .filter(text => text.length > 0)
      .join(' ');
    
    const words = allText.split(/\s+/).filter(word => word.length > 0);
    const lines = entries.length;
    
    return {
      text: allText,
      characterCount: allText.length,
      wordCount: words.length,
      lineCount: lines
    };
    
  } catch (error) {
    console.error('Error parsing subtitle file:', error);
    
    // Fallback: return basic text statistics
    return {
      text: content.trim(),
      characterCount: content.trim().length,
      wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
      lineCount: content.trim().split('\n').length
    };
  }
}

/**
 * Format duration from seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
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

/**
 * Format character count with thousands separators
 */
export function formatCharacterCount(count: number): string {
  return count.toLocaleString();
}