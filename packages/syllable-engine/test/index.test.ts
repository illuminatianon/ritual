import { describe, expect, it } from 'vitest';
import { countLine, countWord, setUserDictionary, tokenize } from '../src';

describe('syllable-engine', () => {
  it('counts CMU words', () => {
    expect(countWord('gently')).toMatchObject({ syllableCount: 2, source: 'cmu', stress: '10' });
  });

  it('falls back to a heuristic for unknown words', () => {
    expect(countWord('starlacing')).toMatchObject({ syllableCount: 3, source: 'heuristic' });
  });

  it('keeps token ranges for words and punctuation', () => {
    expect(tokenize("don't stop.")).toEqual([
      { type: 'word', text: "don't", from: 0, to: 5 },
      { type: 'space', text: ' ', from: 5, to: 6 },
      { type: 'word', text: 'stop', from: 6, to: 10 },
      { type: 'punctuation', text: '.', from: 10, to: 11 },
    ]);
  });

  it('counts empty lines as zero', () => {
    expect(countLine('').total).toBe(0);
  });

  it('applies custom dictionary entries', () => {
    setUserDictionary([
      {
        text: 'fire',
        normalized: 'fire',
        syllables: ['fire'],
        stress: ['1'],
        scope: 'global',
      },
    ]);
    expect(countWord('fire')).toMatchObject({ syllableCount: 1, source: 'custom' });
    setUserDictionary([]);
  });
});
