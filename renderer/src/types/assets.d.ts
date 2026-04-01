declare module '*.png' {
  const value: string;
  export default value;
}

declare module '@plussub/srt-vtt-parser' {
  export function parse(content: string): { entries: Array<{ id: string; from: number; to: number; text: string }> };
}
