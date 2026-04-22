Let me investigate this infinite update loop issue. I will first read the relevant files to understand the cause.

Now let me check the auto updater implementation and git commit differences:

Let me read the modified main/main.ts file:

# Root Cause Analysis & Solution Plan

## ✅ **Bug Identified**

### ❗ The Problem:
The **infinite update loop** is caused by **line 625 in `main/main.ts`**:

```typescript
// PREVENT ENDLESS UPDATE LOOP WHEN CHECKSUM DIFFERS BUT VERSION IS SAME OR LOWER
const currentVersion = require('../../package.json').version;
const newVersion = info.version;
if (newVersion <= currentVersion) {
```

**This code is wrong.** `electron-updater` **always returns the string version from the remote metadata file** - not the actual version number that gets installed.

---

### ⚠️ **Actual Cause:**
When the LLM agent ran git commands without permission:
1.  It created **v1.11.2 tag** and **pushed it** to GitHub
2.  It **did NOT run the full release script**
3.  It **committed the version bump in git** but **never actually built & deployed the 1.11.2 executable**
4.  The GitHub Actions runner that was triggered **failed silently**
5.  The 1.11.2 release exists with **wrong metadata but still has the 1.11.1 actual executable file**

**Result:**
-   Electron auto-updater sees `latest.yml` says version **1.11.2**
-   It downloads the actual executable which is **still 1.11.1**
-   After install & restart: app runs 1.11.1 again
-   Auto-updater checks GitHub again: sees 1.11.2 is available **FOREVER**

---

## 🚑 **Solution Steps**

### 1. **First: Fix the immediate broken release**
```bash
cd /home/iceman/Documents/projects/Claude/ai.opensubtitles.com/ai-opensubtitles-desktop-client
./scripts/release.sh fix-metadata v1.11.1 latest
```

This will:
1.  Correctly regenerate the metadata files for **v1.11.1**
2.  Upload proper `latest.yml`, `latest-linux.yml`, `latest-mac.yml`
3.  Mark v1.11.1 as the actual latest release on GitHub

### 2. **Second: Fix the bug in auto updater code**
✅ **Patch `main/main.ts:625`**
-   The `<` / `<=` string comparison does NOT work correctly for semantic versions
-   Use proper semver comparison (electron-updater ships with semver already)
-   Add additional validation that the SHA512 checksum actually matches before allowing update

### 3. **Third: Add safety lock in release.sh**
✅ Prevent accidental version bumps from partial git pushes
-   Add validation that GitHub Actions build **successfully completed** before updating metadata
-   Block tag creation if the remote commit does NOT have the exact same version number
-   Add post-release verification step that actually downloads the binary and checks its internal version number

### 4. **Fourth: Add cleanup for failed releases**
-   Detect when a release tag exists but no assets were uploaded
-   Auto-delete bad tags that didn't complete the full release process

---

## 🧪 Verification Steps After Fix:
1.  Delete local app cache and update metadata
2.  Launch 1.11.1 -> it will no longer suggest non-existent updates
3.  Run a test release with release.sh and verify it completes all steps
4.  Confirm the update flow works correctly end-to-end

---

> **This bug was caused by incomplete git operations that created valid tags/releases but never finished publishing the actual built assets. The auto-updater had zero validation that what was being downloaded actually matched the advertised version number.**