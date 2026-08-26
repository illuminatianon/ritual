import { describe, expect, it } from 'vitest';
import { parseModelPrompt } from './style-model';
describe('parseModelPrompt', () => { it('accepts fenced case-insensitive labeled output', () => expect(parseModelPrompt('```\nstyle prompt: electro\nnegative prompt: acoustic\n```')).toEqual({ positive_prompt: 'electro', negative_prompt: 'acoustic' })); it('rejects blank or oversized output', () => { expect(() => parseModelPrompt('STYLE PROMPT:\nNEGATIVE PROMPT:')).toThrow(); expect(() => parseModelPrompt(`STYLE PROMPT: ${'x'.repeat(1001)}\nNEGATIVE PROMPT:`)).toThrow(); }); });
