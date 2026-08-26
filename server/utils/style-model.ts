import { createError } from 'h3';

export interface PromptPair { positive_prompt: string; negative_prompt: string; }

const labels = /^STYLE PROMPT:\s*(.+)\nNEGATIVE PROMPT:\s*(.*)$/is;

export function parseModelPrompt(content: string): PromptPair {
  const stripped = content.trim().replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '').trim();
  const match = stripped.match(labels);
  if (!match || !match[1]?.trim() || match[1].trim().length > 1_000 || (match[2]?.trim().length ?? 0) > 1_000) {
    throw createError({ statusCode: 502, statusMessage: 'Model returned an invalid style prompt.' });
  }
  return { positive_prompt: match[1].trim(), negative_prompt: match[2]?.trim() ?? '' };
}

export async function requestStylePrompt(direction: string, current?: PromptPair): Promise<PromptPair> {
  const config = useRuntimeConfig();
  if (!config.openrouterApiKey) throw createError({ statusCode: 503, statusMessage: 'Style generation is not configured.' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.openrouterApiKey}`, 'Content-Type': 'application/json', ...(config.openrouterSiteUrl ? { 'HTTP-Referer': config.openrouterSiteUrl } : {}), ...(config.openrouterAppName ? { 'X-Title': config.openrouterAppName } : {}) },
      body: JSON.stringify({ model: config.openrouterModel, messages: [{ role: 'system', content: 'Create original Suno-oriented musical traits. Do not mention artists, bands, songs, albums, copyrighted lyrics, voice imitation, or “in the style of”. Use neutral musical-trait substitutions. Respond exactly with STYLE PROMPT and NEGATIVE PROMPT labels.' }, { role: 'user', content: `${current ? `Current positive: ${current.positive_prompt}\nCurrent negative: ${current.negative_prompt}\n` : ''}${direction}` }] }),
    });
    if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Style model request failed.' });
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return parseModelPrompt(body.choices?.[0]?.message?.content ?? '');
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    throw createError({ statusCode: 504, statusMessage: 'Style model request timed out.' });
  } finally { clearTimeout(timeout); }
}
