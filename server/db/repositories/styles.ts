import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Style, StyleDetail, StyleVersion } from '../../../shared/types/api';
import { serializeStyleMetadata } from '../../utils/style-metadata';
import { db } from '../client';
import { styles, styleVersions } from '../schema';

type StyleRow = typeof styles.$inferSelect;
type VersionRow = typeof styleVersions.$inferSelect;

function serializeVersion(version: VersionRow): StyleVersion {
  return {
    id: version.id,
    style_id: version.styleId,
    version_number: version.versionNumber,
    positive_prompt: version.positivePrompt,
    negative_prompt: version.negativePrompt,
    metadata_json: version.metadataJson,
    created_at: version.createdAt.toISOString(),
  };
}

function serializeStyle(style: StyleRow, current: VersionRow): Style {
  return {
    id: style.id,
    name: style.name,
    current_version_id: style.currentVersionId!,
    next_version_number: style.nextVersionNumber,
    created_at: style.createdAt.toISOString(),
    updated_at: style.updatedAt.toISOString(),
    deleted_at: style.deletedAt?.toISOString() ?? null,
    current_version: serializeVersion(current),
  };
}

async function getActiveDetail(styleId: string, userId: string): Promise<StyleDetail | null> {
  const [row] = await db.select({ style: styles, current: styleVersions }).from(styles)
    .innerJoin(styleVersions, eq(styles.currentVersionId, styleVersions.id))
    .where(and(eq(styles.id, styleId), eq(styles.userId, userId), isNull(styles.deletedAt))).limit(1);
  if (!row || row.current.styleId !== row.style.id) return null;
  const versionRows = await db.select().from(styleVersions).where(eq(styleVersions.styleId, styleId))
    .orderBy(desc(styleVersions.versionNumber));
  return { ...serializeStyle(row.style, row.current), versions: versionRows.map(serializeVersion) };
}

export async function listStyles(userId: string): Promise<Style[]> {
  const rows = await db.select({ style: styles, current: styleVersions }).from(styles)
    .innerJoin(styleVersions, eq(styles.currentVersionId, styleVersions.id))
    .where(and(eq(styles.userId, userId), isNull(styles.deletedAt)))
    .orderBy(desc(styles.updatedAt), desc(styles.id));
  return rows.filter((row) => row.current.styleId === row.style.id).map((row) => serializeStyle(row.style, row.current));
}

export function findOwnedActiveStyle(styleId: string, userId: string) {
  return getActiveDetail(styleId, userId);
}

export async function createStyle(args: { userId: string; name: string; positivePrompt: string; negativePrompt?: string; metadata?: Record<string, unknown> }): Promise<StyleDetail> {
  const styleId = randomUUID();
  const versionId = randomUUID();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(styles).values({
      id: styleId, userId: args.userId, name: args.name, currentVersionId: null, nextVersionNumber: 2,
      createdAt: now, updatedAt: now,
    });
    await tx.insert(styleVersions).values({
      id: versionId, styleId, versionNumber: 1, positivePrompt: args.positivePrompt,
      negativePrompt: args.negativePrompt ?? '', metadataJson: serializeStyleMetadata(args.metadata), createdAt: now,
    });
    const [style] = await tx.update(styles).set({ currentVersionId: versionId })
      .where(and(eq(styles.id, styleId), eq(styles.userId, args.userId))).returning({ id: styles.id });
    if (!style) throw new Error('Failed to create style.');
  });
  const detail = await getActiveDetail(styleId, args.userId);
  if (!detail) throw new Error('Failed to load created style.');
  return detail;
}

export async function appendStyleVersion(args: { styleId: string; userId: string; name: string; positivePrompt: string; negativePrompt?: string; metadata?: Record<string, unknown> }): Promise<StyleDetail | null> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [style] = await tx.update(styles).set({
      name: args.name, currentVersionId: null, nextVersionNumber: sql`${styles.nextVersionNumber} + 1`, updatedAt: now,
    }).where(and(eq(styles.id, args.styleId), eq(styles.userId, args.userId), isNull(styles.deletedAt)))
      .returning({ id: styles.id, nextVersionNumber: styles.nextVersionNumber });
    if (!style) return null;
    const versionId = randomUUID();
    await tx.insert(styleVersions).values({
      id: versionId, styleId: style.id, versionNumber: style.nextVersionNumber - 1,
      positivePrompt: args.positivePrompt, negativePrompt: args.negativePrompt ?? '',
      metadataJson: serializeStyleMetadata(args.metadata), createdAt: now,
    });
    await tx.update(styles).set({ currentVersionId: versionId }).where(eq(styles.id, style.id));
  }).then(() => getActiveDetail(args.styleId, args.userId));
}

export async function softDeleteStyle(styleId: string, userId: string) {
  const [style] = await db.update(styles).set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(styles.id, styleId), eq(styles.userId, userId), isNull(styles.deletedAt))).returning({ id: styles.id });
  return style ?? null;
}
