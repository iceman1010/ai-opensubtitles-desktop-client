import React, { useState } from 'react';
import { validateFileExtension, getFileTypeDescription } from '../config/fileFormats';

interface FileSelectorProps {
  onFileSelect: (filePath: string) => void;
  onMultipleFileSelect?: (filePaths: string[]) => void;
  disabled?: boolean;
}

function FileSelector({ onFileSelect, onMultipleFileSelect, disabled = false }: FileSelectorProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileSelection = (filePath: string) => {
    if (disabled) return;
    
    const validation = validateFileExtension(filePath);
    
    if (validation.isValid) {
      setSelectedFile(filePath);
      setFileError(null);
      onFileSelect(filePath);
    } else {
      setSelectedFile(null);
      setFileError(validation.error || 'Invalid file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (files.length === 1) {
        // Single file - use webUtils to get path
        const filePath = window.electronAPI.getFilePath(files[0]);
        if (filePath) {
          handleFileSelection(filePath);
        }
      } else if (onMultipleFileSelect) {
        // Multiple files - get paths using webUtils
        const filePaths = files
          .map(file => window.electronAPI.getFilePath(file))
          .filter((path): path is string => path !== null)
          .filter(path => {
            const validation = validateFileExtension(path);
            return validation.isValid;
          });

        if (filePaths.length > 0) {
          setFileError(null);
          onMultipleFileSelect(filePaths);
        } else {
          setFileError('No valid files selected');
        }
      }
    }
  };

  const handleBrowseClick = async () => {
    if (disabled) return;

    try {
      if (onMultipleFileSelect) {
        // Use multiple file selection when multiple file handler is provided
        const filePaths = await window.electronAPI.selectMultipleFiles();
        if (filePaths && filePaths.length > 0) {
          const validFilePaths = filePaths.filter(path => {
            const validation = validateFileExtension(path);
            return validation.isValid;
          });
          if (validFilePaths.length > 0) {
            setFileError(null);
            onMultipleFileSelect(validFilePaths);
          } else {
            setFileError('No valid files selected');
          }
        }
      } else {
        // Use single file selection for backward compatibility
        const filePath = await window.electronAPI.selectFile();
        if (filePath) {
          handleFileSelection(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to select file:', error);
      setFileError('Failed to select file');
    }
  };

  return (
    <div className="file-selector">
      <div
        className={`file-drop-zone ${isDragOver ? 'dragover' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
      >
        <div className="drop-zone-content">
          <p>Drag & drop a file here</p>
          <p>or</p>
          <button
            type="button"
            className="button"
            onClick={handleBrowseClick}
            disabled={disabled}
          >
            Browse Files
          </button>
          <div className="supported-formats">
            <small>Supported: Video, Audio, and Subtitle files</small>
          </div>
        </div>
      </div>

      {fileError && (
        <div className="status-message error">
          {fileError}
        </div>
      )}

      {selectedFile && !fileError && (
        <div className="selected-file-info">
          <p><strong>Selected:</strong> {selectedFile}</p>
          <p><strong>Type:</strong> {getFileTypeDescription(selectedFile)}</p>
        </div>
      )}
    </div>
  );
}

export default FileSelector;