// Generate filename using the defaultFilenameFormat pattern
export const generateFilename = (
  pattern: string,
  originalFileName: string,
  languageCode: string,
  languageName: string,
  type: 'transcription' | 'translation',
  format: string
): string => {
  const fileNameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
  const extension = format === 'srt' ? 'srt' : format === 'vtt' ? 'vtt' : 'txt';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return pattern
    .replace(/{filename}/g, fileNameWithoutExt)
    .replace(/{timestamp}/g, timestamp)
    .replace(/{type}/g, type)
    .replace(/{format}/g, format)
    .replace(/{language_code}/g, languageCode)
    .replace(/{language_name}/g, languageName)
    .replace(/{extension}/g, extension);
};