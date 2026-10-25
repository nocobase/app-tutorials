import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = mkdtempSync(path.join(tmpdir(), 'activity-log-consumer-'));
const packageName = '@nocobase/app-plugin-tutorial-activity-log';
const run = (args, cwd = directory) =>
  execFileSync('pnpm', args, { cwd, stdio: 'inherit' });
run(['--filter', packageName, 'pack', '--pack-destination', directory], root);
const archive = readdirSync(directory).find((name) => name.endsWith('.tgz'));
assert.ok(archive);
const paths = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
);
for (const relative of new Set(paths.split('\0').filter(Boolean))) {
  if (relative.startsWith('packages/')) continue;
  const source = path.join(root, relative);
  if (!existsSync(source)) continue;
  const target = path.join(directory, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
}
const manifestPath = path.join(directory, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.dependencies[packageName] = `file:./${archive}`;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const workspacePath = path.join(directory, 'pnpm-workspace.yaml');
writeFileSync(
  workspacePath,
  readFileSync(workspacePath, 'utf8').replace(
    /^packages:\n {2}- packages\/\*\n\n/,
    '',
  ),
);
run(['install', '--no-frozen-lockfile']);
const installed = JSON.parse(
  readFileSync(
    path.join(directory, 'node_modules', packageName, 'package.json'),
    'utf8',
  ),
);
assert.equal(installed.exports['./server'].import, './dist/server/index.js');
assert.ok(
  existsSync(
    path.join(
      directory,
      'node_modules',
      packageName,
      'dist/database/migrations/.manifest.json',
    ),
  ),
);
assert.ok(
  !existsSync(
    path.join(directory, 'node_modules', packageName, 'server/index.ts'),
  ),
);
run(['exec', 'vitest', 'run', '--config', 'vitest.plugin.config.ts']);
run(['typecheck']);
// This CLI version resolves file dependencies from npm during production packaging.
// Verify compiled client consumption here; run the full deployment build in the workspace.
run(['exec', 'vite', 'build']);
console.log(
  `Verified compiled plugin in an independent consumer: ${directory}`,
);
