# AI Opensubtitles FAQ

Find answers to frequently asked questions about the AI Opensubtitles Desktop Client. Learn more about how our auto subtitle generator works, pricing for AI transcription and translation, troubleshooting SRT formatting, and more.

## General Questions

### What is the AI Opensubtitles Desktop Client?
It is a cross-platform desktop application that provides incredibly accurate, AI-powered transcription and translation services utilizing the OpenSubtitles AI API. It helps you transcribe audio to text and translate SRT or VTT subtitle files.

### Is the desktop application free to use?
The software application itself is completely open-source and free to download. However, it operates on a credit-based system for the actual AI transcription and translation services. Credits must be purchased securely from OpenSubtitles.com.

### Which operating systems are supported?
- **Windows**: Windows 10 and Windows 11
- **macOS**: macOS 10.14+ (Supports both Intel and ARM Apple Silicon)
- **Linux**: Ubuntu 18.04+ (and equivalents via AppImage or .deb)

## Installation & Setup

### Do I need to install FFmpeg separately?
No. FFmpeg is automatically bundled and installed with the application to handle all media processing seamlessly.

### Why can't I run the app on my ARM Mac (Apple Silicon)?
macOS security sometimes quarantines new apps. For ARM Macs, you may need to open your terminal and run: 
`xattr -cr "/Applications/AI.Opensubtitles.com Client.app"` 
This allows the application to run securely.

## Credits & AI Pricing

### Where do I buy API credits?
You can purchase credits directly at [ai.opensubtitles.com](https://ai.opensubtitles.com). 
*Note: You must use an Opensubtitles.com account, not an Opensubtitles.org account.*

### How much do transcriptions and translations cost?
Pricing varies depending on the specific AI model you choose (e.g., standard vs. high accuracy) and the total length of your media content. You can always check the "Info" section directly inside the app for the most current pricing structure.

### Can I get a refund for unused credits?
Credit purchases and refunds are managed directly by OpenSubtitles. Please contact their official support team for billing inquiries.

## Troubleshooting

### My transcription fails with a "No credits" error.
This means your OpenSubtitles account does not have sufficient credits to complete the requested operation. Please purchase more credits at ai.opensubtitles.com.

### I'm getting network errors during processing.
The app features a robust automatic retry system with exponential backoff for:
- Server errors (500)
- CloudFlare routing issues
- API Rate limiting
If the error persists, check your internet connection and try again.

### It says my "File format is not supported."
Ensure your media file is one of our supported formats:
- **Video**: MP4, MKV, AVI, MOV, WMV, WebM, FLV, 3GP, etc.
- **Audio**: MP3, WAV, FLAC, AAC, OGG, M4A, WMA, AIFF, etc.
- **Subtitles**: SRT, VTT

### The auto-language detection failed.
While the AI is highly accurate, it can occasionally struggle with heavy background noise or extremely short clips. If auto-detection fails, simply specify the target language manually from the dropdown menu.

## Feature Capabilities

### Can I process multiple files at once?
Yes! Use the [Batch Subtitle Processing](Batch-Subtitle-Processing) feature to queue and process multiple media or subtitle files simultaneously.

### What output formats are supported for subtitles?
You can export subtitles as **SRT** (SubRip Text) or **VTT** (WebVTT), both with full Unicode support for special characters.

### Does the app support automatic updates?
Yes, the application includes a secure automatic updater. You can also manually check for the latest versions in the settings menu.

## Support & Open Source

### Where can I report bugs or request features?
Please visit our official [GitHub Issues page](https://github.com/iceman1010/ai-opensubtitles-desktop-client/issues).

### How can I contribute to the project?
Because this is an open-source tool, we welcome contributions! Feel free to fork the repository, improve the code, and submit a pull request.