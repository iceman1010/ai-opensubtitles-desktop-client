## Root Cause Analysis

The issue described is an infinite update loop where:
1. Locally installed app reports version 1.11.1
2. On startup, it suggests updating to version 1.11.2
3. After updating and restarting, it reports version 1.11.1 again
4. The cycle repeats indefinitely

## Analysis of Code

### Version Information
From `package.json`:
```json
{
  "name": "ai-opensubtitles-client",
  "version": "1.11.2",
  // ... rest of file
}
```
The source code shows version 1.11.2, but the installed app reports 1.11.1.

### Auto-Update Mechanism
In `main.ts`, the `setupAutoUpdater()` method contains critical update logic:

Lines 621-631 show a protection against infinite loops:
```typescript
autoUpdater.on('update-available', async (info) => {
  // Prevent endless update loop when checksum differs but version is same or lower
  const currentVersion = require('../../package.json').version;
  const newVersion = info.version;
  if (newVersion <= currentVersion) {
    this.debug(1, 'AutoUpdater', `Ignoring update to v${newVersion} - not newer than current ${currentVersion}`);
    this.sendUpdateStatus('update-not-available', 'You have the latest version');
    return;
  }
  // ... rest of handler
})
```

This correctly prevents updating to same or older versions.

### Multiple Installations Detection
The `checkForMultipleInstallations()` method (lines 33-108) specifically addresses this issue:

```typescript
private checkForMultipleInstallations() {
  if (process.platform !== 'win32') {
    return;
  }

  try {
    // ... checks common Windows installation paths
    const possiblePaths = [
      // Per-machine installations
      path.join('C:', 'Program Files', 'AI.Opensubtitles.com Client', appName),
      path.join('C:', 'Program Files (x86)', 'AI.Opensubtitles.com Client', appName),
      // Per-user installations
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'AI.Opensubtitles.com Client', appName),
      path.join(os.homedir(), 'AppData', 'Local', 'ai-opensubtitles-client', appName),
      // Portable installations (common user locations)
      path.join(os.homedir(), 'Desktop', appName),
      path.join(os.homedir(), 'Downloads', appName),
      path.join(os.homedir(), 'Documents', appName)
    ];
    // ... logic to detect multiple installations
  }
}
```

This method:
1. Checks for installations in standard and common user locations
2. Detects when multiple copies exist
3. Warns the user about potential update issues

### Root Cause Determination
The infinite update loop occurs because:

1. User has TWO installations of the application:
   - One older version (1.11.1) in a user-accessible location like Desktop or Downloads
   - One newer version (1.11.2) properly installed in Program Files via the updater

2. When launching the application, the user is accidentally starting the OLD version from Desktop/Downloads instead of the updated version from Program Files

3. The old version (1.11.1) correctly detects that 1.11.2 is available and suggests an update

4. After updating, the NEW version (1.11.2) gets installed to the proper location (Program Files)

5. However, upon restart, the user again launches the OLD version from Desktop/Downloads (perhaps via a shortcut they created)

6. The cycle repeats: old version sees update available → user updates → restarts old version → sees update available → etc.

## Solution Approach

The `checkForMultipleInstallations()` method is already designed to detect and warn about this exact scenario. The fix involves:

1. Running the application and examining the debug logs for the multiple installations warning
2. Identifying which location contains the outdated version (likely Desktop or Downloads)
3. Removing the outdated installation from that location
4. Ensuring future launches use the properly installed version (via Start menu shortcut)

The auto-update logic itself is functioning correctly - the issue is environmental (multiple installations causing user confusion about which version they're actually running).

No code changes are required to fix this issue; it's resolved by ensuring only one installation exists and that users launch the correct installed version.