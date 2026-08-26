import { readBody } from 'h3';
import { createStyle } from '../../db/repositories/styles';
import { requireCurrentUser } from '../../utils/auth';
import { parseBody, styleCreateSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const body = parseBody(styleCreateSchema, await readBody(event));
  return createStyle({ userId: user.id, name: body.name, positivePrompt: body.positive_prompt, negativePrompt: body.negative_prompt, metadata: body.metadata });
});
