# How to Install AI Opensubtitles Client

Learn how to install the AI Opensubtitles Desktop Client on Windows, macOS, and Linux. This auto subtitle generator and SRT translator is easy to set up, with pre-built installers that include everything you need, including FFmpeg, to start transcribing audio to VTT and SRT immediately.

## Download Pre-built Installers

To get started with AI subtitle generation, download the latest installer for your operating system from the official [GitHub Releases page](https://github.com/iceman1010/ai-opensubtitles-desktop-client/releases):

### Install AI Opensubtitles Client on Linux
- **`.AppImage`** - Universal Linux package (Recommended)
- **`.deb`** - Debian/Ubuntu package

To run the AppImage file:
```bash
chmod +x AI.Opensubtitles.com-Client-x.x.x.AppImage
./AI.Opensubtitles.com-Client-x.x.x.AppImage
```

### Install AI Opensubtitles Client on Windows
- **`.exe` installer** - Standard setup wizard for Windows 10/11
- **Portable version** - Run without installation

### Install AI Opensubtitles Client on macOS
- **`.dmg` package** - Drag and drop application bundle

> **ARM Mac Users (Apple Silicon)**: To run the app on an ARM-based macOS system, you may need to clear quarantine attributes. Open your terminal and execute:
> ```bash
> xattr -cr "/Applications/AI.Opensubtitles.com Client.app"
> ```

## Minimum System Requirements

### Linux Requirements
- Ubuntu 18.04+ or equivalent distribution
- GLIBC 2.31 or higher

### Windows Requirements
- Windows 10 or Windows 11 (64-bit architecture)

### macOS Requirements
- macOS 10.14 (Mojave) or newer

## Built-in FFmpeg Support

You do not need to install FFmpeg manually. FFmpeg is automatically bundled with the AI Opensubtitles application to handle all media processing, audio extraction, and format conversions seamlessly.

## Building the Client from Source

If you prefer to compile the application from source code:

```bash
git clone https://github.com/iceman1010/ai-opensubtitles-desktop-client.git
cd ai-opensubtitles-desktop-client
npm install
npm run dev  # Run in development mode
npm run dist:all  # Build standalone installers for your OS
```

### Prerequisites for Compiling
- Node.js 18 or higher
- npm (Node Package Manager)

---
*For next steps, see the [Setup and API Configuration](Setup-and-API-Configuration) guide.*
