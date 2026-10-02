import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Content rules shared with ixian.io, enforced so they can't regress. */

const ROOT = join(import.meta.dirname, '..', 'src');
const files = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) ? [p] : [];
  });

test('no em dashes anywhere in the source', () => {
  const offenders = files(ROOT).filter((f) => readFileSync(f, 'utf8').includes('—')).map((f) => relative(ROOT, f));
  assert.deepEqual(offenders, []);
});

const FILLER =
  /\b(delve|foster|leverag|utiliz|facilitat|empower|streamlin|robust|cutting-edge|paradigm shift|game.changer|tapestry|realm|beacon|multifaceted|meticulous|intricate|paramount|transformative|elevat(?:e|es|ed|ing)\b|embark|supercharg|harness|ever-evolving|it'?s worth noting|it is worth noting|important to note|at the end of the day|when it comes to|at its core|in today'?s world|in the age of|the reality is|the truth is|in order to|going forward|let'?s dive|here'?s the thing|nobody tells you|testament to|pivotal|plays a vital role|this changes everything)/i;

test('no filler words in the copy', () => {
  const offenders = files(ROOT)
    .filter((f) => !f.endsWith('.css'))
    .flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((line, i) => (FILLER.test(line) ? [`${relative(ROOT, f)}:${i + 1}: ${line.match(FILLER)[0]}`] : [])),
    );
  assert.deepEqual(offenders, []);
});

test('outgoing amounts are not red', () => {
  const theme = readFileSync(join(ROOT, 'styles', 'theme.css'), 'utf8');
  const values = [...theme.matchAll(/--ix-flow-out:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(values.length > 0);
  assert.deepEqual(values.filter((v) => v !== 'var(--ix-text)'), []);
});
