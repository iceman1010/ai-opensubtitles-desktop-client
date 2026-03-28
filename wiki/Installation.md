# Installation

## Download Pre-built Releases

Download the latest installer for your platform from the [Releases page](https://github.com/iceman1010/ai-opensubtitles-desktop-client/releases):

### Linux
- `.AppImage` - Universal Linux package
- `.deb` - Debian/Ubuntu package

To run AppImage:
```bash
chmod +x AI.Opensubtitles.com-Client-x.x.x.AppImage
./AI.Opensubtitles.com-Client-x.x.x.AppImage
```

### Windows
- `.exe` installer
- Portable version

### macOS
- `.dmg` package

> **ARM Mac Users**: To run on ARM OSX, execute:
> ```bash
> xattr -cr "/Applications/AI.Opensubtitles.com Client.app"
> ```

## System Requirements

### Linux
- Ubuntu 18.04+ or equivalent
- GLIBC 2.31 or higher

### Windows
- Windows 10/11 (64-bit)

### macOS
- macOS 10.14+

## FFmpeg

FFmpeg is automatically included with the application - no manual installation required.

## Installation from Source

If you prefer to build from source:

```bash
git clone https://github.com/iceman1010/ai-opensubtitles-desktop-client.git
cd ai-opensubtitles-desktop-client
npm install
npm run dev  # For development
npm run dist:all  # To build installers
```

### Prerequisites for Building
- Node.js 18+
- npm
