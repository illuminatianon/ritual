import { readBody } from 'h3';
import { requestStylePrompt } from '../../utils/style-model';
import { requireCurrentUser } from '../../utils/auth';
import { parseBody, styleGenerateSchema } from '../../utils/validation';
export default defineEventHandler(async (event) => { await requireCurrentUser(event); return requestStylePrompt(parseBody(styleGenerateSchema, await readBody(event)).request); });
