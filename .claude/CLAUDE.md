# AI.Opensubtitles.com Client

## Before Any Work:
1. ✓ **STOP & READ** relevant guide from Documentation section below
2. ✓ **Never modify CLAUDE.md** without reading documentation-guide.md first  
3. ✓ **All API work** requires reading API_WORKFLOW_DOCUMENTATION.md first

## Core Guidelines
- Stay strictly on task
- Minimize token usage
- Ask before assuming
- **CRITICAL: Multi-platform support** - Always consider Windows, macOS, Linux together

## Documentation
- **Quick release**: `./scripts/release.sh [patch|minor|major]`
- **Release process**: `scripts/release-guide.md`
- **Auto-updater**: `scripts/auto-updater-guide.md`
- **API Workflow - REQUIRED READING**: `scripts/API_WORKFLOW_DOCUMENTATION.md` - **CRITICAL**: OpenSubtitles AI uses 2-step async process (initiate → poll for completion)
- **Documentation Strategy - REQUIRED READING**: `scripts/documentation-guide.md` - READ BEFORE modifying any documentation

---
*Detailed instructions in scripts/ folder.*