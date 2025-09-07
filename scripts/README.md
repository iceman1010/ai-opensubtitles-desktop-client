# Release Scripts

This directory contains automation scripts for the AI.Opensubtitles.com Client project.

## 🚀 release.sh

Automated release script that handles the complete release process including version bumping, GitHub Actions builds, and auto-updater metadata generation.

### Features

- ✅ **Automated Version Bumping**: Updates `package.json` with semantic versioning
- ✅ **GitHub Actions Integration**: Triggers cross-platform builds (Windows, macOS, Linux)
- ✅ **Checksum Validation**: Calculates correct SHA512 checksums for all platform files
- ✅ **Auto-updater Support**: Generates proper metadata files (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`)
- ✅ **Multi-platform Support**: Handles all three target platforms automatically
- ✅ **Error Handling**: Comprehensive error checking and rollback capabilities

### Prerequisites

The script requires these tools to be installed:

```bash
# Required dependencies
sudo apt install jq nodejs npm git

# GitHub CLI (if not already installed)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Authenticate GitHub CLI
gh auth login
```

### Usage

```bash
# Make script executable (first time only)
chmod +x scripts/release.sh

# Create patch release (1.0.9 -> 1.0.10) - default
./scripts/release.sh

# Create minor release (1.0.9 -> 1.1.0)  
./scripts/release.sh minor

# Create major release (1.0.9 -> 2.0.0)
./scripts/release.sh major

# Show help
./scripts/release.sh --help
```

### What the Script Does

1. **Version Management**: 
   - Reads current version from `package.json`
   - Increments version according to semantic versioning
   - Updates `package.json` with new version

2. **Git Operations**:
   - Commits version bump with detailed commit message
   - Pushes changes to main branch
   - Creates and pushes git tag with `v` prefix (triggers GitHub Actions)

3. **Build Monitoring**:
   - Waits for GitHub Actions builds to complete
   - Monitors release creation (indicates builds finished)
   - Timeout after 30 minutes if builds don't complete

4. **Metadata Generation**:
   - Downloads all release files (`.exe`, `.dmg`, `.AppImage`, `.deb`)
   - Calculates correct SHA512 checksums for each platform
   - Gets file sizes and release dates
   - Generates metadata files with correct information

5. **Auto-updater Setup**:
   - Creates `latest.yml` for Windows updates
   - Creates `latest-mac.yml` for macOS updates  
   - Creates `latest-linux.yml` for Linux updates
   - Uploads all metadata files to GitHub release

### Example Output

```
=== AI.Opensubtitles.com Client - Automated Release ===

[INFO] Checking dependencies...
[SUCCESS] All dependencies found
[INFO] Current version: 1.0.9
[INFO] New version: 1.0.10

About to create release 1.0.10
This will:
  1. Update package.json version to 1.0.10
  2. Commit and push changes
  3. Create and push tag v1.0.10
  4. Wait for GitHub Actions builds
  5. Download and validate release files
  6. Generate and upload metadata files

Continue? (y/N): y

[INFO] Starting release process...
[INFO] Updating package.json version to 1.0.10
[SUCCESS] Version updated in package.json
[INFO] Committing version bump...
[SUCCESS] Changes committed and pushed
[INFO] Creating and pushing tag v1.0.10
[SUCCESS] Tag v1.0.10 created and pushed
[INFO] Waiting for GitHub Actions builds to complete...
..............................
[SUCCESS] GitHub Actions builds completed and release created
[INFO] Downloading release files for checksum validation...
[SUCCESS] Release files downloaded
[INFO] Generating metadata files with correct checksums...
[SUCCESS] Generated latest.yml
[SUCCESS] Generated latest-mac.yml  
[SUCCESS] Generated latest-linux.yml
[SUCCESS] Metadata files generated with correct checksums
[INFO] Uploading metadata files to GitHub release...
[SUCCESS] Metadata files uploaded: latest.yml latest-mac.yml latest-linux.yml

🎉 Release 1.0.10 completed successfully!

Release URL: https://github.com/iceman1010/ai-opensubtitles-desktop-client/releases/tag/v1.0.10

The auto-updater is now properly configured with correct checksums for all platforms:
  ✅ Windows (latest.yml)
  ✅ macOS (latest-mac.yml)
  ✅ Linux (latest-linux.yml)
```

### Safety Features

- **Dependency Checking**: Verifies all required tools are installed
- **User Confirmation**: Asks for confirmation before proceeding with release
- **Error Handling**: Exits on any error to prevent partial releases
- **Cleanup**: Automatically removes temporary files
- **Validation**: Checks for required files and proper Git repository

### Troubleshooting

**Script exits with "package.json not found"**
- Run the script from the project root directory

**"Missing required dependencies" error**
- Install the required tools listed in Prerequisites section

**GitHub CLI authentication issues**
- Run `gh auth login` and follow the prompts
- Ensure your token has `repo` and `workflow` permissions

**Builds timeout after 30 minutes**
- Check GitHub Actions workflow status manually
- Network issues or resource constraints may cause delays

### Security

- The script is safe to commit to the repository
- No secrets or tokens are hardcoded
- Uses GitHub CLI authentication (stored securely by GitHub CLI)
- Temporary files are automatically cleaned up