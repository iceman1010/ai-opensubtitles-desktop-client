# Release Process Critical Information

## GitHub Release Tags
**CRITICAL**: When creating GitHub releases, the tag MUST start with 'v' (e.g., v1.0.1) to trigger GitHub Actions workflow! Without 'v' prefix, builds will NOT be triggered and no installers will be created!

## File Naming Issues
**CRITICAL**: Local builds generate files with dashes (AI.Opensubtitles.com-Client.AppImage) but GitHub Actions generates with dots (AI.Opensubtitles.com.Client.AppImage). Always verify metadata filenames match GitHub release assets to prevent 404 download errors.

## Electron-Builder Notes
- Do NOT use comment fields (`"_comment"`, `"_comment_naming"`, etc.) in package.json build configuration
- Electron-builder 24.13.3+ strictly validates configuration and rejects unknown properties
- Use this separate file for documentation instead

## Version Management
- Version is automatically bumped by the release script
- Always use semantic versioning (major.minor.patch)
- Current version in package.json: Check the file directly