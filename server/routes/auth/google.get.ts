import { createError, sendRedirect } from 'h3';
import { createUserWithOAuthAccount, findUserByOAuthAccount, normalizeEmail, recordUserLogin } from '../../db/repositories/users';

function isRegistrationAllowed(email: string, mode: string, allowedEmails: string) {
  if (mode === 'open') {
    return true;
  }
  if (mode === 'closed') {
    return false;
  }
  return allowedEmails.split(',').map(normalizeEmail).includes(normalizeEmail(email));
}

export default defineOAuthGoogleEventHandler({
  config: {
    scope: ['openid', 'email', 'profile'],
  },
  async onSuccess(event, { user }) {
    const providerAccountId = typeof user.sub === 'string' ? user.sub : null;
    const email = typeof user.email === 'string' ? user.email : null;
    const emailVerified = user.email_verified === true || user.email_verified === 'true';
    const displayName = typeof user.name === 'string' ? user.name : null;
    const avatarUrl = typeof user.picture === 'string' ? user.picture : null;

    if (!providerAccountId || !email || !emailVerified) {
      throw createError({ statusCode: 403, statusMessage: 'Google must provide a verified email address.' });
    }

    const linkedUser = await findUserByOAuthAccount('google', providerAccountId);
    let localUser;
    if (linkedUser) {
      localUser = await recordUserLogin(linkedUser.id, displayName, avatarUrl);
    } else {
      const config = useRuntimeConfig(event);
      if (!isRegistrationAllowed(email, config.ritualAuthMode, config.ritualAllowedEmails)) {
        throw createError({ statusCode: 403, statusMessage: 'This account is not permitted to register.' });
      }
      localUser = await createUserWithOAuthAccount({
        email,
        displayName,
        avatarUrl,
        provider: 'google',
        providerAccountId,
      });
    }

    if (!localUser?.active) {
      throw createError({ statusCode: 403, statusMessage: 'This account is inactive.' });
    }

    await replaceUserSession(event, {
      user: {
        id: localUser.id,
        email: localUser.email,
        name: localUser.displayName,
        avatarUrl: localUser.avatarUrl,
      },
    });
    return sendRedirect(event, '/');
  },
});
