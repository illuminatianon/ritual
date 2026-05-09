import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState, RangeSetBuilder, StateField } from '@codemirror/state';
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
import { countLine, type LineWordResult } from 'syllable-engine';
import { computeSections, isSectionTag, type SectionRange } from './sections';

export interface LineCounts {
  total: number;
  words: LineWordResult[];
  isSection: boolean;
}

export const wordChipsCompartment = new Compartment();

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

export function createLyricsExtensions(opts: {
  showWordAnnotations: boolean;
  onDirty: (dirty: boolean) => void;
  onActivity: () => void;
}) {
  return [
    oneDark,
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    sectionRangesField,
    syllableField,
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

function computeAllLines(state: EditorState): LineCounts[] {
  const counts: LineCounts[] = [];
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const isSection = isSectionTag(line.text);
    const result = isSection ? null : countLine(line.text);
    counts.push({
      total: result?.total ?? 0,
      words: result?.words ?? [],
      isSection,
    });
  }
  return counts;
}

class SyllableMarker extends GutterMarker {
  constructor(private readonly count: number) {
    super();
  }

  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-syllable-count';
    el.textContent = String(this.count);
    return el;
  }
}

const lineSyllableGutter = gutter({
  class: 'cm-syllable-gutter',
  lineMarker(view, line) {
    const lineNumber = view.state.doc.lineAt(line.from).number - 1;
    const counts = view.state.field(syllableField)[lineNumber];
    const text = view.state.doc.line(lineNumber + 1).text;
    return !counts || counts.isSection || text.trim() === '' ? null : new SyllableMarker(counts.total);
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
