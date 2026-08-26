import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const argument = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const source = argument('--source');
const userId = argument('--user-id');
const dryRun = process.argv.includes('--dry-run');
if (!source || !userId || !process.env.DATABASE_URL) throw new Error('Usage: pnpm import:styler -- --source /path/to/styler.sqlite --user-id <ritual-user-uuid> [--dry-run]');

const fingerprint = createHash('sha256').update(await readFile(source)).digest('hex');
const sqlite = new Database(source, { readonly: true, fileMustExist: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
type LegacyStyle = { id: number | string; name: string; current_version_id: number | string; next_version_number: number; created_at: string; updated_at: string; deleted_at: string | null };
type LegacyVersion = { id: number | string; style_id: number | string; version_number: number; positive_prompt: string; negative_prompt: string; metadata_json: string | null; created_at: string };

try {
  const styles = sqlite.prepare('SELECT id, name, current_version_id, next_version_number, created_at, updated_at, deleted_at FROM styles ORDER BY id').all() as LegacyStyle[];
  const versions = sqlite.prepare('SELECT id, style_id, version_number, positive_prompt, negative_prompt, metadata_json, created_at FROM style_versions ORDER BY style_id, version_number').all() as LegacyVersion[];
  const user = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
  if (user.rowCount !== 1) throw new Error('Target Ritual user does not exist.');
  const byStyle = new Map<string, LegacyVersion[]>();
  for (const version of versions) { const key = String(version.style_id); const group = byStyle.get(key) ?? []; group.push(version); byStyle.set(key, group); }
  for (const style of styles) {
    const group = byStyle.get(String(style.id)) ?? [];
    if (!group.length) throw new Error(`Style ${style.id} has no versions.`);
    if (!group.some((version) => String(version.id) === String(style.current_version_id))) throw new Error(`Style ${style.id} has an invalid current version.`);
  }
  console.log(`Preflight: ${styles.length} styles and ${versions.length} versions; fingerprint ${fingerprint}.`);
  if (dryRun) process.exitCode = 0;
  else for (const legacy of styles) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ledger = await client.query('SELECT 1 FROM style_import_ledger WHERE source_fingerprint = $1 AND legacy_style_id = $2', [fingerprint, String(legacy.id)]);
      if (ledger.rowCount) { await client.query('COMMIT'); continue; }
      const styleId = randomUUID(); const currentId = randomUUID(); const ids = new Map<string, string>([[String(legacy.current_version_id), currentId]]);
      for (const version of byStyle.get(String(legacy.id))!) if (!ids.has(String(version.id))) ids.set(String(version.id), randomUUID());
      await client.query('INSERT INTO styles (id,user_id,name,current_version_id,next_version_number,created_at,updated_at,deleted_at) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7)', [styleId, userId, legacy.name, legacy.next_version_number, legacy.created_at, legacy.updated_at, legacy.deleted_at]);
      for (const version of byStyle.get(String(legacy.id))!) await client.query('INSERT INTO style_versions (id,style_id,version_number,positive_prompt,negative_prompt,metadata_json,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [ids.get(String(version.id)), styleId, version.version_number, version.positive_prompt, version.negative_prompt, version.metadata_json ?? '{"source":"import"}', version.created_at]);
      await client.query('UPDATE styles SET current_version_id = $1 WHERE id = $2', [currentId, styleId]);
      await client.query('INSERT INTO style_import_ledger (source_fingerprint,legacy_style_id,style_id) VALUES ($1,$2,$3)', [fingerprint, String(legacy.id), styleId]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
} finally {
  sqlite.close();
  await pool.end();
}
