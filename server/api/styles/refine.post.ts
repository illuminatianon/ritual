import { readBody } from 'h3';
import { requestStylePrompt } from '../../utils/style-model';
import { requireCurrentUser } from '../../utils/auth';
import { parseBody, styleRefineSchema } from '../../utils/validation';
export default defineEventHandler(async (event) => { await requireCurrentUser(event); const body = parseBody(styleRefineSchema, await readBody(event)); return requestStylePrompt(body.instruction, { positive_prompt: body.positive_prompt, negative_prompt: body.negative_prompt }); });
