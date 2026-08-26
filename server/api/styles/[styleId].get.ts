import { createError } from 'h3';
import { findOwnedActiveStyle } from '../../db/repositories/styles';
import { requireCurrentUser } from '../../utils/auth';
import { parseUuidParam } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const detail = await findOwnedActiveStyle(parseUuidParam(event, 'styleId'), (await requireCurrentUser(event)).id);
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Style not found.' });
  return detail;
});
