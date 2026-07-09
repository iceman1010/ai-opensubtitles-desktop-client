---

## Auto-Updater Support

This release includes proper auto-updater metadata for all platforms:

- ✅ Windows (latest.yml)
- ✅ macOS (latest-mac.yml)
- ✅ Linux (latest-linux.yml)

## Installation

Download the appropriate installer for your platform from the assets below.

## macOS Installation

### First-time Installation

1. **Download** the `.dmg` file for your Mac (Intel or Apple Silicon)
2. **Open** the `.dmg` file
3. **Drag** the app to your Applications folder
4. **Open** the app from Applications

### Troubleshooting: "app is damaged and can't be opened"

macOS may block the app if it's not signed by the Apple App Store. This is normal for apps outside the App Store.

**Solution - Option 1 (Recommended for macOS Sequoia and later):**
1. Go to **System Settings** → **Privacy & Security**
2. Look for a message about the app being blocked
3. Click **"Allow Anyway"** next to the security message
4. Try opening the app again

**Solution - Option 2 (All macOS versions):**
1. Open **Terminal** (Applications → Utilities → Terminal)
2. Run this command:
   ```bash
   xattr -cr "/Applications/AI.Opensubtitles.com Client.app"
   ```
3. Try opening the app again

**Why does this happen?**
- This app is not sold through the Apple App Store
- Apple requires developers to pay $99/year for a Developer ID to notarize apps
- We're working on getting notarized, but this takes time

## Windows Installation

### Which file should I download?

The release includes two Windows files. They are the **same application**, just packaged differently — you only need one.

| File | Type | Best for |
|------|------|----------|
| **`AI.Opensubtitles.com.Client-Setup.exe`** | Installer (setup wizard) | Most users. Installs the app, creates Start Menu & Desktop shortcuts, registers an uninstaller, and enables auto-updates. |
| **`AI.Opensubtitles.com.Client.exe`** | Portable (standalone) | Running without installing — e.g. company laptops without admin rights, USB sticks, or if you just don't want anything installed. |

**Not sure? Pick `Client-Setup.exe`.** It is the recommended option for everyday use.

### First-time Installation (Installer)

1. **Download** `AI.Opensubtitles.com.Client-Setup.exe`
2. **Run** the installer
3. If prompted, allow the app to make changes to your device

### Using the Portable Version

1. **Download** `AI.Opensubtitles.com.Client.exe`
2. **Save** it anywhere on your PC (e.g. Desktop or a USB drive)
3. **Double-click** to run — no installation, no shortcuts, no registry entries

> **Note:** The portable version does **not** support auto-updates. You will need to download future releases manually.

### Troubleshooting: "Windows protected your PC"

Windows may show a SmartScreen warning because the app isn't signed with a Microsoft certificate. This is normal for independent developers.

**To proceed:**
1. Click **"More info"** on the warning screen
2. Click **"Run anyway"**

**Why does this happen?**
- Code signing certificates cost $300+/year
- We're working on obtaining one
- The warning is a security feature that flags unsigned software

## Linux Installation

### AppImage (Recommended)

1. **Download** the `.AppImage` file
2. **Make it executable:**
   ```bash
   chmod +x "AI.Opensubtitles.com.Client.AppImage"
   ```
3. **Run** the file:
   ```bash
   ./AI.Opensubtitles.com.Client.AppImage
   ```

### Troubleshooting

If it doesn't run, you may need to install FUSE:
```bash
sudo apt install libfuse2
```

---

**Need help?** Open an issue on GitHub or contact support.
