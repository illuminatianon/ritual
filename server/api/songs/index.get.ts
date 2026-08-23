import { createError, getQuery } from 'h3';
import { listSongs } from '../../db/repositories/songs';
import { requireCurrentUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const archived = getQuery(event).archived;
  if (archived !== undefined && archived !== 'true' && archived !== 'false') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid archived query parameter.' });
  }
  return listSongs(user.id, archived === 'true');
});
