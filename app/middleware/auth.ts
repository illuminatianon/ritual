export default defineNuxtRouteMiddleware(async () => {
  const { fetch, loggedIn, ready } = useUserSession();
  if (!ready.value) {
    try {
      await fetch();
    } catch {
      // A missing session is an expected unauthenticated state.
    }
  }
  if (!loggedIn.value) {
    return navigateTo('/login');
  }
});
