const exclusionPrefix = /^\s*[-‐‑‒–—]\s*/u;

export function parseCombinedPrompt(value: string) {
  const terms = value.split(',').map((term) => term.trim()).filter(Boolean);
  const positive: string[] = [];
  const negative: string[] = [];
  for (const term of terms) {
    if (exclusionPrefix.test(term)) negative.push(`no ${term.replace(exclusionPrefix, '').trim()}`);
    else positive.push(term);
  }
  const name = (positive[0] ?? 'Untitled Style').slice(0, 60);
  return { name, positive_prompt: positive.join(', '), negative_prompt: negative.join(', ') };
}
