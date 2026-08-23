import { createError } from 'h3';
import { loadVersion } from '../../db/repositories/versions';
import { requireCurrentUser } from '../../utils/auth';
import { parseUuidParam } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const version = await loadVersion(parseUuidParam(event, 'versionId'), user.id);
  if (!version) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found.' });
  }
  return version;
});
