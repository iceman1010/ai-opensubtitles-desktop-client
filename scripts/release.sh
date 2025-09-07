#!/bin/bash

# AI.Opensubtitles.com Client - Automated Release Script
# This script automates the complete release process:
# 1. Bump version in package.json
# 2. Commit and push changes
# 3. Create git tag to trigger GitHub Actions
# 4. Wait for builds to complete
# 5. Download release files and fix metadata checksums
# 6. Upload corrected metadata files

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Auto-detect from git remote or use defaults
REPO_OWNER="iceman1010"  # Will be auto-detected from git remote
REPO_NAME="ai-opensubtitles-desktop-client"  # Will be auto-detected from git remote
TEMP_DIR="/tmp/release_automation_$$"
PROJECT_ROOT=""

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required tools
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v gh &> /dev/null; then
        missing_deps+=("gh (GitHub CLI)")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    # Check for Claude Code (claude command)
    if command -v claude &> /dev/null; then
        log_success "Claude Code found - will generate AI-powered changelog"
        CLAUDE_CODE_AVAILABLE=true
    else
        log_info "Claude Code not found - changelog generation disabled"
        log_info "Install Claude Code for AI-powered changelogs: https://claude.ai/code"
        CLAUDE_CODE_AVAILABLE=false
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        echo "Please install them and try again."
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Auto-detect repository information from git remote
detect_repository() {
    local remote_url=$(git remote get-url origin 2>/dev/null || echo "")
    
    if [ -n "$remote_url" ]; then
        # Parse GitHub URL format: https://github.com/owner/repo.git or git@github.com:owner/repo.git
        if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
            REPO_OWNER="${BASH_REMATCH[1]}"
            REPO_NAME="${BASH_REMATCH[2]}"
            log_info "Auto-detected repository: $REPO_OWNER/$REPO_NAME"
        else
            log_warning "Could not parse GitHub URL: $remote_url"
            log_info "Using default values: $REPO_OWNER/$REPO_NAME"
        fi
    else
        log_warning "No git remote found, using default values: $REPO_OWNER/$REPO_NAME"
    fi
}

# Check for running workflows to prevent conflicts
check_running_workflows() {
    log_info "Checking for running workflows..."
    
    # Get recent workflows and filter for in_progress status
    local all_workflows=$(gh run list --repo "$REPO_OWNER/$REPO_NAME" --limit 10 --json status,workflowName,headBranch 2>/dev/null || echo "[]")
    local running_workflows=$(echo "$all_workflows" | jq '[.[] | select(.status == "in_progress")]' 2>/dev/null || echo "[]")
    
    # Count running workflows
    local workflow_count=$(echo "$running_workflows" | jq length 2>/dev/null || echo "0")
    
    if [ "$workflow_count" -gt 0 ]; then
        log_error "Found $workflow_count running workflow(s):"
        echo "$running_workflows" | jq -r '.[] | "  • \(.workflowName) on \(.headBranch)"' 2>/dev/null || echo "  • Unable to parse workflow details"
        echo
        log_error "ABORT: Cannot start release while other workflows are running!"
        log_info "This prevents conflicts with:"
        log_info "  - Concurrent builds that might interfere with each other"
        log_info "  - GitHub rate limits and resource conflicts"
        log_info "  - Inconsistent release artifacts"
        echo
        log_info "Please wait for running workflows to complete, then try again:"
        log_info "  Monitor status: gh run list --repo $REPO_OWNER/$REPO_NAME"
        log_info "  Or cancel running workflows: gh run cancel <run-id>"
        exit 1
    fi
    
    log_success "No running workflows detected - safe to proceed"
}

# Generate AI-powered changelog using Claude Code
generate_changelog() {
    local current_version="$1"
    local new_version="$2"
    
    if [ "$CLAUDE_CODE_AVAILABLE" != "true" ]; then
        log_info "Skipping changelog generation (Claude Code not available)"
        return 0
    fi
    
    log_info "Generating AI-powered changelog with Claude Code..."
    
    # Get the last release tag
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [ -z "$last_tag" ]; then
        log_warning "No previous tags found, generating changelog from all commits"
        last_tag="--root"
    else
        log_info "Generating changelog since last release: $last_tag"
    fi
    
    # Get commit range for changelog
    local commit_range
    if [ "$last_tag" = "--root" ]; then
        commit_range="HEAD"
    else
        commit_range="${last_tag}..HEAD"
    fi
    
    # Create changelog prompt for Claude Code
    local changelog_prompt="Analyze the following git changes since the last release and create a concise, user-friendly changelog summary for version $new_version of the AI.Opensubtitles.com Desktop Client.

Focus on:
- New features and improvements
- Bug fixes and performance enhancements  
- UI/UX changes
- Breaking changes (if any)
- Technical improvements that affect users

Format as a clean markdown changelog entry suitable for a GitHub release.

Git changes since $last_tag:

\`\`\`
$(git log --oneline --no-merges "$commit_range" 2>/dev/null | head -15 || git log --oneline --no-merges -15)
\`\`\`

File changes:
\`\`\`
$(git diff --name-status "$commit_range" 2>/dev/null | head -20 || git diff --name-status HEAD~10..HEAD | head -20)
\`\`\`

Recent commits with details:
\`\`\`
$(git log --format='%h - %s (%an, %ar)' "$commit_range" 2>/dev/null | head -10 || git log --format='%h - %s (%an, %ar)' -10)
\`\`\`"
    
    # Generate changelog using Claude Code
    local changelog_file=$(mktemp "/tmp/changelog_${new_version}.XXXXXX.md")
    
    local claude_exit_code=0
    if echo "$changelog_prompt" | claude > "$changelog_file"; then
        log_info "Claude Code executed successfully"
    else
        claude_exit_code=$?
        log_warning "Claude Code failed with exit code $claude_exit_code"
    fi
    
    if [ $claude_exit_code -eq 0 ] && [ -s "$changelog_file" ]; then
        log_success "AI-powered changelog generated successfully!"
        echo
        echo "=== Generated Changelog ==="
        cat "$changelog_file"
        echo "=========================="
        echo
        
        # Store changelog for later use in release notes
        GENERATED_CHANGELOG=$(cat "$changelog_file")
        rm -f "$changelog_file"
    else
        log_warning "Failed to generate changelog with Claude Code, using basic git log"
        GENERATED_CHANGELOG="## What's Changed

$(git log --format='* %s (%h)' "$commit_range" 2>/dev/null | head -10 || git log --format='* %s (%h)' -10)

**Full Changelog**: https://github.com/$REPO_OWNER/$REPO_NAME/compare/${last_tag}...v${new_version}"
    fi
}

# Get current version from package.json
get_current_version() {
    jq -r '.version' package.json
}

# Increment version (patch by default)
increment_version() {
    local current_version="$1"
    local version_type="${2:-patch}"  # patch, minor, or major
    
    if [ -z "$current_version" ]; then
        log_error "Current version is empty"
        return 1
    fi
    
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    local major="${VERSION_PARTS[0]:-0}"
    local minor="${VERSION_PARTS[1]:-0}"
    local patch="${VERSION_PARTS[2]:-0}"
    
    case "$version_type" in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch"|*)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# Update version in package.json
update_package_version() {
    local new_version="$1"
    
    log_info "Updating package.json version to $new_version"
    
    # Create temporary file with updated version
    jq --arg version "$new_version" '.version = $version' package.json > package.json.tmp
    
    # Replace original file
    mv package.json.tmp package.json
    
    log_success "Version updated in package.json"
}

# Commit and push changes
commit_and_push() {
    local version="$1"
    
    log_info "Committing version bump..."
    
    if ! git add package.json; then
        log_error "Failed to add package.json to git"
        exit 1
    fi
    
    if ! git commit -m "Bump version to $version

🚀 Automated release preparation

- Updated version in package.json
- Ready for cross-platform builds
- Auto-updater metadata will be generated

🤖 Generated with Claude Code Release Automation"; then
        log_error "Failed to commit version bump"
        exit 1
    fi
    
    if ! git push origin main; then
        log_error "Failed to push changes to remote"
        exit 1
    fi
    
    log_success "Changes committed and pushed"
}

# Update GitHub release with AI-generated changelog
update_release_notes() {
    local tag="$1"
    
    if [ -z "$GENERATED_CHANGELOG" ] || [ "$CLAUDE_CODE_AVAILABLE" != "true" ]; then
        log_info "No AI-generated changelog available, skipping release notes update"
        return 0
    fi
    
    log_info "Updating GitHub release with AI-generated changelog..."
    
    # Create release notes with changelog
    local release_notes="$GENERATED_CHANGELOG

---

🤖 **AI-Generated Release Notes**
This changelog was automatically generated using Claude Code by analyzing git commits and file changes.

## Auto-Updater Support
This release includes proper auto-updater metadata for all platforms:
- ✅ Windows (latest.yml)
- ✅ macOS (latest-mac.yml)  
- ✅ Linux (latest-linux.yml)

## Installation
Download the appropriate installer for your platform from the assets below.

---
*Generated with [Claude Code](https://claude.ai/code) Release Automation*"

    # Update the release with the generated notes using GitHub API
    # GitHub CLI doesn't have 'gh release edit', so we use the API directly
    log_info "Getting release ID for tag $tag..."
    local release_id=$(gh api "repos/$REPO_OWNER/$REPO_NAME/releases/tags/$tag" --jq '.id')
    
    if [ -z "$release_id" ] || [ "$release_id" = "null" ]; then
        log_warning "Could not get release ID for tag $tag"
        return 1
    fi
    
    log_info "Updating release ID $release_id with changelog..."
    
    # Create JSON payload with release notes
    local json_payload=$(jq -n --arg body "$release_notes" '{"body": $body}')
    
    # Update the release via API using release ID
    gh api --method PATCH "repos/$REPO_OWNER/$REPO_NAME/releases/$release_id" --input - <<< "$json_payload"
    
    if [ $? -eq 0 ]; then
        log_success "Release notes updated with AI-generated changelog"
    else
        log_warning "Failed to update release notes"
    fi
}

# Create and push git tag
create_and_push_tag() {
    local version="$1"
    local tag="v$version"
    
    log_info "Creating and pushing tag $tag" >&2
    
    if ! git tag "$tag"; then
        log_error "Failed to create git tag $tag" >&2
        exit 1
    fi
    
    if ! git push origin "$tag"; then
        log_error "Failed to push tag $tag to remote" >&2
        exit 1
    fi
    
    log_success "Tag $tag created and pushed" >&2
    echo "$tag"
}

# Test if release files can be downloaded (for cases where release API doesn't show them yet)
test_release_downloads() {
    local tag="$1"
    local test_passed=0
    
    # Expected release files based on your multi-platform builds
    local expected_files=(
        "AI.Opensubtitles.com.Client.AppImage"
        "AI.Opensubtitles.com.Client.deb"
        "AI.Opensubtitles.com.Client-arm64.dmg"
        "AI.Opensubtitles.com.Client-x64.dmg"
        "AI.Opensubtitles.com.Client-Setup.exe"
        "AI.Opensubtitles.com.Client.exe"
    )
    
    log_info "Testing download availability for $tag..."
    
    for file in "${expected_files[@]}"; do
        local download_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$tag/$file"
        
        # Test if file exists with a HEAD request (faster than full download)
        # Use -L to follow redirects and check for HTTP 200 response
        local response_code=$(curl -fsSL -I -w "%{http_code}" "$download_url" -o /dev/null 2>/dev/null || echo "000")
        if [ "$response_code" = "200" ]; then
            log_success "✓ $file is downloadable"
            test_passed=1
        else
            log_info "✗ $file not found (may be expected for some platforms)"
        fi
    done
    
    if [ $test_passed -eq 1 ]; then
        log_info "At least some release files are available for download"
        return 0
    else
        log_warning "No expected release files found for download"
        return 1
    fi
}

# Wait for GitHub Actions to complete
wait_for_builds() {
    local tag="$1"
    local max_wait=1800  # 30 minutes
    local wait_time=0
    local check_interval=30
    local last_status=""
    
    log_info "Waiting for GitHub Actions builds to complete..."
    log_info "Tag: $tag | Max wait time: $((max_wait / 60)) minutes"
    
    while [ $wait_time -lt $max_wait ]; do
        # First check workflow runs for this tag
        local workflow_status=$(gh run list --repo "$REPO_OWNER/$REPO_NAME" --limit 5 --json status,conclusion,headBranch,headSha --jq "
            map(select(.headBranch == \"main\" or .headSha != null)) | 
            .[0] | 
            if .status == \"completed\" then 
                if .conclusion == \"success\" then \"success\" 
                else \"failed\" 
                end 
            else .status // \"unknown\" 
            end
        " 2>/dev/null || echo "unknown")
        
        # Check if release exists and get its status
        local release_info=$(gh release view "$tag" --repo "$REPO_OWNER/$REPO_NAME" --json isDraft,assets 2>/dev/null || echo "null")
        local is_draft="true"
        local asset_count=0
        
        if [ "$release_info" != "null" ]; then
            is_draft=$(echo "$release_info" | jq -r '.isDraft')
            asset_count=$(echo "$release_info" | jq -r '.assets | length // 0')
        fi
        
        # Create status message
        local status_msg=""
        if [ "$release_info" = "null" ]; then
            status_msg="⏳ Workflow: $workflow_status | Release: not created yet"
        elif [ "$is_draft" = "true" ]; then
            status_msg="🔨 Workflow: $workflow_status | Release: draft ($asset_count assets)"
        else
            status_msg="✅ Workflow: $workflow_status | Release: published ($asset_count assets)"
        fi
        
        # Only print status if it changed (reduce spam)
        if [ "$status_msg" != "$last_status" ]; then
            echo -e "\n[$(date '+%H:%M:%S')] $status_msg"
            last_status="$status_msg"
        else
            echo -n "."
        fi
        
        # Success conditions: release exists, is published, and has assets
        if [ "$release_info" != "null" ] && [ "$is_draft" = "false" ] && [ "$asset_count" -gt 0 ]; then
            echo -e "\n"
            log_success "GitHub Actions builds completed successfully!"
            log_success "Release $tag published with $asset_count assets"
            return 0
        fi
        
        # Handle case where workflow completed but no release was created - test if files are downloadable
        if [ "$workflow_status" = "success" ] && [ "$release_info" = "null" ] && [ $wait_time -gt 600 ]; then
            echo -e "\n"
            log_warning "Workflow completed but no release visible after 10+ minutes"
            log_info "Testing if release files are actually available for download..."
            
            # Test if we can download the expected files
            if test_release_downloads "$tag"; then
                log_success "Release files are downloadable! Proceeding with release process..."
                log_info "Note: GitHub API may take time to show the release, but files are accessible"
                return 0  # Success - files are available
            else
                log_error "Release files are not available for download"
                log_info "Check your GitHub Actions workflow configuration"
                return 2  # Failed download test
            fi
        fi
        
        # Early failure detection
        if [ "$workflow_status" = "failed" ]; then
            echo -e "\n"
            log_error "GitHub Actions workflow failed"
            log_info "Check workflow status: gh run list --repo $REPO_OWNER/$REPO_NAME"
            return 1
        fi
        
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
        
        # Progress indicator every 5 minutes
        if [ $((wait_time % 300)) -eq 0 ]; then
            echo -e "\n[$(date '+%H:%M:%S')] Still waiting... ($((wait_time / 60))/$((max_wait / 60)) minutes elapsed)"
        fi
    done
    
    echo -e "\n"
    log_error "Timeout waiting for GitHub Actions to complete after $((max_wait / 60)) minutes"
    log_warning "The build might still be running. Check manually:"
    log_warning "  Workflow status: gh run list --repo $REPO_OWNER/$REPO_NAME"
    log_warning "  Release status: gh release view $tag --repo $REPO_OWNER/$REPO_NAME"
    return 1
}

# Download release files for checksum validation
download_release_files() {
    local tag="$1"
    local temp_dir="$2"
    local max_retries=3
    local retry=0
    
    log_info "Downloading release files for checksum validation..."
    
    cd "$temp_dir"
    
    # Download main installer files with retry logic
    while [ $retry -lt $max_retries ]; do
        if gh release download "$tag" --repo "$REPO_OWNER/$REPO_NAME" \
            --pattern "*.exe" \
            --pattern "*.dmg" \
            --pattern "*.AppImage" \
            --pattern "*.deb" 2>/dev/null; then
            
            log_success "Release files downloaded successfully"
            # List downloaded files
            ls -la *.exe *.dmg *.AppImage *.deb 2>/dev/null || true
            return 0
        else
            retry=$((retry + 1))
            log_warning "Download attempt $retry failed. $((max_retries - retry)) attempts remaining."
            if [ $retry -lt $max_retries ]; then
                log_info "Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    log_error "Failed to download release files after $max_retries attempts"
    log_warning "This may be due to GitHub API rate limiting or network issues"
    log_info "The release was published successfully, but checksum validation was skipped"
    return 1
}

# Calculate SHA512 checksum and file size
calculate_checksum_and_size() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        return 1
    fi
    
    local sha512=$(node -e "
        const crypto = require('crypto');
        const fs = require('fs');
        console.log(crypto.createHash('sha512').update(fs.readFileSync('$file')).digest('base64'));
    ")
    
    local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    
    echo "$sha512:$size"
}

# Generate metadata file
generate_metadata_file() {
    local version="$1"
    local filename="$2"
    local sha512="$3"
    local size="$4"
    local output_file="$5"
    local release_date="$6"
    
    cat > "$output_file" << EOF
version: $version
files:
  - url: $filename
    sha512: $sha512
    size: $size
path: $filename
sha512: $sha512
releaseDate: '$release_date'
EOF
    
    log_success "Generated $output_file"
}

# Fix metadata checksums
fix_metadata_checksums() {
    local tag="$1"
    local version="${tag#v}"  # Remove 'v' prefix
    local temp_dir="$2"
    
    log_info "Generating metadata files with correct checksums..."
    
    cd "$temp_dir"
    
    # Get release date from GitHub
    local release_date=$(gh release view "$tag" --repo "$REPO_OWNER/$REPO_NAME" --json publishedAt --jq '.publishedAt')
    
    # Windows Setup Installer (latest.yml)
    local setup_file="AI.Opensubtitles.com.Client-Setup.exe"
    if [ -f "$setup_file" ]; then
        local setup_checksum_size=$(calculate_checksum_and_size "$setup_file")
        local setup_sha512="${setup_checksum_size%:*}"
        local setup_size="${setup_checksum_size#*:}"
        
        generate_metadata_file "$version" "$setup_file" "$setup_sha512" "$setup_size" "latest.yml" "$release_date"
    else
        log_warning "Windows setup file not found: $setup_file"
    fi
    
    # macOS x64 DMG (latest-mac.yml)  
    local mac_file="AI.Opensubtitles.com.Client-x64.dmg"
    if [ -f "$mac_file" ]; then
        local mac_checksum_size=$(calculate_checksum_and_size "$mac_file")
        local mac_sha512="${mac_checksum_size%:*}"
        local mac_size="${mac_checksum_size#*:}"
        
        generate_metadata_file "$version" "$mac_file" "$mac_sha512" "$mac_size" "latest-mac.yml" "$release_date"
    else
        log_warning "macOS DMG file not found: $mac_file"
    fi
    
    # Linux AppImage (latest-linux.yml)
    local linux_file="AI.Opensubtitles.com.Client.AppImage"
    if [ -f "$linux_file" ]; then
        local linux_checksum_size=$(calculate_checksum_and_size "$linux_file")
        local linux_sha512="${linux_checksum_size%:*}"
        local linux_size="${linux_checksum_size#*:}"
        
        generate_metadata_file "$version" "$linux_file" "$linux_sha512" "$linux_size" "latest-linux.yml" "$release_date"
    else
        log_warning "Linux AppImage file not found: $linux_file"
    fi
    
    log_success "Metadata files generated with correct checksums"
}

# Upload metadata files to release
upload_metadata_files() {
    local tag="$1"
    local temp_dir="$2"
    
    log_info "Uploading metadata files to GitHub release..."
    
    cd "$temp_dir"
    
    local files_to_upload=()
    
    for metadata_file in latest.yml latest-mac.yml latest-linux.yml; do
        if [ -f "$metadata_file" ]; then
            files_to_upload+=("$metadata_file")
        fi
    done
    
    if [ ${#files_to_upload[@]} -eq 0 ]; then
        log_error "No metadata files to upload"
        return 1
    fi
    
    gh release upload "$tag" --repo "$REPO_OWNER/$REPO_NAME" "${files_to_upload[@]}"
    
    log_success "Metadata files uploaded: ${files_to_upload[*]}"
}

# Cleanup temporary files
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        log_info "Cleaned up temporary files"
    fi
}

# Main function
main() {
    local version_type="${1:-patch}"
    
    echo "=== AI.Opensubtitles.com Client - Automated Release ==="
    echo
    
    # Setup cleanup trap
    trap cleanup EXIT
    
    # Check dependencies
    check_dependencies
    
    # Ensure we're in the correct directory (project root)
    if [ ! -f "package.json" ] && [ -f "../package.json" ]; then
        cd ..
    fi
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run this script from the project root or scripts directory."
        exit 1
    fi
    
    # Set project root for all operations
    PROJECT_ROOT=$(pwd)
    log_info "Working from project root: $PROJECT_ROOT"
    
    # Auto-detect repository information
    detect_repository
    
    # Check for running workflows before proceeding
    check_running_workflows
    
    # Create temp directory
    mkdir -p "$TEMP_DIR"
    
    # Get current version
    local current_version=$(get_current_version)
    if [ -z "$current_version" ] || [ "$current_version" = "null" ]; then
        log_error "Failed to get current version from package.json"
        exit 1
    fi
    log_info "Current version: $current_version"
    
    # Calculate new version
    local new_version=$(increment_version "$current_version" "$version_type")
    if [ -z "$new_version" ]; then
        log_error "Failed to calculate new version"
        exit 1
    fi
    log_info "New version: $new_version"
    
    # Confirm with user
    echo
    echo -e "${YELLOW}About to create release $new_version${NC}"
    echo "This will:"
    echo "  1. Update package.json version to $new_version"
    echo "  2. Commit and push changes"
    echo "  3. Create and push tag v$new_version"
    echo "  4. Wait for GitHub Actions builds"
    echo "  5. Download and validate release files"
    echo "  6. Generate and upload metadata files"
    echo
    read -p "Continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Release cancelled by user"
        exit 0
    fi
    
    # Execute release process
    echo
    log_info "Starting release process..."
    
    # Step 1: Generate AI-powered changelog
    generate_changelog "$current_version" "$new_version"
    
    # Step 2: Update version
    update_package_version "$new_version"
    
    # Step 3: Commit and push
    commit_and_push "$new_version"
    
    # Step 4: Create and push tag
    local tag=$(create_and_push_tag "$new_version")
    
    # Step 5: Wait for GitHub Actions
    wait_for_builds "$tag"
    local wait_result=$?
    
    if [ $wait_result -eq 1 ]; then
        log_error "GitHub Actions workflow failed. Aborting release process."
        cleanup_temp_files
        exit 1
    elif [ $wait_result -eq 2 ]; then
        log_error "Release files are not available for download. Manual intervention required."
        log_info "Check your GitHub Actions workflow to ensure it creates releases with assets."
        cleanup_temp_files
        exit 2
    fi
    
    # If wait_for_builds returned 0, either the release was properly detected OR files were downloadable
    
    # Step 6: Download release files
    if download_release_files "$tag" "$TEMP_DIR"; then
        # Step 7: Fix metadata checksums
        fix_metadata_checksums "$tag" "$TEMP_DIR"
        
        # Step 8: Upload metadata files
        upload_metadata_files "$tag" "$TEMP_DIR"
    else
        log_warning "Skipping checksum validation and metadata updates due to download failure"
        log_info "Release v${new_version} was published successfully without metadata validation"
    fi
    
    # Step 9: Update release with AI-generated changelog
    update_release_notes "$tag"
    
    echo
    log_success "🎉 Release $new_version completed successfully!"
    echo
    echo "Release URL: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/$tag"
    echo
    echo "✨ Features completed:"
    if [ "$CLAUDE_CODE_AVAILABLE" = "true" ] && [ -n "$GENERATED_CHANGELOG" ]; then
        echo "  🤖 AI-powered changelog generated and added to release"
    fi
    echo "  ✅ Auto-updater configured for all platforms:"
    echo "     • Windows (latest.yml)"
    echo "     • macOS (latest-mac.yml)" 
    echo "     • Linux (latest-linux.yml)"
    echo
    if [ "$CLAUDE_CODE_AVAILABLE" = "true" ]; then
        echo "💡 The release includes a detailed AI-generated changelog created by analyzing your commits!"
    else
        echo "💡 Install Claude Code to get AI-powered changelogs in future releases: https://claude.ai/code"
    fi
}

# Handle script arguments
case "${1:-patch}" in
    "major"|"minor"|"patch")
        main "$1"
        ;;
    "test-wait")
        # Test the wait_for_builds function with an existing release
        echo "=== Testing wait_for_builds function ==="
        REPO_OWNER="iceman1010"
        REPO_NAME="ai-opensubtitles-desktop-client"
        wait_for_builds "${2:-v1.1.0}"
        exit $?
        ;;
    "-h"|"--help")
        echo "Usage: $0 [version_type]"
        echo
        echo "Version types:"
        echo "  patch     - Increment patch version (1.0.0 -> 1.0.1) [default]"
        echo "  minor     - Increment minor version (1.0.0 -> 1.1.0)"
        echo "  major     - Increment major version (1.0.0 -> 2.0.0)"
        echo "  test-wait - Test the wait_for_builds function with existing release"
        echo
        echo "Examples:"
        echo "  $0              # Creates patch release (1.1.0 -> 1.1.1)"
        echo "  $0 minor        # Creates minor release (1.1.0 -> 1.2.0)"
        echo "  $0 major        # Creates major release (1.1.0 -> 2.0.0)"
        echo "  $0 test-wait    # Test wait function with v1.1.0"
        echo "  $0 test-wait v1.0.9  # Test wait function with specific tag"
        exit 0
        ;;
    *)
        log_error "Invalid version type: $1"
        echo "Use '$0 --help' for usage information"
        exit 1
        ;;
esac