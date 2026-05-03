import { describe, expect, it } from 'vitest';
import { computeLyricsDiff } from './compute';

describe('computeLyricsDiff', () => {
  it('marks line and word changes', () => {
    const rows = computeLyricsDiff('hello night\n', 'hello bright night\n');

    expect(rows.some((row) => row.type === 'removed')).toBe(true);
    expect(rows.some((row) => row.type === 'added')).toBe(true);
    expect(rows.flatMap((row) => row.parts).some((part) => part.type === 'added')).toBe(true);
  });
});
