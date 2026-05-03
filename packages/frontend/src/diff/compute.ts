import { diffLines, diffWords } from 'diff';

export interface DiffPart {
  text: string;
  type: 'same' | 'added' | 'removed';
}

export interface DiffRow {
  id: string;
  type: 'same' | 'added' | 'removed';
  parts: DiffPart[];
}

export function computeLyricsDiff(previous: string, current: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const changes = diffLines(previous, current);

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];
    const next = changes[index + 1];

    if (change.removed && next?.added) {
      const removedParts = diffWords(change.value, next.value)
        .filter((part) => !part.added)
        .map((part) => ({ text: part.value, type: part.removed ? 'removed' : 'same' }) satisfies DiffPart);
      const addedParts = diffWords(change.value, next.value)
        .filter((part) => !part.removed)
        .map((part) => ({ text: part.value, type: part.added ? 'added' : 'same' }) satisfies DiffPart);
      rows.push({ id: `${index}-removed`, type: 'removed', parts: removedParts });
      rows.push({ id: `${index}-added`, type: 'added', parts: addedParts });
      index += 1;
      continue;
    }

    rows.push({
      id: String(index),
      type: change.added ? 'added' : change.removed ? 'removed' : 'same',
      parts: [{ text: change.value, type: change.added ? 'added' : change.removed ? 'removed' : 'same' }],
    });
  }

  return rows;
}
