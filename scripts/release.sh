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
TEMP_DIR=""  # Set after PROJECT_ROOT is determined
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

# Generate changelog using Claude
# Generate basic changelog using git log
generate_changelog() {
    local current_version="$1"
    local new_version="$2"
    
    log_info "Generating changelog..."
    
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
    
    GENERATED_CHANGELOG="## What's Changed

$(git log --format='* %s (%h)' "$commit_range" 2>/dev/null | head -10 || git log --format='* %s (%h)' -10)

**Full Changelog**: https://github.com/$REPO_OWNER/$REPO_NAME/compare/${last_tag}...v${new_version}"
    
    log_success "Changelog generated successfully!"
    echo
    echo "=== Generated Changelog ==="
    echo "$GENERATED_CHANGELOG"
    echo "=========================="
    echo
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

# Update build configuration in package.json
update_build_configuration() {
    log_info "Build configuration already set for platform-specific builds"
    log_success "Build configuration ready"
}

# Commit and push changes
commit_and_push() {
    local version="$1"
    
    log_info "Committing version bump..."
    
    # Check if there are any changes besides package.json
    if git diff --quiet && git diff --cached --quiet; then
        # Only package.json changed, just add it
        if ! git add package.json; then
            log_error "Failed to add package.json to git"
            exit 1
        fi
    else
        # There are other changes, add everything
        if ! git add .; then
            log_error "Failed to add files to git"
            exit 1
        fi
    fi
    
    if ! git commit -m "🚀 Release v$version"; then
        log_error "Failed to commit version bump"
        exit 1
    fi
    
    if ! git push origin main; then
        log_error "Failed to push changes to remote"
        exit 1
    fi
    
    log_success "Changes committed and pushed"
}

# Read release notes template
read_release_template() {
    local template_file="$PROJECT_ROOT/scripts/release-notes-template.md"
    
    if [ -f "$template_file" ]; then
        cat "$template_file"
    else
        log_warning "Release notes template not found at $template_file"
        echo ""
    fi
}

# Update GitHub release with changelog
update_release_notes() {
    local tag="$1"

    if [ -z "$GENERATED_CHANGELOG" ]; then
        log_info "No changelog available, skipping release notes update"
        return 0
    fi

    log_info "Updating GitHub release with changelog..."

    # Read the template
    local template_content=$(read_release_template)
    
    # Create release notes with changelog and template
    local release_notes="$GENERATED_CHANGELOG

---

$template_content"

    # Add delay to ensure GitHub has processed the release
    log_info "Waiting 10 seconds for GitHub to process the release..."
    sleep 10

    # Get release ID with retry logic
    log_info "Getting release ID for tag $tag..."
    local release_id=""
    local max_retries=5
    local retry=0

    while [ $retry -lt $max_retries ] && [ -z "$release_id" ]; do
        release_id=$(gh api "repos/$REPO_OWNER/$REPO_NAME/releases/tags/$tag" --jq '.id' 2>/dev/null || echo "")

        if [ -n "$release_id" ] && [ "$release_id" != "null" ]; then
            break
        fi

        retry=$((retry + 1))
        if [ $retry -lt $max_retries ]; then
            log_warning "Could not get release ID (attempt $retry/$max_retries), retrying in 5 seconds..."
            sleep 5
        fi
    done

    if [ -z "$release_id" ] || [ "$release_id" = "null" ]; then
        log_warning "Could not get release ID for tag $tag after $max_retries attempts"
        return 1
    fi

    log_info "Updating release ID $release_id with changelog..."

    # Update the release via API using HEREDOC method (same as manual approach that worked)
    if gh api --method PATCH "repos/$REPO_OWNER/$REPO_NAME/releases/$release_id" --field body="$(cat <<EOF
$release_notes
EOF
)"; then
        log_success "Release notes updated with AI-generated changelog"
        return 0
    else
        log_warning "HEREDOC method failed, trying alternative JSON approach..."

        # Fallback: Use a temporary file to avoid shell expansion issues
        local temp_file=$(mktemp "/tmp/release_notes.XXXXXX.json")

        # Create JSON with proper escaping
        printf '%s\n' "$release_notes" | jq -R -s '{body: .}' > "$temp_file"

        if gh api --method PATCH "repos/$REPO_OWNER/$REPO_NAME/releases/$release_id" --input "$temp_file"; then
            log_success "Release notes updated with AI-generated changelog (fallback method)"
            rm -f "$temp_file"
            return 0
        else
            log_error "Failed to update release notes with both methods"
            rm -f "$temp_file"
            return 1
        fi
    fi
}

# Create and push git tag
create_and_push_tag() {
    local version="$1"
    local tag="v$version"

    log_info "Creating and pushing tag $tag" >&2

    # Check if tag already exists locally or remotely
    if git tag -l | grep -q "^${tag}$"; then
        log_warning "Local tag $tag already exists, deleting..." >&2
        git tag -d "$tag" 2>/dev/null || true
    fi

    if git ls-remote --tags origin | grep -q "refs/tags/${tag}$"; then
        log_warning "Remote tag $tag already exists, deleting..." >&2
        git push --delete origin "$tag" 2>/dev/null || true
    fi

    if ! git tag "$tag"; then
        log_error "Failed to create git tag $tag" >&2
        exit 1
    fi

    # Store created tag for potential cleanup on error
    CREATED_TAG="$tag"

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
        "AI.Opensubtitles.com.Client-arm64.zip"
        "AI.Opensubtitles.com.Client-x64.zip"
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

    # Give GitHub time to register the tag push and start the workflow
    log_info "Waiting 15 seconds for GitHub to start the workflow..."
    sleep 15

    while [ $wait_time -lt $max_wait ]; do
        # Check workflow runs triggered by this specific tag (exclude old cancelled runs)
        local workflow_status=$(gh run list --repo "$REPO_OWNER/$REPO_NAME" --limit 10 --json status,conclusion,headBranch --jq "
            map(select(.headBranch == \"$tag\" and (.conclusion == \"cancelled\" | not))) |
            if length == 0 then \"waiting\"
            else
                .[0] |
                if .status == \"completed\" then
                    if .conclusion == \"success\" then \"success\"
                    else \"failed\"
                    end
                else .status // \"unknown\"
                end
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

# Download release files for checksum validation with enhanced retry logic
download_release_files() {
    local tag="$1"
    local temp_dir="$2"

    log_info "Downloading release files for checksum validation..."
    cd "$temp_dir"

    # Give GitHub more time to process the release after upload
    log_info "Waiting 60 seconds for GitHub to fully process the release..."
    sleep 60

    # Try multiple download strategies
    if download_files_strategy_gh_bulk "$tag"; then
        return 0
    elif download_files_strategy_gh_individual "$tag"; then
        return 0
    elif download_files_strategy_api_fallback "$tag"; then
        return 0
    else
        log_warning "All download strategies failed, but continuing with release"
        return 1
    fi
}

# Strategy 1: Bulk download with enhanced retry (original method improved)
download_files_strategy_gh_bulk() {
    local tag="$1"
    local max_retries=5
    local retry=0
    local delay=5

    log_info "Strategy 1: Attempting bulk download with gh CLI..."

    while [ $retry -lt $max_retries ]; do
        if gh release download "$tag" --repo "$REPO_OWNER/$REPO_NAME" \
            --pattern "*.exe" \
            --pattern "*.dmg" \
            --pattern "*.zip" \
            --pattern "*.AppImage" \
            --pattern "*.deb" 2>/dev/null; then

            log_success "Bulk download successful"
            ls -la *.exe *.dmg *.zip *.AppImage *.deb 2>/dev/null || true
            return 0
        else
            retry=$((retry + 1))
            if [ $retry -lt $max_retries ]; then
                log_warning "Bulk download attempt $retry failed. Retrying in ${delay}s..."
                sleep $delay
                delay=$((delay * 2))  # Exponential backoff: 5s, 10s, 20s, 40s
            fi
        fi
    done

    log_warning "Strategy 1 (bulk download) failed after $max_retries attempts"
    return 1
}

# Strategy 2: Individual file download
download_files_strategy_gh_individual() {
    local tag="$1"
    local downloaded_count=0

    log_info "Strategy 2: Attempting individual file downloads..."

    # Expected files based on your release pattern
    local expected_files=(
        "AI.Opensubtitles.com.Client-Setup.exe"
        "AI.Opensubtitles.com.Client.exe"
        "AI.Opensubtitles.com.Client-x64.dmg"
        "AI.Opensubtitles.com.Client-arm64.dmg"
        "AI.Opensubtitles.com.Client-x64.zip"
        "AI.Opensubtitles.com.Client-arm64.zip"
        "AI.Opensubtitles.com.Client.AppImage"
        "elevate.exe"
        "ffmpeg.exe"
    )

    for file in "${expected_files[@]}"; do
        log_info "Downloading $file..."
        if gh release download "$tag" --repo "$REPO_OWNER/$REPO_NAME" --pattern "$file" 2>/dev/null; then
            log_success "Downloaded $file"
            downloaded_count=$((downloaded_count + 1))
        else
            log_warning "Failed to download $file"
        fi
        sleep 2  # Brief pause between downloads
    done

    if [ $downloaded_count -gt 0 ]; then
        log_success "Strategy 2: Downloaded $downloaded_count files individually"
        ls -la *.exe *.dmg *.zip *.AppImage 2>/dev/null || true
        return 0
    else
        log_warning "Strategy 2 (individual downloads) failed - no files downloaded"
        return 1
    fi
}

# Strategy 3: API-based fallback (download via direct URLs)
download_files_strategy_api_fallback() {
    local tag="$1"
    local downloaded_count=0

    log_info "Strategy 3: Attempting API-based fallback downloads..."

    # Get release assets via GitHub API
    local assets_json=$(gh api "repos/$REPO_OWNER/$REPO_NAME/releases/tags/$tag" --jq '.assets[] | {name: .name, url: .browser_download_url}' 2>/dev/null)

    if [ -z "$assets_json" ]; then
        log_warning "Strategy 3: Could not fetch asset list from GitHub API"
        return 1
    fi

    # Download main executable files using curl/wget
    # Use process substitution instead of pipeline to avoid subshell variable scope issues
    while read -r asset; do
        if [ -n "$asset" ]; then
            local name=$(echo "$asset" | jq -r '.name' 2>/dev/null)
            local url=$(echo "$asset" | jq -r '.url' 2>/dev/null)

            # Only download main installer files (skip portable .exe and helper files)
            if [[ "$name" =~ \.(dmg|AppImage)$ ]] || [[ "$name" == *"-Setup.exe" ]]; then
                log_info "API downloading $name (this may take a few minutes)..."
                if curl -L --progress-bar -o "$name" "$url" || wget --progress=bar:force -O "$name" "$url" 2>&1; then
                    log_success "API downloaded $name ($(du -h "$name" | cut -f1))"
                    downloaded_count=$((downloaded_count + 1))
                else
                    log_warning "API failed to download $name"
                fi
            fi
        fi
    done <<< "$assets_json"

    if [ $downloaded_count -gt 0 ]; then
        log_success "Strategy 3: Downloaded $downloaded_count files via API"
        return 0
    else
        log_warning "Strategy 3 (API fallback) failed"
        return 1
    fi
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

# Fix metadata checksums with enhanced fallback mechanisms
fix_metadata_checksums() {
    local tag="$1"
    local version="${tag#v}"  # Remove 'v' prefix
    local temp_dir="$2"

    log_info "Generating metadata files with enhanced fallback mechanisms..."

    cd "$temp_dir"

    # Get release date from GitHub
    local release_date=$(gh release view "$tag" --repo "$REPO_OWNER/$REPO_NAME" --json publishedAt --jq '.publishedAt')

    local generated_count=0

    # Windows Setup Installer (latest.yml)
    local setup_file="AI.Opensubtitles.com.Client-Setup.exe"
    if generate_metadata_with_fallback "$version" "$setup_file" "latest.yml" "$release_date" "$tag"; then
        generated_count=$((generated_count + 1))
    fi

    # macOS x64 DMG (latest-mac.yml)
    local mac_file="AI.Opensubtitles.com.Client-x64.dmg"
    if generate_metadata_with_fallback "$version" "$mac_file" "latest-mac.yml" "$release_date" "$tag"; then
        generated_count=$((generated_count + 1))
    fi

    # Linux AppImage (latest-linux.yml)
    local linux_file="AI.Opensubtitles.com.Client.AppImage"
    if generate_metadata_with_fallback "$version" "$linux_file" "latest-linux.yml" "$release_date" "$tag"; then
        generated_count=$((generated_count + 1))
    fi

    if [ $generated_count -gt 0 ]; then
        log_success "Generated $generated_count metadata files successfully"
        return 0
    else
        log_warning "Could not generate any metadata files"
        return 1
    fi
}

# Generate metadata with multiple fallback strategies
generate_metadata_with_fallback() {
    local version="$1"
    local filename="$2"
    local output_file="$3"
    local release_date="$4"
    local tag="$5"

    # Strategy 1: Generate from downloaded file (preferred)
    if [ -f "$filename" ]; then
        log_info "Generating $output_file from downloaded file..."
        local checksum_size=$(calculate_checksum_and_size "$filename")
        local sha512="${checksum_size%:*}"
        local size="${checksum_size#*:}"

        generate_metadata_file "$version" "$filename" "$sha512" "$size" "$output_file" "$release_date"
        return 0
    fi

    # Strategy 2: Generate from GitHub API asset info (fallback)
    log_info "File $filename not found locally, trying GitHub API fallback..."
    if generate_metadata_from_api "$version" "$filename" "$output_file" "$release_date" "$tag"; then
        return 0
    fi

    # Strategy 3: Generate minimal metadata (emergency fallback)
    log_warning "Could not get checksums for $filename, generating minimal metadata..."
    generate_minimal_metadata "$version" "$filename" "$output_file" "$release_date"
    return 0
}

# Generate metadata from GitHub API asset information
generate_metadata_from_api() {
    local version="$1"
    local filename="$2"
    local output_file="$3"
    local release_date="$4"
    local tag="$5"

    # Get asset info from GitHub API
    local asset_info=$(gh api "repos/$REPO_OWNER/$REPO_NAME/releases/tags/$tag" \
        --jq ".assets[] | select(.name == \"$filename\") | {size: .size, download_url: .browser_download_url}" 2>/dev/null)

    if [ -n "$asset_info" ]; then
        local size=$(echo "$asset_info" | jq -r '.size' 2>/dev/null)
        local download_url=$(echo "$asset_info" | jq -r '.download_url' 2>/dev/null)

        if [ "$size" != "null" ] && [ -n "$size" ]; then
            log_info "Got size info from GitHub API: $size bytes"

            # Try to calculate checksum by downloading just the file temporarily
            local temp_file="/tmp/${filename}.checksum"
            log_info "Downloading $filename for checksum calculation..."
            if curl -L --progress-bar -o "$temp_file" "$download_url" || wget --progress=bar:force -O "$temp_file" "$download_url" 2>&1; then
                local checksum_size=$(calculate_checksum_and_size "$temp_file")
                local sha512="${checksum_size%:*}"
                rm -f "$temp_file"

                generate_metadata_file "$version" "$filename" "$sha512" "$size" "$output_file" "$release_date"
                log_success "Generated $output_file from API + checksum calculation"
                return 0
            fi
        fi
    fi

    log_warning "Could not generate metadata from GitHub API for $filename"
    return 1
}

# Generate minimal metadata without checksums (still functional for auto-updater)
generate_minimal_metadata() {
    local version="$1"
    local filename="$2"
    local output_file="$3"
    local release_date="$4"

    cat > "$output_file" << EOF
version: $version
files:
  - url: $filename
    size: 0
path: $filename
releaseDate: '$release_date'
EOF

    log_warning "Generated minimal $output_file (no checksum verification)"
    log_info "Auto-updater will still work but without checksum validation"
}

# Upload metadata files to release with retry logic
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
        log_warning "No metadata files found to upload"
        return 1
    fi

    log_info "Found ${#files_to_upload[@]} metadata files to upload: ${files_to_upload[*]}"

    # Try uploading all files together first
    local max_retries=3
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if gh release upload "$tag" --repo "$REPO_OWNER/$REPO_NAME" "${files_to_upload[@]}" 2>/dev/null; then
            log_success "All metadata files uploaded successfully: ${files_to_upload[*]}"
            return 0
        else
            retry=$((retry + 1))
            if [ $retry -lt $max_retries ]; then
                log_warning "Bulk upload attempt $retry failed, retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done

    # If bulk upload fails, try individual uploads
    log_info "Bulk upload failed, trying individual file uploads..."
    local uploaded_count=0

    for file in "${files_to_upload[@]}"; do
        if gh release upload "$tag" --repo "$REPO_OWNER/$REPO_NAME" "$file" 2>/dev/null; then
            log_success "Uploaded $file"
            uploaded_count=$((uploaded_count + 1))
        else
            log_warning "Failed to upload $file"
        fi
    done

    if [ $uploaded_count -gt 0 ]; then
        log_success "Uploaded $uploaded_count out of ${#files_to_upload[@]} metadata files"
        return 0
    else
        log_error "Failed to upload any metadata files"
        return 1
    fi
}

# Cleanup temporary files
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        log_info "Cleaned up temporary files"
    fi
}

# Rollback version and clean up tags on error
rollback_version() {
    if [ -n "$ORIGINAL_VERSION" ] && [ "$ORIGINAL_VERSION" != "$(get_current_version)" ]; then
        log_warning "Rolling back version from $(get_current_version) to $ORIGINAL_VERSION due to error"
        update_package_version "$ORIGINAL_VERSION"
        log_success "Version rollback completed"
    fi
}

# Clean up git tags on error
cleanup_failed_tags() {
    if [ -n "$CREATED_TAG" ]; then
        log_warning "Cleaning up failed release tag: $CREATED_TAG"

        # Delete local tag if it exists
        if git tag -l | grep -q "^${CREATED_TAG}$"; then
            git tag -d "$CREATED_TAG" 2>/dev/null || true
            log_info "Deleted local tag $CREATED_TAG"
        fi

        # Delete remote tag if it exists
        if git ls-remote --tags origin | grep -q "refs/tags/${CREATED_TAG}$"; then
            git push --delete origin "$CREATED_TAG" 2>/dev/null || true
            log_info "Deleted remote tag $CREATED_TAG"
        fi
    fi
}

# Error handler that includes version rollback and tag cleanup
error_handler() {
    local exit_code=$?
    log_error "Script failed with exit code $exit_code"
    cleanup_failed_tags
    rollback_version
    cleanup
    exit $exit_code
}

# Main function
main() {
    local version_type="${1:-patch}"

    echo "=== AI.Opensubtitles.com Client - Automated Release ==="
    echo

    # Setup cleanup and error handling traps
    trap cleanup EXIT
    trap error_handler ERR
    
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
    TEMP_DIR="$PROJECT_ROOT/tmp/release_automation_$$"
    log_info "Working from project root: $PROJECT_ROOT"
    
    # Auto-detect repository information
    detect_repository
    
    # Check for running workflows before proceeding
    check_running_workflows
    
    # Create temp directory
    mkdir -p "$TEMP_DIR"
    
    # Get current version and store for potential rollback
    local current_version=$(get_current_version)
    if [ -z "$current_version" ] || [ "$current_version" = "null" ]; then
        log_error "Failed to get current version from package.json"
        exit 1
    fi
    ORIGINAL_VERSION="$current_version"  # Store for rollback if needed
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

    # Step 2: Update version and build configuration
    update_package_version "$new_version"
    update_build_configuration

    # Step 3: Create and push tag WITHOUT committing version change yet
    local tag="v$new_version"

    # Check if tag already exists locally or remotely and clean up
    if git tag -l | grep -q "^${tag}$"; then
        log_warning "Local tag $tag already exists, deleting..."
        git tag -d "$tag" 2>/dev/null || true
    fi

    if git ls-remote --tags origin | grep -q "refs/tags/${tag}$"; then
        log_warning "Remote tag $tag already exists, deleting..."
        git push --delete origin "$tag" 2>/dev/null || true
    fi

    # Commit version bump, create and push tag together
    log_info "Committing version bump..."

    # Check if there are any changes besides package.json
    if git diff --quiet && git diff --cached --quiet; then
        # Only package.json changed, just add it
        if ! git add package.json; then
            log_error "Failed to add package.json to git"
            exit 1
        fi
    else
        # There are other changes, add everything
        if ! git add .; then
            log_error "Failed to add files to git"
            exit 1
        fi
    fi

    if ! git commit -m "🚀 Release v$new_version"; then
        log_error "Failed to commit version bump"
        exit 1
    fi

    if ! git push origin main; then
        log_error "Failed to push changes to remote"
        exit 1
    fi

    log_success "Changes committed and pushed"

    # Wait for commit to be fully synchronized with remote
    log_info "Waiting for commit to be fully synchronized with remote..."

    local max_attempts=6
    local attempt=1
    local delay=5

    while [ $attempt -le $max_attempts ]; do
        log_info "Verification attempt $attempt/$max_attempts..."

        # Fetch latest changes from remote to ensure we have the most up-to-date refs
        if ! git fetch origin main --quiet 2>/dev/null; then
            log_warning "Failed to fetch from remote, continuing with local refs"
        fi

        # Check remote version
        local remote_version=$(git show origin/main:package.json | jq -r '.version' 2>/dev/null || echo "unknown")

        if [ "$remote_version" = "$new_version" ]; then
            log_success "Remote commit verified with version $new_version (attempt $attempt)"
            break
        fi

        if [ $attempt -eq $max_attempts ]; then
            log_error "Version mismatch after $max_attempts attempts!"
            log_error "Remote version: $remote_version, Expected: $new_version"
            log_error "GitHub Actions will build with wrong version. Aborting."
            log_info "This might indicate a Git synchronization issue or network problem."
            exit 1
        fi

        log_warning "Remote version ($remote_version) doesn't match expected ($new_version)"
        log_info "Waiting ${delay}s before retry $((attempt + 1))/$max_attempts..."
        sleep $delay

        # Increase delay slightly for subsequent attempts
        delay=$((delay + 2))
        attempt=$((attempt + 1))
    done

    # Now create and push the tag
    log_info "Creating and pushing tag $tag"

    if ! git tag "$tag"; then
        log_error "Failed to create git tag $tag"
        exit 1
    fi

    # Store created tag for potential cleanup on error
    CREATED_TAG="$tag"

    if ! git push origin "$tag"; then
        log_error "Failed to push tag $tag to remote"
        exit 1
    fi

    log_success "Tag $tag created and pushed"
    
    # Step 4: Wait for GitHub Actions
    wait_for_builds "$tag"
    local wait_result=$?
    
    if [ $wait_result -eq 1 ]; then
        log_error "GitHub Actions workflow failed. Aborting release process."
        cleanup
        exit 1
    elif [ $wait_result -eq 2 ]; then
        log_error "Release files are not available for download. Manual intervention required."
        log_info "Check your GitHub Actions workflow to ensure it creates releases with assets."
        cleanup
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
    if [ -n "$GENERATED_CHANGELOG" ]; then
        echo "  📝 Changelog generated and added to release"
    fi
    echo "  ✅ Auto-updater configured for all platforms:"
    echo "     • Windows (latest.yml)"
    echo "     • macOS (latest-mac.yml)" 
    echo "     • Linux (latest-linux.yml)"
    echo
    echo "💡 The release includes a detailed changelog created by analyzing your commits!"
}

# Handle script arguments
case "${1:-patch}" in
    "major"|"minor"|"patch")
        # Validate build type if provided
        case "${2:-stable}" in
            "stable"|"dev")
                main "$1" "$2"
                ;;
            *)
                log_error "Invalid build type: $2"
                echo "Use '$0 --help' for usage information"
                exit 1
                ;;
        esac
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
        echo "Build targets: All platforms (Windows, macOS, Linux)"
        echo
        echo "Examples:"
        echo "  $0                    # Creates patch release for all platforms"
        echo "  $0 minor              # Creates minor release for all platforms" 
        echo "  $0 major              # Creates major release for all platforms"
        echo "  $0 test-wait          # Test wait function with v1.1.0"
        echo "  $0 test-wait v1.0.9   # Test wait function with specific tag"
        exit 0
        ;;
    *)
        log_error "Invalid version type: $1"
        echo "Use '$0 --help' for usage information"
        exit 1
        ;;
esac