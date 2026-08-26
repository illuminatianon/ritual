import { boolean, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const oauthAccounts = pgTable('oauth_accounts', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  ...timestamps,
}, (table) => [unique('oauth_accounts_provider_account_id_unique').on(table.provider, table.providerAccountId)]);

export const songs = pgTable('songs', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nextVersionNumber: integer('next_version_number').notNull().default(1),
  ...timestamps,
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [index('songs_user_archived_updated_idx').on(table.userId, table.archivedAt, table.updatedAt)]);

export const versions = pgTable('versions', {
  id: uuid('id').primaryKey(),
  songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  lyrics: text('lyrics').notNull(),
  label: text('label'),
  ...timestamps,
}, (table) => [unique('versions_song_version_number_unique').on(table.songId, table.versionNumber)]);

export const styles = pgTable('styles', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  currentVersionId: uuid('current_version_id'),
  nextVersionNumber: integer('next_version_number').notNull().default(2),
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [index('styles_user_deleted_updated_idx').on(table.userId, table.deletedAt, table.updatedAt)]);

export const styleVersions = pgTable('style_versions', {
  id: uuid('id').primaryKey(),
  styleId: uuid('style_id').notNull().references(() => styles.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  positivePrompt: text('positive_prompt').notNull(),
  negativePrompt: text('negative_prompt').notNull(),
  metadataJson: text('metadata_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('style_versions_style_version_number_unique').on(table.styleId, table.versionNumber),
  index('style_versions_style_version_idx').on(table.styleId, table.versionNumber),
]);
