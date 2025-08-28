import supportedFormatsConfig from '../../../shared/fileFormats.json';

export interface SupportedFormats {
  video: string[];
  audio: string[];
  subtitle: string[];
}

export const SUPPORTED_FORMATS: SupportedFormats = supportedFormatsConfig;

export const getFileTypeFromExtension = (filePath: string): 'video' | 'audio' | 'subtitle' | 'unknown' => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  if (!extension) {
    return 'unknown';
  }

  if (SUPPORTED_FORMATS.video.includes(extension)) {
    return 'video';
  } else if (SUPPORTED_FORMATS.audio.includes(extension)) {
    return 'audio';
  } else if (SUPPORTED_FORMATS.subtitle.includes(extension)) {
    return 'subtitle';
  }

  return 'unknown';
};

export const getAllSupportedExtensions = (): string[] => {
  return [
    ...SUPPORTED_FORMATS.video,
    ...SUPPORTED_FORMATS.audio,
    ...SUPPORTED_FORMATS.subtitle
  ];
};

export const getProcessingType = (filePath: string): 'transcription' | 'translation' | 'unknown' => {
  const fileType = getFileTypeFromExtension(filePath);
  
  switch (fileType) {
    case 'video':
    case 'audio':
      return 'transcription';
    case 'subtitle':
      return 'translation';
    default:
      return 'unknown';
  }
};

export const getFileTypeDescription = (filePath: string): string => {
  const fileType = getFileTypeFromExtension(filePath);
  
  switch (fileType) {
    case 'video':
      return 'Video file (for transcription)';
    case 'audio':
      return 'Audio file (for transcription)';
    case 'subtitle':
      return 'Subtitle file (for translation)';
    default:
      return 'Unsupported file type';
  }
};

export const getSupportedFormatsDescription = (): string => {
  const videoFormats = SUPPORTED_FORMATS.video.slice(0, 8).join(', ').toUpperCase();
  const audioFormats = SUPPORTED_FORMATS.audio.slice(0, 8).join(', ').toUpperCase();
  const subtitleFormats = SUPPORTED_FORMATS.subtitle.join(', ').toUpperCase();
  
  return `Video: ${videoFormats}... | Audio: ${audioFormats}... | Subtitle: ${subtitleFormats}`;
};

export const validateFileExtension = (filePath: string): { isValid: boolean; error?: string } => {
  const fileType = getFileTypeFromExtension(filePath);
  
  if (fileType === 'unknown') {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return {
      isValid: false,
      error: `Unsupported file type: .${extension}. ${getSupportedFormatsDescription()}`
    };
  }

  return { isValid: true };
};