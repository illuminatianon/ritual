export type StyleMetadataSource = 'manual' | 'import' | 'generated' | 'model-edit';

const supportedSources = new Set<StyleMetadataSource>(['manual', 'import', 'generated', 'model-edit']);

export function serializeStyleMetadata(metadata: Record<string, unknown> | undefined, defaultSource: StyleMetadataSource = 'manual') {
  const source = metadata?.source;
  return JSON.stringify({
    ...metadata,
    source: typeof source === 'string' && supportedSources.has(source as StyleMetadataSource) ? source : defaultSource,
  });
}

export function parseStyleMetadata(metadataJson: string): Record<string, unknown> & { source: StyleMetadataSource } {
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const metadata = parsed as Record<string, unknown>;
      const source = metadata.source;
      return {
        ...metadata,
        source: typeof source === 'string' && supportedSources.has(source as StyleMetadataSource)
          ? source as StyleMetadataSource
          : 'manual',
      };
    }
  } catch {
    // Raw malformed import metadata intentionally remains persisted.
  }
  return { source: 'manual' };
}
