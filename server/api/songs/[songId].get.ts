import { createError } from 'h3';
import { findOwnedSong } from '../../db/repositories/songs';
import { requireCurrentUser } from '../../utils/auth';
import { parseUuidParam } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const song = await findOwnedSong(parseUuidParam(event, 'songId'), user.id);
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: 'Song not found.' });
  }
  return {
    id: song.id,
    name: song.name,
    created_at: song.createdAt.toISOString(),
    updated_at: song.updatedAt.toISOString(),
    archived_at: song.archivedAt?.toISOString() ?? null,
    next_version_number: song.nextVersionNumber,
  };
});
