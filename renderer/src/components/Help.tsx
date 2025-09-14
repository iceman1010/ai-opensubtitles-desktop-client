import React, { useState } from 'react';
import * as fileFormatsConfig from '../../../shared/fileFormats.json';

interface HelpProps {}

const Help: React.FC<HelpProps> = ({}) => {
  const [activeSection, setActiveSection] = useState<'getting-started' | 'command-line' | 'file-associations' | 'file-formats' | 'transcription' | 'translation' | 'batch-processing' | 'troubleshooting' | 'shortcuts'>('getting-started');

  const sections = {
    'getting-started': {
      title: 'Getting Started',
      content: (
        <div>
          <h3>Welcome to AI.Opensubtitles.com Client</h3>
          <p>This desktop application provides professional-grade transcription and translation services with both single-file and batch processing capabilities. Process individual files with detailed control, or automate bulk operations with advanced workflow management.</p>
          
          <h4>Quick Start</h4>
          <ol>
            <li><strong>Login:</strong> Enter your OpenSubtitles credentials and API key in Preferences</li>
            <li><strong>Choose Processing Mode:</strong> 
              <ul style={{ marginTop: '8px', marginBottom: '8px' }}>
                <li><strong>Single File Screen:</strong> For single files with immediate results and detailed control</li>
                <li><strong>Batch Screen:</strong> For multiple files with automated workflow and bulk processing</li>
              </ul>
            </li>
            <li><strong>Add Files:</strong> Drag & drop or select one or multiple audio/video/subtitle files</li>
            <li><strong>Configure Options:</strong> Choose AI models, languages, and output settings</li>
            <li><strong>Process:</strong> Start processing and monitor progress in real-time</li>
            <li><strong>Review Results:</strong> Preview and save your processed files</li>
          </ol>

          <h4>Main Features</h4>
          <ul>
            <li><strong>Transcription:</strong> Convert audio/video to text subtitles</li>
            <li><strong>Translation:</strong> Translate existing subtitle files to different languages</li>
            <li><strong>Batch Processing:</strong> Process multiple files automatically with advanced workflow control</li>
            <li><strong>Language Detection:</strong> Automatic detection of audio/subtitle language with per-file variants</li>
            <li><strong>Smart Chaining:</strong> Automatically transcribe then translate files in sequence</li>
            <li><strong>Format Support:</strong> Wide range of video, audio, and subtitle formats</li>
          </ul>

          <h4>Processing Modes</h4>
          <ul>
            <li><strong>Single File Screen:</strong> Single file processing with immediate results and detailed control</li>
            <li><strong>Batch Screen:</strong> Multi-file processing with automation, progress tracking, and bulk operations</li>
          </ul>
        </div>
      )
    },
    'command-line': {
      title: 'Command Line Usage',
      content: (
        <div>
          <h3>Command Line Interface</h3>
          <p>The AI.Opensubtitles.com Client supports command line usage for seamless integration with file managers and workflows.</p>

          <h4>Basic Usage</h4>
          <ul>
            <li><strong>Single File:</strong> <code>ai-opensubtitles-client /path/to/video.mp4</code></li>
            <li><strong>Multiple Files:</strong> <code>ai-opensubtitles-client file1.mp4 file2.wav file3.srt</code></li>
            <li><strong>Using Wildcards:</strong> <code>ai-opensubtitles-client *.mp4</code></li>
          </ul>

          <h4>Smart File Routing</h4>
          <p>The application automatically routes files to the appropriate screen:</p>
          <ul>
            <li><strong>Single File:</strong> Opens in Single File screen with the file pre-loaded</li>
            <li><strong>Multiple Files:</strong> Opens in Batch screen with all files added to the queue</li>
          </ul>

          <h4>Supported File Types</h4>
          <p>All command line files are validated against supported formats:</p>
          <ul>
            <li><strong>Video Files:</strong> MP4, MKV, AVI, MOV, WMV, and 24+ other formats</li>
            <li><strong>Audio Files:</strong> MP3, WAV, FLAC, AAC, OGG, and 16+ other formats</li>
            <li><strong>Subtitle Files:</strong> SRT, VTT</li>
          </ul>

          <h4>Integration Examples</h4>
          <ul>
            <li><strong>File Manager:</strong> Right-click → "Open with" → AI.Opensubtitles.com Client</li>
            <li><strong>Terminal:</strong> <code>ai-opensubtitles-client ~/Videos/*.mp4</code></li>
            <li><strong>Scripts:</strong> Batch process entire directories automatically</li>
          </ul>

          <h4>Application Behavior</h4>
          <ul>
            <li><strong>Single Instance:</strong> New files are sent to existing window if app is already running</li>
            <li><strong>Invalid Files:</strong> Unsupported file types are automatically filtered out</li>
            <li><strong>File Paths:</strong> Both absolute and relative paths are supported</li>
            <li><strong>Special Characters:</strong> File paths with spaces and special characters are handled correctly</li>
          </ul>
        </div>
      )
    },
    'file-associations': {
      title: 'File Type Registration',
      content: (
        <div>
          <h3>Operating System Integration</h3>
          <p>Register the AI.Opensubtitles.com Client as the default handler for supported media files to enable seamless workflow integration.</p>

          <h4>File Type Registration</h4>
          <p>Go to <strong>Preferences → File Type Associations</strong> to register the application with your operating system.</p>
          
          <h4>Registration Features</h4>
          <ul>
            <li><strong>Status Display:</strong> See current registration status and number of associated formats</li>
            <li><strong>One-Click Registration:</strong> Register all 52+ supported file types instantly</li>
            <li><strong>Cross-Platform:</strong> Works on Windows, macOS, and Linux with platform-specific methods</li>
            <li><strong>Format Coverage:</strong> Covers all video, audio, and subtitle formats supported by the app</li>
          </ul>

          <h4>Platform-Specific Implementation</h4>
          <ul>
            <li><strong>Windows:</strong> Uses Windows Registry associations with <code>assoc</code> and <code>ftype</code> commands</li>
            <li><strong>Linux:</strong> Creates .desktop file with MIME type associations and updates desktop database</li>
            <li><strong>macOS:</strong> Uses <code>duti</code> command to register file type handlers</li>
          </ul>

          <h4>After Registration</h4>
          <p>Once registered, you can:</p>
          <ul>
            <li><strong>Right-Click Menu:</strong> "Open with AI.Opensubtitles.com Client" option (platform dependent)</li>
            <li><strong>Double-Click:</strong> Set as default application for media files</li>
            <li><strong>Command Line:</strong> Files are automatically routed to appropriate screen</li>
            <li><strong>Drag & Drop:</strong> Enhanced integration with file managers</li>
          </ul>

          <h4>Supported File Types</h4>
          <p>Registration covers all formats supported by the application:</p>
          <ul>
            <li><strong>29 Video Formats:</strong> MP4, MKV, AVI, MOV, WMV, WEBM, FLV, and more</li>
            <li><strong>21 Audio Formats:</strong> MP3, WAV, FLAC, AAC, OGG, M4A, OPUS, and more</li>
            <li><strong>2 Subtitle Formats:</strong> SRT, VTT</li>
          </ul>

          <h4>Troubleshooting Registration</h4>
          <ul>
            <li><strong>Permission Issues:</strong> On Windows/Linux, may require administrator/root privileges for system-wide registration</li>
            <li><strong>Registration Not Working:</strong> Use "Refresh Status" button to check current state</li>
            <li><strong>Partial Registration:</strong> Some formats may register successfully while others fail</li>
            <li><strong>Context Menu Missing:</strong> Right-click integration varies by platform and desktop environment</li>
          </ul>
        </div>
      )
    },
    'file-formats': {
      title: 'Supported File Formats',
      content: (
        <div>
          <h3>Video Formats</h3>
          <p>{fileFormatsConfig.video.map(format => format.toUpperCase()).join(', ')}</p>

          <h3>Audio Formats</h3>
          <p>{fileFormatsConfig.audio.map(format => format.toUpperCase()).join(', ')}</p>

          <h3>Subtitle Formats</h3>
          <p>{fileFormatsConfig.subtitle.map(format => format.toUpperCase()).join(', ')}</p>

          <h4>Processing Notes</h4>
          <ul>
            <li>Video files: Audio is extracted automatically for transcription</li>
            <li>Audio files: Processed directly</li>
            <li>All files: Processing time depends on file size and complexity</li>
          </ul>

          <h4>Best Practices</h4>
          <ul>
            <li>Use high-quality audio for better transcription accuracy</li>
            <li>Avoid heavily compressed audio formats when possible</li>
            <li>Clear speech with minimal background noise works best</li>
          </ul>
        </div>
      )
    },
    'transcription': {
      title: 'Audio Transcription',
      content: (
        <div>
          <h3>How Transcription Works</h3>
          <p>The transcription service converts spoken audio into text subtitles using advanced AI models.</p>

          <h4>Process Steps</h4>
          <ol>
            <li><strong>File Upload:</strong> Audio is extracted from video files automatically</li>
            <li><strong>Language Detection:</strong> System identifies the spoken language</li>
            <li><strong>AI Processing:</strong> Advanced models transcribe speech to text</li>
            <li><strong>Subtitle Generation:</strong> Text is formatted into timed subtitle files</li>
          </ol>

          <h4>Supported Languages</h4>
          <p>The system supports numerous languages with varying model availability. Language detection helps select the best model for your content.</p>

          <h4>Tips for Better Results</h4>
          <ul>
            <li>Use clear, well-recorded audio</li>
            <li>Minimize background noise</li>
            <li>Single speaker works better than multi-speaker content</li>
            <li>Standard speech patterns produce more accurate results</li>
          </ul>

          <h4>Output Format</h4>
          <p>Transcriptions are provided as SRT files with precise timestamps, ready for use with media players or further editing.</p>
        </div>
      )
    },
    'translation': {
      title: 'Subtitle Translation',
      content: (
        <div>
          <h3>How Translation Works</h3>
          <p>The translation service converts subtitle files from one language to another while preserving timing information.</p>

          <h4>Process Steps</h4>
          <ol>
            <li><strong>Upload Subtitles:</strong> Select SRT or VTT subtitle files</li>
            <li><strong>Language Detection:</strong> System identifies source language</li>
            <li><strong>Target Selection:</strong> Choose desired output language</li>
            <li><strong>AI Translation:</strong> Advanced models translate text content</li>
            <li><strong>Format Preservation:</strong> Timing and structure remain intact</li>
          </ol>

          <h4>Language Support</h4>
          <p>Wide range of language pairs supported. The system shows compatible models based on your source language.</p>

          <h4>Quality Features</h4>
          <ul>
            <li>Context-aware translation</li>
            <li>Preservation of subtitle timing</li>
            <li>Handling of special characters and formatting</li>
            <li>Appropriate sentence length for reading speed</li>
          </ul>

          <h4>Best Practices</h4>
          <ul>
            <li>Start with accurate source subtitles</li>
            <li>Review translations for context accuracy</li>
            <li>Consider cultural adaptations for idioms</li>
          </ul>
        </div>
      )
    },
    'batch-processing': {
      title: 'Batch Processing',
      content: (
        <div>
          <h3>Batch Processing Overview</h3>
          <p>The Batch Processing feature allows you to process multiple files automatically with advanced workflow control and intelligent file management.</p>

          <h4>Getting Started with Batch Processing</h4>
          <ol>
            <li><strong>Access Batch Mode:</strong> Click "Batch" in the sidebar to switch to batch processing mode</li>
            <li><strong>Add Multiple Files:</strong> Use "Select Files" button or drag & drop multiple files at once</li>
            <li><strong>Configure Settings:</strong> Set transcription/translation options that apply to all files</li>
            <li><strong>Start Processing:</strong> Click "Start Batch Processing" to process all files sequentially</li>
          </ol>

          <h4>Batch Processing Features</h4>
          <ul>
            <li><strong>Multi-File Selection:</strong> Process dozens of files in one operation</li>
            <li><strong>Smart Language Detection:</strong> Individual language detection for each file</li>
            <li><strong>Per-File Language Selection:</strong> Override detected languages with specific variants (e.g., 'en-US', 'en-GB')</li>
            <li><strong>Mixed File Types:</strong> Process audio, video, and subtitle files together</li>
            <li><strong>Progress Tracking:</strong> Real-time progress for each file and overall batch</li>
            <li><strong>Error Handling:</strong> Continue processing or stop on first error (configurable)</li>
          </ul>

          <h4>Smart Chaining Workflow</h4>
          <p>The powerful chaining feature automatically processes files in sequence:</p>
          <ol>
            <li><strong>Transcription First:</strong> Audio/video files are transcribed to text</li>
            <li><strong>Auto-Translation:</strong> Resulting subtitles are automatically translated</li>
            <li><strong>Language Preservation:</strong> Detected source languages are preserved for translation</li>
            <li><strong>File Management:</strong> Original and intermediate files are handled automatically</li>
          </ol>

          <h4>File Queue Management</h4>
          <ul>
            <li><strong>Reorder Files:</strong> Use ↑ ↓ buttons to change processing order</li>
            <li><strong>Remove Files:</strong> Click × to remove unwanted files from queue</li>
            <li><strong>File Information:</strong> View detected language, file type, and progress for each file</li>
            <li><strong>Individual Settings:</strong> Each file can have different source language variants</li>
          </ul>

          <h4>Advanced Settings</h4>
          <ul>
            <li><strong>Output Directory:</strong> Specify custom output location for all processed files</li>
            <li><strong>Output Format:</strong> Choose subtitle format (SRT, VTT, etc.) for all files</li>
            <li><strong>Intermediate Files:</strong> Keep or delete temporary transcription files</li>
            <li><strong>Error Handling:</strong> Stop on first error or continue processing remaining files</li>
          </ul>

          <h4>Best Practices</h4>
          <ul>
            <li><strong>File Organization:</strong> Group similar files (same language/type) for efficient processing</li>
            <li><strong>Network Stability:</strong> Ensure stable internet connection for large batches</li>
            <li><strong>Credit Planning:</strong> Check available credits before starting large batches</li>
            <li><strong>Test Small Batches:</strong> Start with a few files to verify settings before processing hundreds</li>
            <li><strong>Language Verification:</strong> Review auto-detected languages and adjust variants as needed</li>
          </ul>

          <h4>Batch Processing vs Single File</h4>
          <div style={{ marginTop: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Feature</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Single File</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Batch Processing</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}><strong>File Capacity</strong></td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>One file at a time</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Multiple files simultaneously</td>
                </tr>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}><strong>Workflow</strong></td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Manual per-file processing</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Automated sequential processing</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}><strong>Language Settings</strong></td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Per-session global settings</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Per-file individual settings</td>
                </tr>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}><strong>Chaining</strong></td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Manual transcribe → translate</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Automatic transcribe → translate</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}><strong>Best For</strong></td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Testing, single files, immediate results</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>Large volumes, automation, bulk processing</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4>Troubleshooting Batch Processing</h4>
          <ul>
            <li><strong>Stuck Processing:</strong> Check network connection, restart if needed</li>
            <li><strong>Mixed Results:</strong> Review per-file error messages in the queue display</li>
            <li><strong>Language Issues:</strong> Verify source language selections match file content</li>
            <li><strong>Credit Depletion:</strong> Processing stops when credits are exhausted</li>
            <li><strong>Large Batches:</strong> Consider processing in smaller groups for better reliability</li>
          </ul>
        </div>
      )
    },
    'troubleshooting': {
      title: 'Troubleshooting',
      content: (
        <div>
          <h3>Common Issues & Solutions</h3>

          <h4>Connection Problems</h4>
          <ul>
            <li><strong>Offline Status:</strong> Check internet connection, status shows in bottom bar</li>
            <li><strong>API Errors:</strong> Verify credentials in Preferences, test with simple files first</li>
            <li><strong>Timeout Issues:</strong> Large files may take time, check progress in status bar</li>
          </ul>

          <h4>General Issues</h4>
          <ul>
            <li><strong>Processing Errors:</strong> Check network connection and file format compatibility</li>
            <li><strong>Login Issues:</strong> Verify credentials and API key in Preferences</li>
            <li><strong>File Selection:</strong> Ensure selected files match supported format list above</li>
          </ul>

          <h4>Credits</h4>
          <ul>
            <li><strong>Balance:</strong> Check remaining credits in the sidebar (visible on all screens except login)</li>
            <li><strong>Usage:</strong> Credits are consumed when processing files</li>
            <li><strong>Monitoring:</strong> Credit balance updates in real-time after each operation</li>
          </ul>
        </div>
      )
    },
    'shortcuts': {
      title: 'Keyboard Shortcuts',
      content: (
        <div>
          <h3>Keyboard Shortcuts</h3>

          <h4>Navigation</h4>
          <ul>
            <li><strong>F1:</strong> Open Help (this window)</li>
            <li><strong>Ctrl+1:</strong> Switch to Single File screen</li>
            <li><strong>Ctrl+2:</strong> Switch to Batch screen</li>
            <li><strong>Ctrl+3:</strong> Switch to Info screen</li>
            <li><strong>Ctrl+4:</strong> Switch to Credits screen</li>
            <li><strong>Ctrl+P:</strong> Open Preferences</li>
            <li><strong>Ctrl+U:</strong> Check for Updates</li>
          </ul>

          <h4>File Operations</h4>
          <ul>
            <li><strong>Ctrl+O:</strong> Open file dialog</li>
            <li><strong>Ctrl+D:</strong> Drag & drop area focus</li>
            <li><strong>Escape:</strong> Cancel current operation (when possible)</li>
          </ul>

          <h4>Processing</h4>
          <ul>
            <li><strong>Ctrl+T:</strong> Start transcription (Single File screen, when file selected)</li>
            <li><strong>Ctrl+R:</strong> Start translation (Single File screen, when subtitle selected)</li>
            <li><strong>Ctrl+L:</strong> Detect language (Single File screen)</li>
            <li><strong>Ctrl+B:</strong> Start batch processing (Batch screen, when files queued)</li>
            <li><strong>Ctrl+Shift+L:</strong> Detect languages for all files (Batch screen)</li>
            <li><strong>Ctrl+Shift+C:</strong> Clear batch queue</li>
          </ul>

          <h4>Window Controls</h4>
          <ul>
            <li><strong>Ctrl+Q:</strong> Quit application</li>
            <li><strong>Ctrl+M:</strong> Minimize window</li>
            <li><strong>F11:</strong> Toggle fullscreen</li>
          </ul>

          <h4>Help & Support</h4>
          <ul>
            <li><strong>Ctrl+?:</strong> Open Help</li>
            <li><strong>Ctrl+Shift+D:</strong> Toggle debug mode</li>
          </ul>
        </div>
      )
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
        background: '#f8f9fa'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>Help & Documentation</h1>
      </div>

      {/* Content Area */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* Sidebar Navigation */}
        <div style={{
          width: '250px',
          background: '#f1f3f4',
          borderRight: '1px solid #e0e0e0',
          overflowY: 'auto'
        }}>
          <nav style={{ padding: '20px 0' }}>
            {Object.entries(sections).map(([key, section]) => (
              <button
                key={key}
                onClick={() => setActiveSection(key as keyof typeof sections)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 20px',
                  background: activeSection === key ? '#007bff' : 'transparent',
                  color: activeSection === key ? 'white' : '#333',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  borderLeft: activeSection === key ? '3px solid #0056b3' : '3px solid transparent',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== key) {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== key) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          padding: '30px',
          overflowY: 'auto',
          lineHeight: '1.6'
        }}>
          <style>{`
            .help-content h3 {
              color: #007bff;
              margin-top: 30px;
              margin-bottom: 15px;
              font-size: 20px;
              border-bottom: 2px solid #e9ecef;
              padding-bottom: 5px;
            }
            .help-content h4 {
              color: #495057;
              margin-top: 25px;
              margin-bottom: 12px;
              font-size: 16px;
            }
            .help-content p {
              margin-bottom: 15px;
              color: #666;
            }
            .help-content ul, .help-content ol {
              margin-bottom: 20px;
              padding-left: 25px;
            }
            .help-content li {
              margin-bottom: 8px;
              color: #555;
            }
            .help-content li strong {
              color: #333;
            }
            .help-content code {
              background: #f8f9fa;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
            }
          `}</style>
          <div className="help-content">
            {sections[activeSection].content}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;