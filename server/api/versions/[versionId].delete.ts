import { createError } from 'h3';
import { deleteVersion } from '../../db/repositories/versions';
import { requireCurrentUser } from '../../utils/auth';
import { parseUuidParam } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const version = await deleteVersion(parseUuidParam(event, 'versionId'), user.id);
  if (!version) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found.' });
  }
  return { ok: true };
});
