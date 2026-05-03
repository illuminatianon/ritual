import cmudictSeed from '../data/cmudict.json';

export type CountSource = 'cmu' | 'custom' | 'heuristic';
export type OverrideScope = 'global' | 'song' | 'line';

export interface CustomWordEntry {
  text: string;
  normalized: string;
  syllables: string[];
  stress: Array<'0' | '1' | '2'>;
  phones?: string[];
  note?: string;
  scope: OverrideScope;
}

export interface CountOptions {
  songOverrides?: CustomWordEntry[];
  lineOverrides?: CustomWordEntry[];
}

export interface WordResult {
  word: string;
  normalized: string;
  syllableCount: number;
  stress: string;
  source: CountSource;
  phones?: string[];
}

export interface Token {
  type: 'word' | 'space' | 'punctuation';
  text: string;
  from: number;
  to: number;
}

export interface LineWordResult extends WordResult {
  from: number;
  to: number;
}

export interface LineResult {
  text: string;
  total: number;
  tokens: Token[];
  words: LineWordResult[];
}

export interface WordAnalysis {
  word: string;
  normalized: string;
  candidates: Array<{
    label: string;
    syllables: string[];
    stress: string;
    phones?: string[];
    source: CountSource;
  }>;
  selectedCandidateId: string;
}

type Dict = Record<string, string[][]>;

const cmudict = cmudictSeed as Dict;
let userDictionary: CustomWordEntry[] = [];

export async function loadDict(): Promise<void> {
  await Promise.resolve();
}

export function setUserDictionary(entries: CustomWordEntry[]): void {
  userDictionary = entries.map((entry) => ({ ...entry, normalized: normalizeWord(entry.normalized || entry.text) }));
}

export function countLine(text: string, opts?: CountOptions): LineResult {
  const tokens = tokenize(text);
  const words = tokens
    .filter((token) => token.type === 'word')
    .map((token) => ({
      ...countWord(token.text, opts),
      from: token.from,
      to: token.to,
    }));

  return {
    text,
    tokens,
    words,
    total: words.reduce((sum, word) => sum + word.syllableCount, 0),
  };
}

export function countWord(word: string, opts?: CountOptions): WordResult {
  const normalized = normalizeWord(word);
  if (!normalized) {
    return { word, normalized, syllableCount: 0, stress: '', source: 'heuristic' };
  }

  const override = findOverride(normalized, opts);
  if (override) {
    return {
      word,
      normalized,
      syllableCount: override.syllables.length,
      stress: override.stress.join(''),
      source: 'custom',
      phones: override.phones,
    };
  }

  const phones = cmudict[normalized]?.[0];
  if (phones) {
    const stress = phones.filter((phone) => /[012]$/.test(phone)).map((phone) => phone.at(-1)).join('');
    return {
      word,
      normalized,
      syllableCount: Math.max(stress.length, 1),
      stress,
      source: 'cmu',
      phones,
    };
  }

  const syllableCount = heuristicSyllableCount(normalized);
  return {
    word,
    normalized,
    syllableCount,
    stress: syllableCount > 0 ? `1${'0'.repeat(Math.max(syllableCount - 1, 0))}` : '',
    source: 'heuristic',
  };
}

export function analyzeWord(word: string): WordAnalysis {
  const normalized = normalizeWord(word);
  const result = countWord(word);
  return {
    word,
    normalized,
    selectedCandidateId: 'selected',
    candidates: [
      {
        label: result.source === 'cmu' ? 'CMU #1' : result.source,
        syllables: [word],
        stress: result.stress,
        phones: result.phones,
        source: result.source,
      },
    ],
  };
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /[A-Za-z]+(?:['’][A-Za-z]+)?|\s+|./g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const value = match[0];
    const from = match.index;
    const to = from + value.length;
    tokens.push({
      type: /^[A-Za-z]/.test(value) ? 'word' : /^\s+$/.test(value) ? 'space' : 'punctuation',
      text: value,
      from,
      to,
    });
  }

  return tokens;
}

export function normalizeWord(word: string): string {
  return word
    .toUpperCase()
    .replace(/[’]/g, "'")
    .replace(/^[^A-Z']+|[^A-Z']+$/g, '')
    .replace(/'/g, '');
}

function findOverride(normalized: string, opts?: CountOptions): CustomWordEntry | undefined {
  return (
    opts?.lineOverrides?.find((entry) => normalizeWord(entry.normalized || entry.text) === normalized) ??
    opts?.songOverrides?.find((entry) => normalizeWord(entry.normalized || entry.text) === normalized) ??
    userDictionary.find((entry) => entry.normalized === normalized)
  );
}

function heuristicSyllableCount(word: string): number {
  const lower = word.toLowerCase();
  if (!lower) {
    return 0;
  }

  const withoutSilentE = lower.length > 3 ? lower.replace(/e$/, '') : lower;
  const groups = withoutSilentE.match(/[aeiouy]+/g);
  return Math.max(groups?.length ?? 1, 1);
}
