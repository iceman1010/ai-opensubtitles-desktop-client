# Release Process Guide

## 🚀 Automated Release Process (RECOMMENDED)

Use the automated release script for hassle-free releases:

```bash
# From project root - creates complete release with proper metadata
./scripts/release.sh          # Patch release (1.1.0 -> 1.1.1)
./scripts/release.sh minor     # Minor release (1.1.0 -> 1.2.0)  
./scripts/release.sh major     # Major release (1.1.0 -> 2.0.0)
```

### What the script handles automatically:
- ✅ Version bumping in package.json
- ✅ Git commit, push, and tag creation  
- ✅ GitHub Actions build triggering
- ✅ SHA512 checksum calculation for all platforms
- ✅ Metadata file generation (latest.yml, latest-mac.yml, latest-linux.yml)
- ✅ Upload to GitHub release

## Manual Workaround (if automation fails)

If you need to manually fix metadata issues:

1. After GitHub release is created, run locally:
   ```bash
   npm run dist                    # Generate local Linux files
   npm run generate-update-metadata # Generate latest-linux.yml
   ```

2. Create placeholder metadata for other platforms:
   ```bash
   # Create latest.yml for Windows
   # Create latest-mac.yml for macOS  
   # Use same structure as latest-linux.yml but with correct filenames
   ```

3. Upload all metadata files:
   ```bash
   gh release upload v1.0.X latest-linux.yml latest.yml latest-mac.yml
   ```

## File Naming Issues
- **CRITICAL**: Local builds generate files with dashes: `AI.Opensubtitles.com-Client.AppImage`
- But GitHub Actions generates files with dots: `AI.Opensubtitles.com.Client.AppImage`
- This causes 404 download errors in auto-updater
- **Fix**: After generating metadata locally, manually edit filenames in YAML files to match GitHub release names
- Always verify filenames match between metadata files and actual GitHub release assets

## Version Management
- Always use 'v' prefix for git tags (e.g., v1.0.4) to trigger GitHub Actions
- The script handles this automatically

## 🚨 Critical Reminders
1. **Multi-platform**: Never focus only on Linux - always handle Windows, macOS, Linux together
2. **Git tags**: Must use 'v' prefix (v1.0.4) to trigger GitHub Actions
3. **File naming**: Local builds use dashes, CI uses dots - verify metadata filenames match GitHub assets
4. **Metadata files**: latest.yml (Windows), latest-mac.yml (macOS), latest-linux.yml (Linux)
- **CRITICAL: Multi-platform support**: Always consider Windows, macOS, and Linux together
