import fs from 'fs';

/**
 * Crash-safe JSON persistence for the server's file stores.
 *
 * A write goes to a temporary file in the same directory, is flushed to disk and then renamed
 * over the target, so a process killed mid-write leaves the previous file intact. Writes are
 * synchronous, which serialises them within one process. Several server instances sharing a
 * directory would still overwrite each other (last writer wins): see docs/ARCHITECTURE.md.
 */

let tmpCounter = 0;

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameWithRetry(from: string, to: string) {
  // Windows can briefly refuse the rename while another process (antivirus, indexer) reads the target
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err: any) {
      const retryable = err?.code === 'EPERM' || err?.code === 'EACCES' || err?.code === 'EBUSY';
      if (!retryable || attempt >= 5) throw err;
      sleepSync(20 * (attempt + 1));
    }
  }
}

export function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    const fd = fs.openSync(tmpPath, 'w');
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    renameWithRetry(tmpPath, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // nothing to clean up
    }
    throw err;
  }
}

/**
 * Reads a JSON file. Returns undefined when it does not exist. An unparseable file is copied aside
 * (`<file>.corrupt-<timestamp>`) before returning undefined, so the next save cannot destroy data
 * that might still be recoverable.
 */
export function readJsonFile<T = any>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw) as T;
  } catch (err: any) {
    const preserved = `${filePath}.corrupt-${Date.now()}`;
    try {
      fs.copyFileSync(filePath, preserved);
    } catch {
      // keep going: the error below is still reported
    }
    console.error(`[Storage] ${filePath} is not valid JSON (${err?.message}). A copy was kept at ${preserved}.`);
    return undefined;
  }
}
