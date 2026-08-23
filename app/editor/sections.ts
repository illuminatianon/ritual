import type { Text } from '@codemirror/state';

export interface SectionRange {
  tag: string;
  tagLine: number;
  fromLine: number;
  toLine: number;
}

const SECTION_RE = /^\[(.+)\]$/;

export function isSectionTag(text: string): boolean {
  return SECTION_RE.test(text.trim());
}

export function computeSections(doc: Text): SectionRange[] {
  const sections: SectionRange[] = [];

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const match = line.text.trim().match(SECTION_RE);
    if (!match) {
      continue;
    }

    if (sections.length > 0) {
      sections[sections.length - 1]!.toLine = lineNumber - 1;
    }

    sections.push({
      tag: match[1] ?? '',
      tagLine: lineNumber - 1,
      fromLine: lineNumber,
      toLine: doc.lines,
    });
  }

  return sections;
}
