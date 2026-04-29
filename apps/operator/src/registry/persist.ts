import { writeFile, rename, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Atomically write data to path: writeFile(tmp) + rename(tmp, final).
 * Safe on POSIX (same fs rename is atomic). Per RESEARCH Pattern 5.
 */
export async function persist(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, path);
}

/**
 * Load JSON from path. Returns null if file is missing (ENOENT).
 * Throws on other I/O errors.
 */
export async function loadJson(path: string): Promise<unknown | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
