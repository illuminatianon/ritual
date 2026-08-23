import { createError, readBody } from 'h3';
import { renameSong } from '../../db/repositories/songs';
import { requireCurrentUser } from '../../utils/auth';
import { parseBody, parseUuidParam, songNameSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const song = await renameSong(
    parseUuidParam(event, 'songId'),
    user.id,
    parseBody(songNameSchema, await readBody(event)).name,
  );
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: 'Song not found.' });
  }
  return song;
});
