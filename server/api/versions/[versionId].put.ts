import { createError, readBody } from 'h3';
import { overwriteVersion } from '../../db/repositories/versions';
import { requireCurrentUser } from '../../utils/auth';
import { parseBody, parseUuidParam, versionUpdateSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const body = parseBody(versionUpdateSchema, await readBody(event));
  const version = await overwriteVersion(parseUuidParam(event, 'versionId'), user.id, body.lyrics);
  if (!version) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found.' });
  }
  return version;
});
