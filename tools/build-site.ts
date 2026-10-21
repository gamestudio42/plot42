/**
 * Assemble the static Plot 42 site:
 *   /           lobby
 *   /urbe/      city builder
 *   /horta/     harvest grid
 *   /posto/     tactics
 *
 * BASE_PATH is the site root (e.g. /plot42/). Each game is built under that prefix.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const site = join(root, 'site');
const baseRoot = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

function run(filter: string, basePath: string): void {
  execSync(`pnpm --filter ${filter} build`, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BASE_PATH: basePath },
  });
}

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

run('@plot42/lobby', baseRoot);
cpSync(join(root, 'apps/lobby/dist'), site, { recursive: true });

run('@city/web', `${baseRoot}urbe/`);
cpSync(join(root, 'apps/web/dist'), join(site, 'urbe'), { recursive: true });

run('@horta/web', `${baseRoot}horta/`);
cpSync(join(root, 'apps/horta/dist'), join(site, 'horta'), { recursive: true });

run('@posto/web', `${baseRoot}posto/`);
cpSync(join(root, 'apps/posto/dist'), join(site, 'posto'), { recursive: true });

console.log(`Assembled site/ with BASE_PATH=${baseRoot}`);
