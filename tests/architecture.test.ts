import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('core architecture boundaries', () => {
  for (const name of readdirSync(resolve(__dirname, '../src/core')).filter((f) => f.endsWith('.ts'))) {
    it(`${name} is deterministic and independent of browser/render`, () => {
      const source = readFileSync(resolve(__dirname, '../src/core', name), 'utf8');
      expect(source).not.toMatch(/\bMath\.random\s*\(|\bDate\.now\s*\(|\bconsole\.log\s*\(/);
      expect(source).not.toMatch(/from\s+['"](?:three|.*render.*)['"]/);
      expect(source).not.toMatch(/\b(?:window|document)\s*\./);
    });
  }
});
