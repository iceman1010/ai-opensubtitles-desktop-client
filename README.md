# AI.Opensubtitles.com Desktop Client

A cross-platform desktop application for AI-powered transcription and translation services using the OpenSubtitles AI API.

## Features

### 🎯 Core Functionality
- **Audio/Video Transcription**: Convert speech in media files to text subtitles
- **Subtitle Translation**: Translate existing subtitle files between languages
- **Multi-format Support**: Handle various audio, video, and subtitle formats

### 🎬 Supported File Formats
- **Video**: MP4, MKV, AVI, MOV, WMV, WebM, and 20+ more formats
- **Audio**: MP3, WAV, FLAC, AAC, OGG, M4A, and 15+ more formats  
- **Subtitles**: SRT, VTT

### 🔧 Technical Features
- **FFmpeg Integration**: Automatic audio extraction and format conversion
- **Smart File Analysis**: Automatic detection of file type and processing requirements
- **Network Monitoring**: Offline/online status detection
- **Error Logging**: Comprehensive debugging and error tracking
- **Credit Management**: Real-time credit balance monitoring

## Installation

### Download Pre-built Releases
Download the latest installer for your platform from the [Releases page](https://github.com/iceman1010/ai-opensubtitles-desktop-client/releases):

- **Linux**: `.AppImage` or `.deb` package
- **Windows**: `.exe` installer or portable version  
- **macOS**: `.dmg` package

### System Requirements
- **Linux**: Ubuntu 18.04+ or equivalent
- **Windows**: Windows 10/11
- **macOS**: macOS 10.14+
- **FFmpeg**: Automatically included with the application

## Setup

1. **Get API Credentials**: Register at [AI.Opensubtitles.com](https://ai.opensubtitles.com) to obtain:
   - Username
   - Password  
   - API Key

2. **Launch Application**: Open the desktop client

3. **Configure Credentials**: Enter your API credentials in the login screen

4. **Start Processing**: Select files and choose transcription or translation options

## Usage

### Transcription (Audio/Video → Subtitles)
1. Select an audio or video file
2. Choose target language and AI model
3. Select output format (SRT/VTT)
4. Click "Start Transcription"
5. Preview and save the generated subtitles

### Translation (Subtitles → Subtitles)
1. Select a subtitle file (SRT/VTT)
2. Choose source and target languages
3. Select AI translation model
4. Click "Start Translation"
5. Preview and save the translated subtitles

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

This project is licensed under the terms specified in the package.json file.