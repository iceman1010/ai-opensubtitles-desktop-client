# Fix Plan for Infinite Auto-Update Loop

## Root Cause
The bug exists at `main/main.ts:625`:
```javascript
const currentVersion = require('../../package.json').version;
```

When the application is packaged, this code references the **static package.json file that is bundled inside the AppImage/executable**. After an update is installed, the runtime application continues to read the OLD version number from the original packaged bundle, even though the new version is running.

This causes:
1.  Running v1.11.2 after update
2.  Application still reports `currentVersion = "1.11.1"`
3.  Auto-updater sees that 1.11.2 is newer so it prompts to update again
4.  This repeats forever

## Correct Fix Implementation
Instead of reading from package.json at runtime, use the official Electron API for app version which correctly reflects the actual running app version:

```javascript
const currentVersion = app.getVersion();
```

## Additional Checks Required
1.  Verify that `app.getVersion()` works correctly in both development and production modes
2.  Check that this same incorrect pattern is not used elsewhere in the codebase
3.  Test that after updating, the new version number is correctly reported immediately on first launch
4.  Verify the version comparison logic still works correctly with this change

## Location in Code
- File: `main/main.ts`
- Line: 625
- Line: 706 (same bug exists here as well)
