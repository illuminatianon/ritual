import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const electronVersion = require('electron/package.json').version;
const betterSqliteDir = dirname(require.resolve('better-sqlite3/package.json'));
const prebuildInstall = join(betterSqliteDir, 'node_modules', '.bin', 'prebuild-install');

const env = {
  ...process.env,
  npm_config_arch: process.arch,
  npm_config_platform: process.platform,
  npm_config_runtime: 'electron',
  npm_config_target: electronVersion,
};

console.log(
  `[electron:deps] installing better-sqlite3 for Electron ${electronVersion} (${process.platform}-${process.arch})`,
);

const result = spawnSync(
  prebuildInstall,
  ['--runtime', 'electron', '--target', electronVersion, '--platform', process.platform, '--arch', process.arch],
  {
    cwd: betterSqliteDir,
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
