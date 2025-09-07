# Documentation Strategy Guide

## Token-Efficient Documentation Philosophy

This project follows a strict token optimization strategy to minimize API costs while maintaining comprehensive documentation. All detailed information should live in code comments or reference files, NOT in CLAUDE.md.

## Documentation Hierarchy

### 1. CLAUDE.md (Ultra-Minimal)
**Purpose**: Essential behavioral guidelines and quick references only
**Max Size**: ~200 tokens
**Contains**:
- Core behavioral guidelines for Claude
- Critical project-wide requirements (e.g., multi-platform support)
- Quick reference to detailed guides
- Nothing else!

### 2. Code Comments (Implementation Details)
**Purpose**: Technical details right where they're used
**Location**: In the actual code files
**Examples**:
- `vite.config.ts` - Asset loading requirements
- `package.json` - Version management rules, file naming issues
- `Login.tsx` - Authentication flow details
- `generate-update-metadata.js` - Metadata file purposes

### 3. Reference Guides (Detailed Processes)
**Purpose**: Step-by-step instructions for complex workflows
**Location**: `scripts/` folder
**Examples**:
- `scripts/release-guide.md` - Complete release process
- `scripts/auto-updater-guide.md` - Auto-updater system details
- `scripts/documentation-guide.md` - This guide

## Creating New Guides

### When to Create a New Guide
Create a new guide when:
- ✅ Process has 3+ steps or is complex
- ✅ Information is referenced occasionally, not every request
- ✅ Details are workflow-specific rather than behavioral
- ✅ Content would add 50+ tokens to CLAUDE.md

Don't create a guide for:
- ❌ Simple one-step processes
- ❌ Information needed in every request
- ❌ Details that belong in code comments

### Guide Creation Process

1. **Create the guide file**:
   ```bash
   # Use descriptive names in scripts/ folder
   scripts/[topic]-guide.md
   ```

2. **Structure the guide**:
   ```markdown
   # [Topic] Guide
   
   ## Overview
   Brief description of what this covers
   
   ## [Section 1]
   Detailed instructions
   
   ## [Section 2]
   More details
   
   ## Common Issues
   Troubleshooting info
   ```

3. **Add reference to CLAUDE.md**:
   ```markdown
   ## Documentation
   - **[Topic]**: `scripts/[topic]-guide.md`
   ```

4. **Keep CLAUDE.md minimal**:
   - Only add one line reference
   - Remove any related details from CLAUDE.md
   - Verify total stays under 200 tokens

### Guide Naming Convention

Use descriptive, action-oriented names:
- ✅ `release-guide.md` - How to create releases
- ✅ `auto-updater-guide.md` - Auto-updater system details
- ✅ `deployment-guide.md` - Deployment processes
- ✅ `testing-guide.md` - Testing procedures
- ❌ `info.md` - Too generic
- ❌ `notes.md` - Too vague

### Referencing Guides

In CLAUDE.md, use this format:
```markdown
## Documentation
- **Quick release**: `./scripts/release.sh [patch|minor|major]`
- **[Topic]**: `scripts/[topic]-guide.md`
```

In conversation, reference like:
```
"For detailed release instructions, read scripts/release-guide.md"
"Check scripts/auto-updater-guide.md for auto-updater details"
```

## Maintaining Token Efficiency

### Regular Cleanup
- Review CLAUDE.md monthly
- Move implementation details to code comments
- Extract complex processes to guides
- Keep CLAUDE.md under 200 tokens

### Red Flags (Move to Guides)
If CLAUDE.md contains:
- Step-by-step instructions
- Code examples longer than one line
- Technical specifications
- Troubleshooting details
- File naming patterns
- Command sequences

### Green Flags (Keep in CLAUDE.md)
Essential items that stay:
- Behavioral guidelines for Claude
- Critical cross-cutting concerns (multi-platform)
- Quick command references
- Guide locations

## Benefits of This Approach

1. **Cost Savings**: 90%+ reduction in tokens per request
2. **Better Code**: Implementation details live with implementation
3. **Maintainability**: Documentation close to what it describes
4. **Scalability**: Can add detailed guides without bloating CLAUDE.md
5. **Findability**: Logical organization by topic

## Example Workflow

User asks about deployment → Claude reads `scripts/deployment-guide.md`
User asks about releases → Claude references `scripts/release-guide.md`
User works on auth → Claude sees comments in `Login.tsx`
User modifies build → Claude sees comments in `vite.config.ts`

This keeps every request minimal while providing rich context when needed.