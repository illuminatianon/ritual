import { describe, expect, it } from 'vitest';
import { parseCombinedPrompt } from './combined-prompt';

describe('parseCombinedPrompt', () => {
  it('turns all supported dash prefixes into no exclusions', () => {
    expect(parseCombinedPrompt('electro, - acoustic, ‐ strings, ‑ brass, ‒ choir, – trap, — piano')).toEqual({ name: 'electro', positive_prompt: 'electro', negative_prompt: 'no acoustic, no strings, no brass, no choir, no trap, no piano' });
  });
});
