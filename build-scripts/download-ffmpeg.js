#!/usr/bin/env node
/**
 * Downloads FFmpeg shared builds into ffmpeg/<plat>-<arch>/lib/ so that
 * electron-builder's `extraResources` can place them next to the app at
 * process.resourcesPath. Pattern adopted from lossless-cut.
 *
 * Sources:
 *   - Windows / Linux: BtbN/FFmpeg-Builds (gpl-shared, dynamic linked, ships
 *     sibling DLLs/.so files that the binary needs at runtime).
 *   - macOS: evermeet.cx (static builds, no shared libs needed).
 *
 * Idempotent: skips targets whose `ffmpeg` binary already exists on disk
 * unless --force is passed.
 *
 * Usage:
 *   node build-scripts/download-ffmpeg.js           # host platform only
 *   node build-scripts/download-ffmpeg.js --all     # every target we ship
 *   node build-scripts/download-ffmpeg.js --force   # re-download even if present
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync } = require('child_process');
const { createGunzip } = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const FFMPEG_DIR = path.join(ROOT, 'ffmpeg');

// BtbN publishes rolling "master-latest" artifacts. The filename is stable
// but the content evolves. We re-download only when --force is passed.
// BtbN's "shared" builds ship: bin/ffmpeg, bin/ffprobe, bin/ffplay (small
// launchers) + lib/libav*.so* (the real code). Both bin and lib contents
// must end up flat in lib/ so LD_LIBRARY_PATH=process.resourcesPath works.
const BTB_BASE = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest';

// Files we want to keep from BtbN's bin/ (drop ffplay — we never call it).
const BTB_BIN_KEEP = new Set(['ffmpeg', 'ffmpeg.exe', 'ffprobe', 'ffprobe.exe']);

const TARGETS = {
  'win32-x64': {
    url: `${BTB_BASE}/ffmpeg-master-latest-win64-gpl-shared.zip`,
    binaryName: 'ffmpeg.exe',
    extract: 'zip',
    // Inside the zip: ffmpeg-master-latest-win64-gpl-shared/{bin,lib,include,...}
    innerRoot: 'ffmpeg-master-latest-win64-gpl-shared',
    // Windows finds sibling DLLs in the same dir as the .exe, so we flatten
    // both bin/*.exe and bin/*.dll into lib/.
    binKeep: (entry) => /\.(exe|dll)$/i.test(entry),
  },
  'linux-x64': {
    url: `${BTB_BASE}/ffmpeg-master-latest-linux64-gpl-shared.tar.xz`,
    binaryName: 'ffmpeg',
    extract: 'tar',
    innerRoot: 'ffmpeg-master-latest-linux64-gpl-shared',
    // Linux needs the .so files next to ffmpeg; LD_LIBRARY_PATH is set by
    // the FFmpegManager at spawn time.
    binKeep: (entry) => BTB_BIN_KEEP.has(entry),
    libKeep: (entry) => /\.so(\.|$)/.test(entry),
  },
  'darwin-x64': {
    // evermeet.cx ships static x64 builds; no shared libs to chase.
    url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
    binaryName: 'ffmpeg',
    extract: 'zip',
    innerRoot: '', // zip root
    binKeep: (entry) => entry === 'ffmpeg',
  },
  // darwin-arm64: not bundled. macOS arm64 users fall back to system/Homebrew
  // FFmpeg detection (already robust) or to the Preferences custom path.
  // Adding a bundled arm64 mac binary is a follow-up if/when needed.
};

function hostTarget() {
  const platform = process.platform;
  const arch = process.arch;
  // BtbN uses 'amd64' in filenames for x64 linux; we expose 'x64' uniformly.
  const key = `${platform}-${arch === 'ia32' ? 'x64' : arch}`;
  return key;
}

function log(...args) {
  console.error('[download-ffmpeg]', ...args);
}

function fetchToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = (currentUrl, redirectsLeft = 5) => {
      https.get(currentUrl, (res) => {
        // Follow redirects (GitHub releases use 302 to CDN).
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          res.resume();
          req(res.headers.location, redirectsLeft - 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${currentUrl}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', (err) => {
        try { fs.unlinkSync(dest); } catch (_) { /* ignore */ }
        reject(err);
      });
    };
    req(url);
  });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function flattenBtbExtract(destDir, spec) {
  // For BtbN shared builds (Windows/Linux), move bin/keep and lib/lib*.so*
  // flat into destDir so the binary + sibling libs sit next to each other.
  // Then remove the now-empty extracted tree to keep the layout clean.
  if (!spec.innerRoot) {
    // Static single-binary (evermeet.cx) — nothing to flatten.
    return;
  }
  const extracted = path.join(destDir, spec.innerRoot);
  if (!fs.existsSync(extracted)) {
    throw new Error(`Expected extracted dir not found: ${extracted}`);
  }
  const moved = [];
  const binDir = path.join(extracted, 'bin');
  if (fs.existsSync(binDir) && spec.binKeep) {
    for (const entry of fs.readdirSync(binDir)) {
      if (spec.binKeep(entry)) {
        const src = path.join(binDir, entry);
        const dst = path.join(destDir, entry);
        if (!fs.existsSync(dst)) {
          fs.renameSync(src, dst);
          fs.chmodSync(dst, 0o755);
          moved.push(entry);
        }
      }
    }
  }
  const libDir = path.join(extracted, 'lib');
  if (fs.existsSync(libDir) && spec.libKeep) {
    for (const entry of fs.readdirSync(libDir)) {
      if (spec.libKeep(entry)) {
        const src = path.join(libDir, entry);
        const dst = path.join(destDir, entry);
        if (!fs.existsSync(dst)) {
          // Some .so entries are symlinks (libavcodec.so -> libavcodec.so.63).
          // Preserve them as symlinks when possible.
          const stat = fs.lstatSync(src);
          try {
            if (stat.isSymbolicLink()) {
              const target = fs.readlinkSync(src);
              fs.symlinkSync(target, dst);
            } else {
              fs.renameSync(src, dst);
            }
          } catch (_) {
            // Fall back to a copy if rename fails (cross-device etc.)
            fs.copyFileSync(src, dst);
          }
          moved.push(entry);
        }
      }
    }
  }
  // Clean up the extracted tree (docs/include/presets/empty dirs).
  try {
    fs.rmSync(extracted, { recursive: true, force: true });
  } catch (err) {
    log(`  warning: could not remove ${extracted}: ${err.message}`);
  }
  const finalBin = path.join(destDir, spec.binaryName);
  if (!fs.existsSync(finalBin)) {
    throw new Error(`After extraction, expected binary not found: ${finalBin} (moved: ${moved.join(', ')})`);
  }
}

function extractZip(zipPath, destDir, spec) {
  // Prefer system `unzip` (Linux/macOS, and Git Bash on Windows CI runners).
  // Fall back to PowerShell's Expand-Archive on native Windows runners that
  // don't have unzip on PATH. Both are zero-dependency.
  ensureDir(destDir);
  const probe = spawnSync('unzip', ['-v'], { stdio: 'ignore' });
  if (probe.status === 0) {
    const result = spawnSync('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`unzip exited ${result.status}`);
  } else if (process.platform === 'win32') {
    // PowerShell Expand-Archive. Quote paths to survive spaces.
    const ps = `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(`PowerShell Expand-Archive exited ${result.status}. Cannot extract ${zipPath}.`);
    }
  } else {
    throw new Error('`unzip` not found on PATH; install it or extract ' + zipPath + ' manually into ' + destDir);
  }
  flattenBtbExtract(destDir, spec);
}

function extractTarXz(tarPath, destDir, spec) {
  ensureDir(destDir);
  // tar with auto-detection of xz. Present on every Linux/macOS we ship to.
  const result = spawnSync('tar', ['-xJf', tarPath, '-C', destDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`tar exited ${result.status}. Make sure xz support is installed.`);
  }
  flattenBtbExtract(destDir, spec);
}

async function fetchTarget(targetKey, force) {
  const spec = TARGETS[targetKey];
  if (!spec) {
    log(`Skipping unknown target: ${targetKey}`);
    return false;
  }
  const libDir = path.join(FFMPEG_DIR, targetKey, 'lib');
  const finalBin = path.join(libDir, spec.binaryName);
  if (!force && fs.existsSync(finalBin)) {
    log(`Already present, skipping: ${targetKey} (${path.relative(ROOT, finalBin)})`);
    return true;
  }
  ensureDir(libDir);
  const archiveName = path.basename(new URL(spec.url).pathname) || `${targetKey}.archive`;
  const archivePath = path.join(FFMPEG_DIR, targetKey, archiveName);
  log(`Downloading ${targetKey}: ${spec.url}`);
  await fetchToFile(spec.url, archivePath);
  const sizeMB = (fs.statSync(archivePath).size / 1024 / 1024).toFixed(1);
  log(`  fetched ${sizeMB} MB`);
  try {
    if (spec.extract === 'zip') {
      extractZip(archivePath, libDir, spec);
    } else if (spec.extract === 'tar') {
      extractTarXz(archivePath, libDir, spec);
    } else {
      throw new Error(`Unknown extract method for ${targetKey}: ${spec.extract}`);
    }
  } finally {
    try { fs.unlinkSync(archivePath); } catch (_) { /* keep archive if extraction failed mid-way */ }
  }
  log(`  OK -> ${path.relative(ROOT, finalBin)}`);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const all = args.includes('--all');

  let targets;
  if (all) {
    targets = Object.keys(TARGETS);
  } else {
    const host = hostTarget();
    if (!TARGETS[host]) {
      log(`Host ${host} has no bundled FFmpeg target. CI builds per-platform so this is fine.`);
      log('Pass --all to fetch every target (useful for local multi-platform packaging).');
      return;
    }
    targets = [host];
  }

  let failures = 0;
  for (const t of targets) {
    try {
      await fetchTarget(t, force);
    } catch (err) {
      log(`FAILED ${t}: ${err.message}`);
      failures++;
    }
  }
  if (failures > 0) {
    log(`${failures} target(s) failed.`);
    process.exit(1);
  }
  log('Done.');
}

main().catch((err) => {
  log('Fatal:', err);
  process.exit(1);
});
