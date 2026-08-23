import { createError } from 'h3';
import { listVersions } from '../../../../db/repositories/versions';
import { requireCurrentUser } from '../../../../utils/auth';
import { parseUuidParam } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const versions = await listVersions(parseUuidParam(event, 'songId'), user.id);
  if (!versions) {
    throw createError({ statusCode: 404, statusMessage: 'Song not found.' });
  }
  return versions;
});
