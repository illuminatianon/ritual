import { describe, expect, it } from 'vitest';
import { songNameSchema, styleCreateSchema, styleGenerateSchema, styleRefineSchema } from './validation';

describe('songNameSchema', () => {
  it('accepts whitespace-only names for repository normalization', () => {
    expect(songNameSchema.parse({ name: '   ' }).name).toBe('');
  });

  it('rejects names longer than 200 characters', () => {
    expect(songNameSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('Style validation', () => {
  it('requires bounded prompt pairs and a name', () => {
    expect(styleCreateSchema.safeParse({ name: '  ', positive_prompt: 'prompt' }).success).toBe(false);
    expect(styleCreateSchema.safeParse({ name: 'Style', positive_prompt: '  ' }).success).toBe(false);
    expect(styleCreateSchema.safeParse({ name: 'Style', positive_prompt: 'x'.repeat(1_001) }).success).toBe(false);
    expect(styleCreateSchema.parse({ name: ' Style ', positive_prompt: ' prompt ' })).toMatchObject({ name: 'Style', positive_prompt: 'prompt', negative_prompt: '' });
  });

  it('requires bounded model requests and instructions', () => {
    expect(styleGenerateSchema.safeParse({ request: '' }).success).toBe(false);
    expect(styleGenerateSchema.safeParse({ request: 'x'.repeat(2_001) }).success).toBe(false);
    expect(styleRefineSchema.safeParse({ positive_prompt: 'yes', instruction: '' }).success).toBe(false);
  });
});
