

Based on my analysis, I've identified the root cause of the infinite update loop bug.

---

## Analysis: Infinite Update Loop Bug

### Problem Summary
The application gets stuck in an infinite update loop where:
1. Running v1.11.1 → suggests updating to v1.11.2
2. After updating and restarting → shows v1.11.1 again → suggests updating to v1.11.2
3. This repeats forever

### Root Cause

**Location**: `main/main.ts` at lines 625 and 706

The code reads the current version using a hardcoded filesystem path:
```typescript
const currentVersion = require('../../package.json').version;
```

**Why this fails**:
- When the app is built with electron-builder, a static copy of `package.json` is bundled into the application
- After `electron-updater` installs a new version, it replaces the **executable** but not this bundled `package.json`
- On restart, the app still reads the old version from the static bundled file
- The auto-updater sees the remote version (1.11.2) is "newer" than the stale version (1.11.1) it reads
- This triggers another update prompt → infinite loop

### Solution

Replace `require('../../package.json').version` with Electron's built-in API:
```typescript
import { app } from 'electron';
const currentVersion = app.getVersion();
```

This reads the version from the **running executable's metadata**, which is correctly updated when the app is replaced during an auto-update.

### Files That Need Changes

| File | Line(s) | Current Code | Required Change |
|------|---------|--------------|-----------------|
| `main/main.ts` | 625 | `require('../../package.json').version` | `app.getVersion()` |
| `main/main.ts` | 706 | `require('../../package.json').version` | `app.getVersion()` |

### Implementation Plan

1. **In `main/main.ts`**:
   - At line 625 (inside `autoUpdater.on('update-available')` handler): Replace the require statement with `app.getVersion()`
   - At line 706 (inside `checkForUpdates()` method): Replace the require statement with `app.getVersion()`

2. **Verification**:
   - Rebuild the application
   - Test that after an auto-update, the app correctly reports the new version
   - Confirm the update loop no longer occurs

### Additional Notes

- The `app` module is already imported in the file (line 1), so no additional imports are needed
- This is the standard, recommended way to get the application version in Electron apps
- Works correctly in both development and packaged environments