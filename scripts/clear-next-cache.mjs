import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const cacheDirs = ['.next-dev', '.next'].map((dir) => path.join(process.cwd(), dir));

try {
  let cleared = 0;
  for (const cachePath of cacheDirs) {
    if (existsSync(cachePath)) {
      rmSync(cachePath, { recursive: true, force: true });
      cleared += 1;
      console.log(`[dev-cache] Cleared ${path.basename(cachePath)} cache`);
    }
  }

  if (cleared === 0) {
    console.log('[dev-cache] No Next cache directories found, skipping');
  }
} catch (error) {
  console.warn('[dev-cache] Failed to clear Next cache, continuing:', error);
}
