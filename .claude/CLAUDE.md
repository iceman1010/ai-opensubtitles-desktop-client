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
- Fixed auto-updater metadata generation issue
- Version currently at 1.0.6

## Auto-Updater System
The app uses electron-updater for automatic updates with cross-platform support via GitHub Actions CI/CD.

**Critical Update Metadata Files:**
- `latest-linux.yml` - Required for Linux AppImage updates
- `latest-mac.yml` - Required for macOS DMG updates  
- `latest.yml` - Required for Windows installer updates

**How Auto-Updater Works:**
1. electron-updater checks for these YAML files on GitHub releases
2. Files contain version info, SHA512 hashes, and file sizes for security
3. If newer version found, downloads and verifies the installer
4. **Problem**: electron-builder only generates these files with --publish modes, requiring GitHub tokens
5. **Solution**: GitHub Actions CI/CD generates metadata files automatically

**CI/CD Auto-Generation Process:**
1. GitHub Actions builds on all platforms (Windows, macOS, Linux)
2. Each platform runs `npm run generate-update-metadata` after building
3. Metadata files are automatically created for each platform's installers
4. All files (installers + metadata) are uploaded as artifacts
5. Release job collects all artifacts and creates GitHub release with everything

**Local Development:**
- Run `npm run generate-update-metadata` after building locally (only generates for current platform)
- Files are excluded from git (in .gitignore) - they should NOT be committed
- For full cross-platform metadata, use GitHub Actions by pushing tags with 'v' prefix

**Why This Matters:**
Without these files, users get "Cannot find latest-linux.yml" error in preferences when checking for updates. The CI/CD approach ensures all platforms get proper metadata files automatically.

## Testing Notes
- User tests on Windows installer
- Requires valid OpenSubtitles credentials (username, password, API key)
- Auto-updater checks GitHub for releases and requires metadata files

Remember: Focus on the specific request only. Don't expand scope without explicit permission.