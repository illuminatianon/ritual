import { createError, readBody } from 'h3';
import { appendStyleVersion } from '../../../../db/repositories/styles';
import { requireCurrentUser } from '../../../../utils/auth';
import { parseBody, parseUuidParam, styleVersionCreateSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const body = parseBody(styleVersionCreateSchema, await readBody(event));
  const style = await appendStyleVersion({
    styleId: parseUuidParam(event, 'styleId'), userId: user.id, name: body.name,
    positivePrompt: body.positive_prompt, negativePrompt: body.negative_prompt, metadata: body.metadata,
  });
  if (!style) throw createError({ statusCode: 404, statusMessage: 'Style not found.' });
  return style;
});
