import React, { useState, useRef } from 'react';
import { useAPI } from '../contexts/APIContext';

interface FileSearchFormProps {
  onSearch: (moviehash: string, language: string, fileName: string) => void;
  isLoading: boolean;
  languageOptions: Array<{ language_code: string; language_name: string }>;
  languagesLoading: boolean;
  defaultLanguage: string;
}

interface FileInfo {
  name: string;
  size: number;
  path: string;
  hash: string | null;
}

function FileSearchForm({ onSearch, isLoading, languageOptions, languagesLoading, defaultLanguage }: FileSearchFormProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [isCalculatingHash, setIsCalculatingHash] = useState(false);
  const [language, setLanguage] = useState(defaultLanguage || '');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoExtensions = [
    'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg',
    'ogv', '3gp', 'ts', 'vob', 'divx', 'xvid', 'rm', 'rmvb', 'asf', 'mts', 'm2ts'
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isVideoFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? videoExtensions.includes(ext) : false;
  };

  const handleFileSelect = async (file: File) => {
    setError(null);

    if (!isVideoFile(file.name)) {
      setError(`Invalid file type. Please select a video file (${videoExtensions.slice(0, 5).join(', ')}, etc.)`);
      return;
    }

    try {
      setIsCalculatingHash(true);

      // Get file path using Electron API
      const filePath = window.electronAPI?.getFilePath(file);
      if (!filePath) {
        throw new Error('Could not access file path. Please try selecting the file again.');
      }

      // Calculate moviehash in main process
      const hash = await window.electronAPI?.calculateMovieHash(filePath);
      if (!hash) {
        throw new Error('Failed to calculate file hash');
      }

      setSelectedFile({
        name: file.name,
        size: file.size,
        path: filePath,
        hash: hash,
      });
    } catch (error: any) {
      console.error('Error processing file:', error);
      setError(error?.message || 'Failed to process file');
      setSelectedFile(null);
    } finally {
      setIsCalculatingHash(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile?.hash) {
      onSearch(selectedFile.hash, language, selectedFile.name);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    // Save language preference
    window.electronAPI?.saveConfig({ lastUsedLanguage: newLanguage });
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid var(--border-color)',
    }}>
      <form onSubmit={handleSubmit}>
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            background: isDragging ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            marginBottom: '20px',
          }}
          onClick={handleBrowseClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={videoExtensions.map(ext => `.${ext}`).join(',')}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          {isCalculatingHash ? (
            <div>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '48px', color: 'var(--primary-color)', marginBottom: '16px' }}></i>
              <p style={{ margin: '0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                Calculating file hash...
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Please wait
              </p>
            </div>
          ) : selectedFile ? (
            <div>
              <i className="fas fa-file-video" style={{ fontSize: '48px', color: 'var(--success-color)', marginBottom: '16px' }}></i>
              <p style={{ margin: '0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                {selectedFile.name}
              </p>
              <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Size: {formatFileSize(selectedFile.size)}
              </p>
              <p style={{ margin: '8px 0', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                Hash: {selectedFile.hash}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-times"></i> Clear & Select Another File
              </button>
            </div>
          ) : (
            <div>
              <i className="fas fa-cloud-upload-alt" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '16px' }}></i>
              <p style={{ margin: '0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                Drag & Drop Video File Here
              </p>
              <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                or click to browse
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Supported: MP4, MKV, AVI, MOV, WMV, and more
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '20px',
            background: 'var(--error-bg, #fee)',
            border: '1px solid var(--error-border, #fcc)',
            borderRadius: '6px',
            color: 'var(--error-text, #c33)',
            fontSize: '14px',
          }}>
            <i className="fas fa-exclamation-triangle"></i> {error}
          </div>
        )}

        {/* Search Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '6px',
              color: 'var(--text-secondary)',
            }}>
              Subtitle Language (optional)
            </label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isLoading || languagesLoading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              {languagesLoading ? (
                <option value="">Loading languages...</option>
              ) : (
                <>
                  <option value="">All Languages</option>
                  {languageOptions.map(lang => (
                    <option key={lang.language_code} value={lang.language_code}>
                      {lang.language_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
            <button
              type="submit"
              disabled={isLoading || !selectedFile?.hash}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: selectedFile?.hash ? 'var(--primary-color)' : 'var(--bg-disabled)',
                color: selectedFile?.hash ? 'var(--button-text)' : 'var(--text-disabled)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: selectedFile?.hash ? 'pointer' : 'not-allowed',
                minWidth: '140px',
              }}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Searching...
                </>
              ) : (
                <>
                  <i className="fas fa-search"></i> Find Subtitles
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        {selectedFile && !error && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            background: 'var(--info-bg, #e7f3ff)',
            border: '1px solid var(--info-border, #b3d9ff)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--info-text, #014361)',
          }}>
            <i className="fas fa-info-circle"></i> <strong>File-based search</strong> uses a unique fingerprint of your video file to find exact subtitle matches, even if the filename has been changed. Leave language as "All Languages" to see subtitles in all available languages.
          </div>
        )}
      </form>
    </div>
  );
}

export default FileSearchForm;
