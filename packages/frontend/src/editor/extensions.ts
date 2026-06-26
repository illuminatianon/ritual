import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, RangeSetBuilder, StateEffect, StateField, type Text } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  ViewPlugin,
  WidgetType,
  type ViewUpdate,
  gutter,
  keymap,
} from '@codemirror/view';
import { diffLines } from 'diff';
import { countLine, type LineWordResult } from 'syllable-engine';
import { computeSections, isSectionTag, type SectionRange } from './sections';

export interface LineCounts {
  total: number;
  words: LineWordResult[];
  isSection: boolean;
}

export const wordChipsCompartment = new Compartment();

interface BaselineSyllables {
  lyrics: string;
  countsByCurrentLine: Array<LineCounts | null>;
}

const setBaselineLyricsEffect = StateEffect.define<string | null>();

export const sectionRangesField = StateField.define<SectionRange[]>({
  create(state) {
    return computeSections(state.doc);
  },
  update(value, transaction) {
    return transaction.docChanged ? computeSections(transaction.state.doc) : value;
  },
});

export const syllableField = StateField.define<LineCounts[]>({
  create(state) {
    return computeAllLines(state);
  },
  update(value, transaction) {
    return transaction.docChanged ? computeAllLines(transaction.state) : value;
  },
});

const baselineSyllableField = StateField.define<BaselineSyllables | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setBaselineLyricsEffect)) {
        return computeBaselineSyllables(effect.value, transaction.state.doc);
      }
    }

    if (transaction.docChanged && value) {
      return computeBaselineSyllables(value.lyrics, transaction.state.doc);
    }

    return value;
  },
});

export function createLyricsExtensions(opts: {
  showWordAnnotations: boolean;
  baselineLyrics: string | null;
  onDirty: (dirty: boolean) => void;
  onActivity: () => void;
}) {
  return [
    oneDark,
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    search({ top: true }),
    sectionRangesField,
    syllableField,
    baselineSyllableField.init((state) => computeBaselineSyllables(opts.baselineLyrics, state.doc)),
    lineSyllableGutter,
    sectionDecorations,
    wordChipsCompartment.of(opts.showWordAnnotations ? wordChipDecorations : []),
    dirtyReporter(opts),
    EditorView.theme({
      '&': {
        height: '100%',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      },
    }),
  ];
}

export function setWordChips(view: EditorView, enabled: boolean) {
  view.dispatch({
    effects: wordChipsCompartment.reconfigure(enabled ? wordChipDecorations : []),
  });
}

export function setBaselineLyrics(view: EditorView, lyrics: string | null) {
  view.dispatch({
    effects: setBaselineLyricsEffect.of(lyrics),
  });
}

function computeAllLines(state: EditorState): LineCounts[] {
  const counts: LineCounts[] = [];
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    counts.push(computeLineCount(line.text));
  }
  return counts;
}

function computeTextLines(text: string | null): LineCounts[] | null {
  if (text == null) {
    return null;
  }

  return text.split(/\r\n?|\n/).map((line) => computeLineCount(line));
}

function computeBaselineSyllables(lyrics: string | null, currentDoc: Text): BaselineSyllables | null {
  if (lyrics == null) {
    return null;
  }

  return {
    lyrics,
    countsByCurrentLine: computeBaselineCountsByCurrentLine(lyrics, currentDoc.toString()),
  };
}

export function computeBaselineCountsByCurrentLine(previous: string, current: string): Array<LineCounts | null> {
  const previousCounts = computeTextLines(previous) ?? [];
  const countsByCurrentLine: Array<LineCounts | null> = [];
  const changes = diffLines(previous, current);
  let previousLine = 0;
  let currentLine = 0;

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];
    const next = changes[index + 1];

    if (change.removed && next?.added) {
      const removedLines = splitDiffChunkLines(change.value);
      const addedLines = splitDiffChunkLines(next.value);
      const pairedLines = Math.min(removedLines.length, addedLines.length);

      for (let offset = 0; offset < pairedLines; offset += 1) {
        countsByCurrentLine[currentLine + offset] = previousCounts[previousLine + offset] ?? null;
      }

      for (let offset = pairedLines; offset < addedLines.length; offset += 1) {
        countsByCurrentLine[currentLine + offset] = null;
      }

      previousLine += removedLines.length;
      currentLine += addedLines.length;
      index += 1;
      continue;
    }

    const lines = splitDiffChunkLines(change.value);

    if (change.added) {
      for (let offset = 0; offset < lines.length; offset += 1) {
        countsByCurrentLine[currentLine + offset] = null;
      }
      currentLine += lines.length;
    } else if (change.removed) {
      previousLine += lines.length;
    } else {
      for (let offset = 0; offset < lines.length; offset += 1) {
        countsByCurrentLine[currentLine + offset] = previousCounts[previousLine + offset] ?? null;
      }
      previousLine += lines.length;
      currentLine += lines.length;
    }
  }

  return countsByCurrentLine;
}

function splitDiffChunkLines(text: string) {
  const lines = text.split(/\r\n?|\n/);

  if (lines.at(-1) === '') {
    lines.pop();
  }

  return lines;
}

function computeLineCount(text: string): LineCounts {
  const isSection = isSectionTag(text);
  const result = isSection ? null : countLine(text);

  return {
    total: result?.total ?? 0,
    words: result?.words ?? [],
    isSection,
  };
}

class SyllableMarker extends GutterMarker {
  constructor(
    private readonly count: number,
    private readonly baselineCount: number | null,
  ) {
    super();
  }

  eq(other: SyllableMarker) {
    return this.count === other.count && this.baselineCount === other.baselineCount;
  }

  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-syllable-count';

    if (this.baselineCount != null && this.baselineCount !== this.count) {
      const baseline = document.createElement('span');
      baseline.className = 'cm-syllable-baseline';
      baseline.textContent = String(this.baselineCount);
      baseline.title = `Selected version meter: ${this.baselineCount}`;
      el.append(baseline);
    }

    const current = document.createElement('span');
    current.className = 'cm-syllable-current';
    current.textContent = String(this.count);
    el.append(current);

    return el;
  }
}

const lineSyllableGutter = gutter({
  class: 'cm-syllable-gutter',
  lineMarker(view, line) {
    const lineNumber = view.state.doc.lineAt(line.from).number - 1;
    const counts = view.state.field(syllableField)[lineNumber];
    const baselineCounts = view.state.field(baselineSyllableField)?.countsByCurrentLine[lineNumber];
    const text = view.state.doc.line(lineNumber + 1).text;
    const baselineTotal = baselineCounts && !baselineCounts.isSection ? baselineCounts.total : null;

    return !counts || counts.isSection || text.trim() === '' ? null : new SyllableMarker(counts.total, baselineTotal);
  },
  lineMarkerChange(update) {
    return update.docChanged || update.startState.field(baselineSyllableField) !== update.state.field(baselineSyllableField);
  },
});

class SectionTotalWidget extends WidgetType {
  constructor(private readonly total: number) {
    super();
  }

  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-section-total';
    el.textContent = String(this.total);
    return el;
  }
}

class WordChipWidget extends WidgetType {
  constructor(
    private readonly count: number,
    private readonly source: string,
  ) {
    super();
  }

  toDOM() {
    const el = document.createElement('span');
    el.className = `cm-word-chip cm-word-chip-${this.source}`;
    el.textContent = String(this.count);
    return el;
  }
}

const sectionDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildSectionDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildSectionDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const wordChipDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildWordDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildWordDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

function buildSectionDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const sections = view.state.field(sectionRangesField);
  const counts = view.state.field(syllableField);

  for (const section of sections) {
    const line = view.state.doc.line(section.tagLine + 1);
    const total = counts
      .slice(section.fromLine, section.toLine)
      .reduce((sum, lineCount) => sum + (lineCount?.total ?? 0), 0);

    builder.add(line.from, line.to, Decoration.mark({ class: 'cm-section-tag' }));
    builder.add(line.to, line.to, Decoration.widget({ widget: new SectionTotalWidget(total), side: 1 }));
  }

  return builder.finish();
}

function buildWordDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const counts = view.state.field(syllableField);

  counts.forEach((lineCount, index) => {
    if (lineCount.isSection) {
      return;
    }

    const line = view.state.doc.line(index + 1);
    for (const word of lineCount.words) {
      const position = line.from + word.to;
      builder.add(
        position,
        position,
        Decoration.widget({
          widget: new WordChipWidget(word.syllableCount, word.source),
          side: 1,
        }),
      );
    }
  });

  return builder.finish();
}

function dirtyReporter(opts: { onDirty: (dirty: boolean) => void; onActivity: () => void }) {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (update.docChanged) {
          opts.onDirty(true);
          opts.onActivity();
        }
      }
    },
  );
}
