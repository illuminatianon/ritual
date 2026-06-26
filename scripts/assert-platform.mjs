const expectedPlatform = process.argv[2];

if (!expectedPlatform) {
  console.error('[assert-platform] expected platform argument is required');
  process.exit(1);
}

if (process.platform !== expectedPlatform) {
  console.error(
    `[assert-platform] this script must run on ${expectedPlatform}; current platform is ${process.platform}`,
  );
  process.exit(1);
}
