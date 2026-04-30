import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('apps/mcp/src — stdout hygiene (Pitfall 1)', () => {
  it('no console.log anywhere in src/ except util/log.ts (which uses console.error)', () => {
    const srcRoot = path.resolve(__dirname, '../src');
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      const rel = path.relative(srcRoot, file);
      // util/log.ts intentionally documents the "console.log" landmine in a comment;
      // it uses console.error in code. Skip it from the grep.
      if (rel === 'util/log.ts' || rel === path.join('util', 'log.ts')) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/\bconsole\.log\b/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
