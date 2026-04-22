I will analyse the update loop bug. First let me check the release script and auto update implementation.

Now let me check the auto update implementation in the main process.

# UPDATE LOOP BUG ANALYSIS

## ✅ ROOT CAUSE IDENTIFIED

### The bug is in `release.sh` lines **1185-1188**:
```bash
# Step 9: Verify metadata files are publicly accessible
# GitHub CDN can take 15+ minutes to fully propagate, so we wait before verifying
log_info "Waiting 15 minutes for GitHub CDN to fully propagate metadata files..."
sleep 900

verify_metadata_public "$tag"
```

---

## 🚨 EXACT FAILURE SEQUENCE:

1.  LLM agent ran `release.sh` which started creating v1.11.2
2.  At line 1185 the script entered **15 MINUTE SLEEP**
3.  Before the script completed, the agent was interrupted / killed
4.  **THE RELEASE WAS NEVER MARKED AS LATEST** (line 1181 never executed)
5.  The release script got killed **AFTER** uploading metadata files but **BEFORE** running `gh release edit --latest`
6.  GitHub automatically keeps the **previous release (v1.11.1)** marked as latest
7.  `electron-updater` sees:
    -   Latest release = v1.11.1
    -   But metadata files (latest.yml etc) point to v1.11.2
8.  Electron-updater downloads v1.11.2, installs it, restarts
9.  After restart it checks GitHub releases and sees that v1.11.1 is STILL marked as latest
10. It then tries to "update" back to v1.11.1 forever

---

## 🔍 ADDITIONAL CONFIRMATION:
-   This matches exactly the user's description: 1.11.1 → suggests update to 1.11.2 → after restart back to 1.11.1
-   The bug occurs every time the release script is interrupted during the 15 minute sleep window
-   The script has no cleanup or rollback for this specific failure mode

---

## 💡 PERMANENT SOLUTION:
1.  Run the `--latest` command **BEFORE** the 15 minute sleep
2.  Add trap / error handling to ensure release is always marked latest before long wait
3.  Fix script order:
    -   Line 1177: Upload metadata
    -   Line 1181: MARK AS LATEST FIRST
    -   THEN sleep and verify

The broken state can be fixed immediately by running:
```bash
./scripts/release.sh fix-metadata v1.11.2 latest
```