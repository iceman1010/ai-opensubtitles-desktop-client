# AI.Opensubtitles.com Desktop Client - Agent Instructions

Welcome to the AI.Opensubtitles.com Desktop Client repository. As an AI agent working in this codebase, adhere to the guidelines, architecture, and commands documented below to ensure consistency, stability, and high code quality.

## Overview
This repository contains a cross-platform desktop client built with **Electron**, **React**, **TypeScript**, and **Vite**. The application uses **Fluent-FFMPEG** for local media processing and interacts with the AI.Opensubtitles.com API.

---

## 🛠️ Build, Lint, and Test Commands

### Running the Application
- **Development**: `npm run dev` (starts both the Electron main process and Vite renderer concurrently).
- **Build**: `npm run build` (compiles both processes and copies shared resources).
- **Distribute**: `npm run dist:stable` (Linux AppImage) or `npm run dist:all` (Mac, Win, Linux).

### Testing
- **End-to-End (E2E) Testing (Playwright)**
  - Setup: `cd tests/e2e && npm run setup`
  - Run all E2E tests: `cd tests/e2e && npm run test`
  - Run a single E2E test file: `cd tests/e2e && npx playwright test <filename>`
  - View report: `cd tests/e2e && npm run report`
- **Backend/API Integration Testing**
  - Run all basic tests: `cd tests && npm run test:basic`
  - Run a single test profile: `cd tests && node test-runner.js --profile <profile-name>.json`
  - See `tests/profiles/` for available profile files.

### Linting and Type Checking
The project does not use a standalone ESLint configuration. Rely on the TypeScript compiler to catch errors and enforce typing.
- **Type Check Main Process**: `npm run build:main`
- **Type Check Renderer Process**: `npm run build:renderer`

---

## 🏗️ Architecture
- `main/`: Contains the Electron main process code (`main.ts`, `ffmpeg.ts`, `config.ts`). Responsible for native hardware access, file system access, window management, auto-updating, and FFmpeg wrapping.
- `renderer/src/`: Contains the React/Vite frontend code. Heavily utilizes React Contexts (e.g., `APIContext`, `PowerContext`) for state management.
- `shared/`: Shared JSON schemas and config definitions (e.g., `fileFormats.json`) between main and renderer.
- `tests/`: Automated API integration tests (`test-runner.js`) and End-to-End browser UI tests (`e2e/`).

---

## ✍️ Code Style Guidelines

### 1. Language and Types
- Strictly use **TypeScript**. Minimize the usage of `any` and explicitly define `interfaces` or `types` for API responses, React component props, and IPC event payloads.
- Ensure strict null checks and handle optional values gracefully using `?` and `??`.

### 2. Formatting & Syntax
- Use **2 spaces** for indentation.
- Use **single quotes** for strings (unless double quotes are required for interpolation/JSON).
- Always include trailing **semicolons** `;`.
- Prefer modern ES6+ features (e.g., object destructuring, optional chaining).

### 3. Imports
- Use ES Modules (`import`/`export`).
- For Node.js built-ins in the main process, use the `import * as <module> from '<module>'` pattern (e.g., `import * as fs from 'fs'`).
- Group imports logically:
  1. Node/Electron built-ins
  2. External libraries/packages
  3. Internal module/component imports

### 4. Naming Conventions
- **React Components / Classes / Interfaces**: `PascalCase` (e.g., `MainScreen.tsx`, `ErrorLogger`, `AppConfig`).
- **Variables / Functions / Methods**: `camelCase` (e.g., `pendingFilePaths`, `setDebugLevel`).
- **Global Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`).

### 5. Error Handling and Logging
- **Always wrap `async`/`await` operations** in `try/catch` blocks.
- **Renderer Process Logging**: Use the custom global logger from `renderer/src/utils/errorLogger.ts` (e.g., `logger.error('Failed API call', err)`). Do not use raw `console.log()` in production UI components.
- **Main Process Logging**: Use class instance debug methods (like `this.debug()` inside `MainApp`) to conditionally log based on the user's configured debug level.
- **User Feedback**: In the React frontend, catch errors gracefully and ensure the UI state updates to inform the user. In the main process, use Electron's `dialog.showErrorBox` for critical failures.

### 6. Component and IPC Structure
- React components must be functional components utilizing React Hooks (`useState`, `useEffect`, `useCallback`, `useRef`).
- Keep components single-purpose. Break large UI files into smaller sub-components or custom hooks.
- **Inter-Process Communication (IPC)**: Define strict typings for all IPC events inside `main/preload.ts` and handle them safely via `contextBridge`. Never expose the raw Node or Electron APIs directly to the renderer.

---

## 🤖 Agent-Specific Directives
- **Check Dependencies Before Adding**: Verify existing libraries in `package.json` before introducing new ones. The repository already utilizes `fluent-ffmpeg`, `electron-updater`, and `subtitle` parsing packages. Do not introduce heavy libraries for tasks easily accomplished with native ES6.
- **File System Usage**: File modifications should happen in the **main** process. The React renderer should only handle paths as strings or File objects.
- **No Unprompted Restructuring**: Maintain the current `main/` and `renderer/` divide. Do not attempt to refactor the monolithic `main.ts` unless explicitly instructed to do so.
- **API Awareness**: The app relies heavily on `.env` files and settings in `config.ts` for endpoints. Reference `tests/profiles/` and `renderer/src/contexts/APIContext.tsx` to understand the data structures expected by Opensubtitles.

## ⚠️ Critical Project Rules (from CLAUDE.md)
- **CRITICAL FILE PATH RULE**: NEVER use the system `/tmp/` folder. Always use the project's `tmp/` folder (`/home/iceman/Documents/claude_AI/tmp/` or `./tmp/`).
- **NO AI/CLAUDE MENTIONS**: Never mention Claude, AI, or add any self-promotion anywhere in the codebase, commits, or documentation. No "Generated with Claude" or "Co-Authored-By" lines.
- **Multi-Platform Support**: Always consider Windows, macOS, and Linux together when making changes.
- **Documentation Rules**:
  - Always check `scripts/API_WORKFLOW_DOCUMENTATION.md` before making API changes (The OpenSubtitles AI uses a 2-step async process: initiate → poll for completion).
  - Read `scripts/documentation-guide.md` before modifying any documentation.
  - Never proactively create new `.md` or README files unless explicitly requested. Preference is to edit existing files over creating new ones.
  - Quick releases can be done using `./scripts/release.sh [patch|minor|major]`.
