import * as fs from 'fs';
import { promisify } from 'util';

const fsOpen = promisify(fs.open);
const fsRead = promisify(fs.read);
const fsClose = promisify(fs.close);
const fsStat = promisify(fs.stat);

const HASH_CHUNK_SIZE = 65536; // 64 * 1024

/**
 * Calculate OpenSubtitles.com moviehash for a video file.
 * The hash is based on file size and the first and last 64KB of the file.
 *
 * Algorithm:
 * 1. Start with file size as initial hash value
 * 2. Read first 64KB chunk and add all bytes
 * 3. Read last 64KB chunk and add all bytes
 * 4. Store in 8 64-bit integers (little-endian)
 * 5. Convert to 16-character hexadecimal string
 *
 * @param filePath Absolute path to video file
 * @returns 16-character hexadecimal hash string
 */
export async function calculateMovieHash(filePath: string): Promise<string> {
  let fileHandle: number | null = null;

  try {
    // Get file size
    const stats = await fsStat(filePath);
    const fileSize = stats.size;

    if (fileSize < HASH_CHUNK_SIZE) {
      throw new Error('File is too small to calculate hash (minimum 64KB required)');
    }

    // Initialize 8 64-bit integers with file size
    const longs = new Array(8).fill(0);
    let temp = fileSize;
    for (let i = 0; i < 8; i++) {
      longs[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    // Open file for reading
    fileHandle = await fsOpen(filePath, 'r');

    // Read first 64KB chunk
    const firstChunk = Buffer.alloc(HASH_CHUNK_SIZE);
    await fsRead(fileHandle, firstChunk, 0, HASH_CHUNK_SIZE, 0);
    processChunk(firstChunk, longs);

    // Read last 64KB chunk
    const lastChunk = Buffer.alloc(HASH_CHUNK_SIZE);
    await fsRead(fileHandle, lastChunk, 0, HASH_CHUNK_SIZE, fileSize - HASH_CHUNK_SIZE);
    processChunk(lastChunk, longs);

    // Close file
    await fsClose(fileHandle);
    fileHandle = null;

    // Convert to hexadecimal string
    return binl2hex(longs);
  } catch (error) {
    // Ensure file handle is closed on error
    if (fileHandle !== null) {
      try {
        await fsClose(fileHandle);
      } catch (closeError) {
        console.error('Error closing file handle:', closeError);
      }
    }
    throw error;
  }
}

/**
 * Process a chunk of data and add bytes to the hash array
 */
function processChunk(chunk: Buffer, longs: number[]): void {
  for (let i = 0; i < chunk.length; i++) {
    longs[(i + 8) % 8] += chunk[i];
  }
}

/**
 * Convert array of 8 integers to hexadecimal string
 * Handles overflow by propagating carries between bytes
 */
function binl2hex(a: number[]): string {
  const b = 255;
  const d = '0123456789abcdef';
  let e = '';

  // Propagate carries
  a[1] += a[0] >> 8;
  a[0] = a[0] & b;
  a[2] += a[1] >> 8;
  a[1] = a[1] & b;
  a[3] += a[2] >> 8;
  a[2] = a[2] & b;
  a[4] += a[3] >> 8;
  a[3] = a[3] & b;
  a[5] += a[4] >> 8;
  a[4] = a[4] & b;
  a[6] += a[5] >> 8;
  a[5] = a[5] & b;
  a[7] += a[6] >> 8;
  a[6] = a[6] & b;
  a[7] = a[7] & b;

  // Convert to hex string (little-endian byte order)
  for (let c = 7; c > -1; c--) {
    e += d.charAt((a[c] >> 4) & 15) + d.charAt(a[c] & 15);
  }

  return e;
}
