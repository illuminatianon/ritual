import { readBody } from 'h3';
import { createSong } from '../../db/repositories/songs';
import { requireCurrentUser } from '../../utils/auth';
import { parseBody, songNameSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const body = parseBody(songNameSchema, await readBody(event));
  return createSong(user.id, body.name);
});
