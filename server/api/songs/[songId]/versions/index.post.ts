import { createError, readBody } from 'h3';
import { createVersion } from '../../../../db/repositories/versions';
import { requireCurrentUser } from '../../../../utils/auth';
import { parseBody, parseUuidParam, versionCreateSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const body = parseBody(versionCreateSchema, await readBody(event));
  const version = await createVersion({
    songId: parseUuidParam(event, 'songId'),
    userId: user.id,
    lyrics: body.lyrics,
    label: body.label,
  });
  if (!version) {
    throw createError({ statusCode: 404, statusMessage: 'Song not found.' });
  }
  return version;
});
