/**
 * Parsing helpers for MediaProbeError failures that crossed the IPC boundary.
 * The main process embeds a stable code as a "[CODE]" message prefix (and
 * attaches it as an enumerable prop where Electron preserves it), because
 * IPC Error serialization is not guaranteed to keep custom properties.
 */

export type ProbeErrorCode =
  | 'FFMPEG_NOT_READY'
  | 'FFPROBE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'INVALID_DATA'
  | 'KILLED_BY_SIGNAL'
  | 'SPAWN_ERROR'
  | 'PROBE_FAILED';

const FATAL_PROBE_CODES: ProbeErrorCode[] = [
  'FFMPEG_NOT_READY',
  'FFPROBE_NOT_FOUND',
  'KILLED_BY_SIGNAL',
  'SPAWN_ERROR'
];

export interface ParsedProbeError {
  code: ProbeErrorCode | null;
  /** True when the failure is environmental (missing/blocked binary) rather
   * than file-specific — affects every file and warrants full diagnostics. */
  fatal: boolean;
  /** The full message including the diagnostics block, for copy/paste. */
  fullMessage: string;
}

export function parseProbeError(error: unknown): ParsedProbeError {
  const err = error as any;
  const raw: string = typeof err?.message === 'string' ? err.message : String(error);
  const code = typeof err?.code === 'string' && isValidCode(err.code)
    ? err.code as ProbeErrorCode
    : extractCodeFromMessage(raw);
  return {
    code,
    fatal: code !== null && (FATAL_PROBE_CODES as string[]).includes(code),
    fullMessage: raw
  };
}

function isValidCode(value: string): boolean {
  return /^[A-Z_]+$/.test(value) && value.includes('_');
}

function extractCodeFromMessage(message: string): ProbeErrorCode | null {
  const match = message.match(/^\[([A-Z_]+)\]/);
  return match && (FATAL_PROBE_CODES as string[]).concat([
    'PERMISSION_DENIED', 'FILE_NOT_FOUND', 'INVALID_DATA', 'PROBE_FAILED'
  ]).includes(match[1])
    ? match[1] as ProbeErrorCode
    : null;
}
