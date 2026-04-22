Let me check the actual project directory:

I've analyzed the bug and documented the findings in `analysis.md`. Here's the summary:

## Root Cause

The infinite update loop is caused by using `require('../../package.json').version` to read the current application version in two locations in `main/main.ts`:

- **Line 625**: In the `update-available` event handler
- **Line 706**: In the `checkForUpdates()` method

## Why It Causes the Loop

When electron-updater installs an update, it replaces the application binaries but does NOT update the bundled `package.json` file inside the distributable. After the update installs:

1. App runs the new v1.11.2 binary
2. Code still reads "1.11.1" from the unchanged bundled package.json
3. Compares: 1.11.2 (available) > 1.11.1 (from file) = update offered again
4. Loop repeats forever

## Solution

Replace `require('../../package.json').version` with `app.getVersion()` (which is already imported at line 1 of main.ts).

The fix requires changing:
- Line 625: `const currentVersion = require('../../package.json').version;` → `const currentVersion = app.getVersion();`
- Line 706: `require('../../package.json').version` → `app.getVersion()`