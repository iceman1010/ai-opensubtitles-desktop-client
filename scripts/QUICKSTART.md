# 🚀 Release Scripts - Quick Start Guide

## TL;DR - How to Create a Release

```bash
# From project root directory
./scripts/release.sh          # Patch release (1.0.9 → 1.0.10)
./scripts/release.sh minor     # Minor release (1.0.9 → 1.1.0)
./scripts/release.sh major     # Major release (1.0.9 → 2.0.0)
```

**That's it!** The script handles everything automatically:
- ✅ Version bump in package.json
- ✅ Git commit, tag, and push
- ✅ GitHub Actions build triggering
- ✅ SHA512 checksum calculation
- ✅ Metadata file generation and upload
- ✅ Complete cross-platform release

---

## 📁 Files in This Directory

### `release.sh` - **Main Automation Script**
**What it does**: Complete end-to-end release automation
**When to use**: Every time you want to create a new release
**Time saved**: ~2 hours → ~10 minutes

### `README.md` - **Detailed Documentation** 
**What it contains**: Comprehensive manual with troubleshooting
**When to read**: First time setup, troubleshooting issues
**Covers**: Prerequisites, detailed usage, common problems

### `QUICKSTART.md` - **This File**
**What it is**: Quick reference for experienced users
**When to use**: Daily operations, quick reminders

---

## 🎯 Before First Use

### 1. Install Dependencies
```bash
# GitHub CLI (if not installed)
sudo apt install gh
gh auth login

# Other tools (usually already installed)
sudo apt install jq git nodejs npm
```

### 2. Verify Prerequisites
```bash
# Check all dependencies
which gh jq git node npm
```

### 3. Test Script
```bash
# Show help (doesn't make changes)
./scripts/release.sh --help
```

---

## 🎮 Usage Examples

### Standard Patch Release
```bash
./scripts/release.sh
```
- **Before**: 1.0.9
- **After**: 1.0.10
- **Use for**: Bug fixes, small improvements

### Minor Release
```bash
./scripts/release.sh minor
```
- **Before**: 1.0.9  
- **After**: 1.1.0
- **Use for**: New features, functionality additions

### Major Release
```bash
./scripts/release.sh major
```
- **Before**: 1.0.9
- **After**: 2.0.0
- **Use for**: Breaking changes, major overhauls

---

## ⚡ What Happens When You Run It

### Phase 1: Version Management (30 seconds)
1. Reads current version from package.json
2. Calculates new version based on your choice
3. Updates package.json with new version
4. **User Confirmation Required** ⚠️

### Phase 2: Git Operations (1 minute)
5. Commits changes with detailed message
6. Pushes to main branch
7. Creates and pushes git tag (triggers GitHub Actions)

### Phase 3: Build Monitoring (5-8 minutes)
8. Waits for GitHub Actions to build all platforms
9. Monitors release creation
10. Shows progress dots while waiting

### Phase 4: Checksum Fixing (2-3 minutes)
11. Downloads all release files
12. Calculates correct SHA512 checksums
13. Generates metadata files for all platforms
14. Uploads corrected metadata to GitHub

### Result: Perfect Release ✅
- Windows users get `latest.yml`
- macOS users get `latest-mac.yml`  
- Linux users get `latest-linux.yml`
- Auto-updater works flawlessly for everyone

---

## 🛠️ Troubleshooting Quick Fixes

### "package.json not found"
```bash
# Run from project root directory
cd /path/to/ai-opensubtitles-desktop-client
./scripts/release.sh
```

### "Missing dependencies"
```bash
# Install missing tools
sudo apt install jq gh git nodejs npm
```

### "GitHub CLI not authenticated"
```bash
gh auth login
# Follow prompts to authenticate
```

### "Builds taking too long"
- Normal: 5-8 minutes for all platforms
- Check GitHub Actions page if > 15 minutes
- Script times out after 30 minutes

### Script fails midway
- **Safe to re-run**: Script checks current state
- Won't duplicate version bumps or tags
- Will resume from where it left off

---

## 🔍 Quick Status Check

### Before Running Release:
```bash
git status                    # Should be clean
git log --oneline -5         # Check recent commits
npm --version                # Verify Node.js works
gh auth status               # Verify GitHub CLI
```

### After Release Completes:
```bash
git tag                      # Should show new tag
gh release list              # Should show new release
gh release view v1.0.X       # Check release details
```

---

## 📋 Release Checklist

**Before Release:**
- [ ] All changes committed and pushed
- [ ] Tests passing (if applicable)
- [ ] GitHub CLI authenticated
- [ ] Clean working directory

**During Release:**
- [ ] Confirm version number when prompted
- [ ] Monitor progress output
- [ ] Wait for completion message

**After Release:**
- [ ] Verify release on GitHub
- [ ] Test auto-updater with existing app
- [ ] Update any documentation with new version

---

## 🚨 Emergency Procedures

### If Script Hangs:
1. **Ctrl+C** to cancel
2. Check GitHub Actions manually
3. Re-run script (it's safe)

### If Release Fails:
1. Check error message in script output
2. Fix underlying issue (network, permissions, etc.)
3. Re-run script - it will resume correctly

### If Wrong Version:
1. **Don't panic** - releases can't be easily deleted
2. Create a new patch release with fixes
3. Update documentation to skip problematic version

---

## 💡 Pro Tips

- **Timing**: Run releases during low-traffic hours for faster builds
- **Testing**: Test with patch release first if unsure
- **Monitoring**: Keep an eye on GitHub Actions while running
- **Patience**: Cross-platform builds take time - don't cancel early
- **Communication**: Announce releases to users after completion

---

**Need More Details?** → See `README.md` for comprehensive documentation
**Having Issues?** → Check CLAUDE.md for bash environment troubleshooting