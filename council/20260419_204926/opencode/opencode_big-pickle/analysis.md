

Let me search for version-related configuration and auto-update setup.




I see package.json has version `1.11.2`. Let me examine the main process and config for auto-update logic.




Let me read the specific version comparison logic in main.ts:






Let me understand how releases work. Let me check the generate-update-metadata script and look at the build process:







Let me check the build-scripts folder:



Let me check the project root directly:


Now let me read the generate-update-metadata.js script and check the scripts folder:





Now let me check the scripts folder for the release script:





Let me also check the GitHub Actions workflow and understand the build process:







Let me also check how the built application gets its version in the built/distributed app:






Now I understand the issue! Let me check how the app gets its version for comparison - there was a `require` statement:






Now I have a complete analysis. Let me write out my findings:

---

## Analysis: Infinite Update Loop Bug

### Summary
The application experiences an infinite update loop (1.11.1 → 1.11.2 → 1.11.1 → ...) because the **version comparison logic in the built application fails to correctly identify the current installed version**.

### Root Cause

The bug is in `main/main.ts` at line 625:

```typescript
const currentVersion = require('../../package.json').version;
```

**The Problem:**

1. **In Development**: When running `npm run dev`, the app executes from `dist/main/main.js`, and `../../package.json` correctly resolves to the project root, returning the version (e.g., "1.11.2").

2. **In Production (Built App)**: When Electron packages the application into a distributable (AppImage, .exe, .dmg), the file structure changes. The bundled `main.js` cannot access `../../package.json` the same way because:
   - The packaged app typically runs from a read-only mount point
   - The relative path resolution may fail or return `undefined`
   - Node.js's `require()` may not work the same way in a bundled Electron app
   
3. **Result**: When `currentVersion` becomes `undefined` (or the comparison fails), the comparison `