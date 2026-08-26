import { listStyles } from '../../db/repositories/styles';
import { requireCurrentUser } from '../../utils/auth';

export default defineEventHandler(async (event) => listStyles((await requireCurrentUser(event)).id));
