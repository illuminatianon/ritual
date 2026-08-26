import { createError } from 'h3';
import { softDeleteStyle } from '../../db/repositories/styles';
import { requireCurrentUser } from '../../utils/auth';
import { parseUuidParam } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const style = await softDeleteStyle(parseUuidParam(event, 'styleId'), (await requireCurrentUser(event)).id);
  if (!style) throw createError({ statusCode: 404, statusMessage: 'Style not found.' });
  return { ok: true };
});
