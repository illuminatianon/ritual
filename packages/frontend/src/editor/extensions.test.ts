import { describe, expect, it } from 'vitest';
import { countLine } from 'syllable-engine';
import { computeBaselineCountsByCurrentLine } from './extensions';

describe('computeBaselineCountsByCurrentLine', () => {
  it('keeps later lines aligned after a deletion', () => {
    const previous = 'first line\ndelete this\nrow row row your boat\n';
    const current = 'first line\nrow row row your boat\n';

    const counts = computeBaselineCountsByCurrentLine(previous, current);

    expect(counts[1]?.total).toBe(countLine('row row row your boat').total);
  });

  it('pairs a later rewrite after an earlier rewrite', () => {
    const previous = [
      '[verse 1]',
      'i went looking for something i shouldn’t have',
      'i got exactly what i wanted only to watch it burn',
      '',
      'i told myself i really need to know',
      'as if knowing ever helped me let it go',
      '',
    ].join('\n');
    const current = [
      '[verse 1]',
      'i went looking for something i shouldn’t have',
      'i got exactly what i wanted only to watch it',
      '',
      'sds asd i told myself i really need to know',
      'as if knowing ever helped me let it go',
      '',
    ].join('\n');

    const counts = computeBaselineCountsByCurrentLine(previous, current);

    expect(counts[4]?.total).toBe(countLine('i told myself i really need to know').total);
    expect(counts[4]?.total).not.toBe(countLine('sds asd i told myself i really need to know').total);
  });
});
