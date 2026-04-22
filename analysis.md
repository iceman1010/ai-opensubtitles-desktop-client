# Auto-Update Infinite Loop Bug Analysis

## Problem Understanding
The application enters an infinite update loop:
1. User has installed version 1.11.1
2. App detects update to version 1.11.2 available
3. User installs update, app restarts
4. After restart, application still reports itself as version 1.11.1
5. Update prompt appears again, creating an infinite loop

## Root Cause

Identified in **two locations** in `main/main.ts`:

1. **Line 625-631** (in `update-available` event handler):
```typescript
const currentVersion = require('../../package.json').version;
const newVersion = info.version;
if (newVersion <= currentVersion) {
  this.debug(1, 'AutoUpdater', `Ignoring update to v${newVersion} - not newer than current ${currentVersion}`);
  this.sendUpdateStatus('update-not-available', 'You have the latest version');
  return;
}
```

2. **Line 706** (in `checkForUpdates` method):
```typescript
this.debug(3, 'UpdateCheck', 'App Version:', require('../../package.json').version);
```

### What Is Wrong

The code reads the version number directly from `package.json` using a **relative path**:

- `require('../../package.json')` resolves to the source code directory's package.json
- When electron-builder packages the app, this relative path resolution breaks
- The packaged app (AppImage/.exe) has its own internal package.json in the resources folder
- The relative path `../../package.json` no longer points to the correct location after packaging

**Result**: The application always reads the version from the **original bundled package.json** (1.11.1), never from the updated application's version (1.11.2). Even after updating, it sees itself as version 1.11.1 and prompts for the same update again.

### Confirmed By Code Search

- Search for `app.getVersion()` (Electron's official version API): **NO matches found**
- Search for `require(.*package\.json)`: **2 matches in main.ts** (lines 625, 706)

This confirms the developers never used Electron's official `app.getVersion()` API.

## Requirements Extraction

1. **Replace all version reads** from `require('../../package.json').version` with `app.getVersion()`
2. **Ensure backward compatibility** for development mode (app.getVersion() works in both dev and prod)
3. **Verify version display** in renderer components uses proper IPC

## Technical Considerations

### Files Requiring Changes

| Location | Issue | Priority |
|----------|-------|----------|
| `main/main.ts:625` | Version comparison in update-available handler | HIGH |
| `main/main.ts:706` | Debug log version display | HIGH |
| `renderer/src/App.tsx:19` | Version import for display | LOW |
| `renderer/src/components/Update.tsx:2,23` | Version import for display | LOW |

### Electron's Official API

Electron provides `app.getVersion()` which:
- Returns the version from the packaged application's internal package.json
- Works correctly after electron-updater applies an update
- Is the standard method for version detection in Electron apps
- Works in both development and production modes

```typescript
import { app } from 'electron';
const currentVersion = app.getVersion();
```

## Potential Challenges

1. **Existing Installations**: Users already stuck in the loop need to manually reinstall once after the fix
2. **Renderer Process**: Cannot use `app.getVersion()` directly in renderer - requires IPC to main process
3. **Development Mode**: Need to verify the fix works in both dev and production
4. **Build Required**: After fixing, the app must be rebuilt and republished

## Additional Findings

### Version Inconsistency in Update Metadata
The release metadata files show inconsistent versions:
- `release/latest.yml`: version 1.0.8
- `release/latest-linux.yml`: version 1.4.10  
- `package.json`: version 1.11.2

The update metadata was not regenerated after recent version bumps. This is a separate issue but contributes to confusion about which version is "latest".

### Same Issue Exists in Version Display
The renderer process also imports version from package.json:
- `renderer/src/App.tsx`: `import packageInfo from '../../package.json'`
- `renderer/src/components/Update.tsx`: `import packageJson from '../../../package.json'`

These should also be updated to use IPC to get the actual running version from the main process.

## Summary

The update loop bug is caused by using the relative path `require('../../package.json').version` instead of Electron's official `app.getVersion()` API. This causes the application to always read version 1.11.1 from the source package.json, even after updating to 1.11.2, resulting in an infinite update loop.

The fix requires replacing `require('../../package.json').version` with `app.getVersion()` in all version-checking code locations.