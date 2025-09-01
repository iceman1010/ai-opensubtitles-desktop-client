# Project Instructions for AI.Opensubtitles.com Client

## Core Guidelines
- **Stay strictly on task**: Only do what is specifically requested
- **No unauthorized actions**: Don't create releases, commits, or take additional actions unless explicitly asked
- **Minimize token usage**: Be concise and focused
- **Ask before assuming**: If unclear about scope, ask rather than expanding the task

## Project Context
This is an Electron-based desktop application for AI.Opensubtitles.com with:
- React frontend (TypeScript)
- Electron main process
- Vite build system
- Cross-platform support (Windows, macOS, Linux)
- Auto-updater with GitHub integration
- FFmpeg integration for media processing
- OpenSubtitles API authentication

## Key Technical Details
- **Asset loading**: Uses `base: './'` in vite.config.ts for relative paths (critical for Windows)
- **Authentication**: Validates credentials via OpenSubtitles API before allowing app access
- **Version management**: Always use 'v' prefix for git tags (e.g., v1.0.4) to trigger GitHub Actions
- **File structure**: 
  - `main/` - Electron main process (TypeScript)
  - `renderer/` - React frontend
  - `shared/` - Shared utilities
  - `dist/` - Built application

## Recent Work Completed
- Fixed Windows asset loading issues with relative paths
- Implemented comprehensive auto-updater system
- Added credential validation for login and preferences
- Version currently at 1.0.4

## Testing Notes
- User tests on Windows installer
- Requires valid OpenSubtitles credentials (username, password, API key)
- Auto-updater checks GitHub for releases

Remember: Focus on the specific request only. Don't expand scope without explicit permission.