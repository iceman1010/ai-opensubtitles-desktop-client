# Frequently Asked Questions

## General

### What is AI.Opensubtitles.com Desktop Client?
A cross-platform desktop application that provides AI-powered transcription and translation services using the OpenSubtitles AI API.

### Is it free to use?
The application itself is open source and free. However, it uses a credit-based system for AI transcription and translation services. Credits must be purchased from OpenSubtitles.com.

### Which platforms are supported?
- Windows 10/11
- macOS 10.14+
- Linux (Ubuntu 18.04+ and equivalents)

## Installation

### Do I need to install FFmpeg separately?
No, FFmpeg is automatically included with the application.

### Why can't I run the app on ARM Mac?
For ARM Macs, you need to run: `xattr -cr "/Applications/AI.Opensubtitles.com Client.app"` to allow the app to run.

## Credits & Pricing

### Where do I buy credits?
Purchase credits at [ai.opensubtitles.com](https://ai.opensubtitles.com) using an Opensubtitles.com account (not .org).

### How much do transcriptions cost?
Pricing varies by AI model and content length. Check the "Info" section in the app for current pricing.

### Can I get a refund for unused credits?
Credit refunds are handled by OpenSubtitles. Please contact their support.

## Troubleshooting

### Transcription fails with "No credits"
Your account doesn't have sufficient credits. Purchase more at ai.opensubtitles.com.

### Network errors during processing
The app has an automatic retry system with exponential backoff for:
- Server errors (500)
- CloudFlare issues
- Rate limiting

### File format not supported
Ensure your file is one of the supported formats:
- Video: MP4, MKV, AVI, MOV, WMV, WebM, FLV, 3GP, etc.
- Audio: MP3, WAV, FLAC, AAC, OGG, M4A, WMA, AIFF, etc.
- Subtitles: SRT, VTT

### Auto-detection failed
Manually specify the language if auto-detection doesn't work correctly.

## Features

### Can I process multiple files at once?
Yes, use the Batch Processing feature to process multiple files simultaneously.

### What output formats are supported?
SRT (SubRip Text) and VTT (WebVTT) with full Unicode support.

### Does the app support auto-updates?
Yes, the application includes an automatic updater. You can also manually check for updates in settings.

### Can I open media files directly with the app?
Yes, you can associate the app as the default handler for media and subtitle files.

## Support

### Where can I report issues?
Visit the [GitHub Issues page](https://github.com/iceman1010/ai-opensubtitles-desktop-client/issues).

### How can I contribute to the project?
This is an open-source project. Feel free to fork, improve, and share your modifications.
