import { createError, type H3Event } from 'h3';
import { findUserById } from '../db/repositories/users';

export async function requireCurrentUser(event: H3Event) {
  const session = await requireUserSession(event);
  const userId = session.user?.id;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication is required.' });
  }

  const user = await findUserById(userId);
  if (!user || !user.active) {
    throw createError({ statusCode: 401, statusMessage: 'Session user is not active.' });
  }
  return user;
}
