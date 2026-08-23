import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const defaultBuildDir = '/mnt/d/dev/lumi/ritual';
const buildDir = resolve(process.env.WINDOWS_BUILD_DIR ?? defaultBuildDir);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

function assertCleanHead(repoRoot) {
  const tracked = capture('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: repoRoot });
  const untracked = capture('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoRoot });

  if (tracked || untracked) {
    console.error('[windows-build] commit or stash local changes first; the Windows worktree builds HEAD.');
    process.exit(1);
  }
}

const cmdCheck = spawnSync('cmd.exe', ['/c', 'ver'], { stdio: 'ignore' });

if (cmdCheck.status !== 0) {
  console.error('[windows-build] cmd.exe is required. Run this from WSL on Windows.');
  process.exit(1);
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel']);
assertCleanHead(repoRoot);
const headCommit = capture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });

mkdirSync(dirname(buildDir), { recursive: true });

const existingWorktree = spawnSync('git', ['-C', buildDir, 'rev-parse', '--is-inside-work-tree'], {
  encoding: 'utf8',
  shell: false,
});

if (existingWorktree.status === 0 && existingWorktree.stdout.trim() === 'true') {
  run('git', ['-C', buildDir, 'config', 'core.filemode', 'false']);

  const dirtyTracked = capture('git', ['-C', buildDir, 'status', '--porcelain', '--untracked-files=no']);

  if (dirtyTracked) {
    console.error(`[windows-build] tracked files are modified in ${buildDir}; clean that worktree first.`);
    process.exit(1);
  }

  run('git', ['-C', buildDir, 'checkout', '--detach', headCommit], { cwd: repoRoot });
} else {
  run('git', ['worktree', 'add', '--detach', buildDir, headCommit], { cwd: repoRoot });
  run('git', ['-C', buildDir, 'config', 'core.filemode', 'false']);
}

run(
  'cmd.exe',
  ['/d', '/c', 'pnpm install --frozen-lockfile && pnpm electron:build:windows'],
  { cwd: buildDir },
);
