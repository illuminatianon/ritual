import { createError } from 'h3';
import { deleteSong } from '../../db/repositories/songs';
import { requireCurrentUser } from '../../utils/auth';
import { parseUuidParam } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const song = await deleteSong(parseUuidParam(event, 'songId'), user.id);
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: 'Song not found.' });
  }
  return { ok: true };
});
