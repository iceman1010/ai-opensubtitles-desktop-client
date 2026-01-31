# AI.Opensubtitles.com Desktop Client

A cross-platform desktop application for AI-powered transcription and translation services using the OpenSubtitles AI API.

## Features

### 🎯 Core Functionality
- **Audio/Video Transcription**: Convert speech in media files to text subtitles using multiple AI models
- **Subtitle Translation**: Translate existing subtitle files between 100+ languages
- **Batch Processing**: Process multiple files simultaneously with queue management
- **Language Detection**: Automatic detection of spoken language in audio files
- **Multi-format Support**: Handle various audio, video, and subtitle formats

### 🎬 Supported File Formats
- **Video**: MP4, MKV, AVI, MOV, WMV, WebM, FLV, 3GP, and 20+ more formats
- **Audio**: MP3, WAV, FLAC, AAC, OGG, M4A, WMA, AIFF, and 15+ more formats  
- **Subtitles**: SRT, VTT with full Unicode support

### 🤖 AI Models & Languages
- **Transcription Models**: Multiple AI models with quality/speed options
- **Translation Models**: DeepL and other specialized translation models
- **100+ Languages**: Support for major world languages with regional variants
- **Auto-Detection**: Intelligent language detection for unknown content

### 🔧 Advanced Features
- **FFmpeg Integration**: Automatic audio extraction, format conversion, and optimization
- **Smart File Analysis**: Automatic detection of file type, duration, and processing requirements
- **Intelligent Retry System**: Network error recovery with exponential backoff for server errors (500), CloudFlare issues, and rate limiting
- **Credit Management**: Real-time credit balance monitoring and usage tracking
- **Error Recovery**: Comprehensive error handling with user-friendly messages
- **Drag & Drop Interface**: Intuitive file selection with multi-file support
- **File Associations**: Register as default handler for media and subtitle files
- **Auto-updater**: Automatic updates with metadata verification across all platforms

## Installation

### Download Pre-built Releases
Download the latest installer for your platform from the [Releases page](https://github.com/iceman1010/ai-opensubtitles-desktop-client/releases):

- **Linux**: `.AppImage` or `.deb` package
- **Windows**: `.exe` installer or portable version  
- **macOS**: `.dmg` package
   (to run it on an ARM OSX run: xattr -cr "/Applications/AI.Opensubtitles.com Client.app")

### System Requirements
- **Linux**: Ubuntu 18.04+ or equivalent
- **Windows**: Windows 10/11
- **macOS**: macOS 10.14+
- **FFmpeg**: Automatically included with the application

## Setup

1. **Get API Credentials**: Register at [www.Opensubtitles.com](https://www.opensubtitles.com) to obtain:
   - Username
   - Password  
   - API Key

2. **Launch Application**: Open the desktop client

3. **Configure Credentials**: Enter your API credentials in the login screen

4. **Start Processing**: Select files and choose transcription or translation options

## Usage

### Single File Processing
#### Transcription (Audio/Video → Subtitles)
1. **Select File**: Drag & drop or click to select an audio/video file
2. **Language Detection**: Optionally use automatic language detection
3. **Configure Options**: 
   - Choose target language (or auto-detect)
   - Select AI transcription model
   - Set output format (SRT/VTT)
   - Enable/disable return content
4. **Process**: Click "Start Transcription"
5. **Monitor**: Watch real-time progress in status bar
6. **Review**: Preview generated subtitles with syntax highlighting
7. **Save**: Export to desired location

#### Translation (Subtitles → Subtitles)
1. **Select File**: Choose an existing subtitle file (SRT/VTT)
2. **Configure Languages**: 
   - Set source language (or auto-detect)
   - Choose target language from 100+ options
   - Select AI translation model
3. **Process**: Click "Start Translation" 
4. **Monitor**: Track progress with live credit updates
5. **Review**: Preview translated content
6. **Save**: Export translated subtitles

### Batch Processing
1. **Access**: Navigate to "Batch" screen
2. **Add Files**: Drag & drop multiple files or use file selector
3. **Configure**: Set global processing options
4. **Queue Management**: Reorder, remove, or modify individual items
5. **Process**: Start batch operation with progress tracking
6. **Results**: Review and save all processed files

### Advanced Features
- **Credits Monitoring**: Real-time balance updates and usage tracking
- **Network Status**: Online/offline detection with connection restore notifications
- **API Activity**: Live status bar showing current operations (transcription/translation/credits)
- **Error Recovery**: Automatic retry on temporary failures with visual feedback
- **File Associations**: Open media files directly with the application
- **Keyboard Shortcuts**: Navigate between screens using hotkeys

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
git clone https://github.com/iceman1010/ai-opensubtitles-desktop-client.git
cd ai-opensubtitles-desktop-client
npm install
```

### Development Mode
```bash
npm run dev
```

### Building
```bash
# Build for development
npm run build

# Create installers for all platforms
npm run dist:all

# Platform-specific builds
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist        # Current platform
```

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Electron + Node.js
- **Media Processing**: FFmpeg
- **Build System**: Electron Builder

## Credits & Pricing

The application uses a credit-based system. Pricing varies by AI model and content length. Check the "Info" section in the app for current pricing details.

Please use an Opensubtitles.com (not .org) account when buying credits with https://ai.opensubtitles.com to be able to use with this app. 

## Support

For issues and feature requests, please visit the [GitHub Issues page](https://github.com/iceman1010/ai-opensubtitles-desktop-client/issues).

## License

This project is open source and available for anyone to edit, modify, and contribute to. Feel free to fork, improve, and share your modifications.
