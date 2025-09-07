# Auto-Updater System Guide

## Overview
The app uses electron-updater for automatic updates with cross-platform support via GitHub Actions CI/CD.

## Critical Update Metadata Files
- `latest-linux.yml` - Required for Linux AppImage updates
- `latest-mac.yml` - Required for macOS DMG updates  
- `latest.yml` - Required for Windows installer updates

## How Auto-Updater Works
1. electron-updater checks for these YAML files on GitHub releases
2. Files contain version info, SHA512 hashes, and file sizes for security
3. If newer version found, downloads and verifies the installer
4. **Problem**: electron-builder only generates these files with --publish modes, requiring GitHub tokens
5. **Solution**: GitHub Actions CI/CD generates metadata files automatically

## CI/CD Auto-Generation Process
1. GitHub Actions builds on all platforms (Windows, macOS, Linux)
2. Each platform runs `npm run generate-update-metadata` after building
3. Metadata files are automatically created for each platform's installers
4. All files (installers + metadata) are uploaded as artifacts
5. Release job collects all artifacts and creates GitHub release with everything

## Local Development
- Run `npm run generate-update-metadata` after building locally (only generates for current platform)
- Files are excluded from git (in .gitignore) - they should NOT be committed
- For full cross-platform metadata, use GitHub Actions by pushing tags with 'v' prefix

## SHA512 Checksum Validation
The auto-updater validates downloaded files using SHA512 checksums from metadata files. If checksums don't match the actual files, users get "sha512 checksum mismatch" errors during updates.

**CRITICAL**: Always validate metadata checksums against actual GitHub release files FOR ALL PLATFORMS:
1. Download ALL release files from GitHub (Windows .exe, macOS .dmg, Linux .AppImage/.deb)
2. Calculate SHA512 for ALL files using: `node -e "const crypto = require('crypto'); const fs = require('fs'); console.log(crypto.createHash('sha512').update(fs.readFileSync('file')).digest('base64'));"`
3. Update ALL metadata files (latest.yml, latest-mac.yml, latest-linux.yml) with correct checksums
4. Re-upload ALL corrected metadata files to GitHub release

**REMEMBER**: Never work with only one platform - always handle Windows, macOS, and Linux together.

## Common Issues
Without these files, users get "Cannot find latest-linux.yml" error in preferences when checking for updates. The CI/CD approach ensures all platforms get proper metadata files automatically.