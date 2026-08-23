import { describe, expect, it } from 'vitest';
import { songNameSchema } from './validation';

describe('songNameSchema', () => {
  it('accepts whitespace-only names for repository normalization', () => {
    expect(songNameSchema.parse({ name: '   ' }).name).toBe('');
  });

  it('rejects names longer than 200 characters', () => {
    expect(songNameSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false);
  });
});
