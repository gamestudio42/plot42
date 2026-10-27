/**
 * Assemble the static Plot 42 site:
 *   /           lobby
 *   /horta/     harvest grid
 *   /posto/     tactics
 *   /mata/      living grove
 *   /sitio/     coffee farm that becomes a village
 *
 * Urbe and Neo Urbe are not built here. The lobby links to their own Pages sites.
 * BASE_PATH is the site root (e.g. /plot42/). Each hosted game is built under that prefix.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const site = join(root, 'site');
const baseRoot = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

/**
 * Builds one app into `dist-site` instead of `dist`. The plain `dist` folders belong to the
 * per-game dev builds that `vite preview` serves, so writing there while a preview server is
 * running would swap the served bundle for one built with a different base path.
 */
function run(filter: string, basePath: string): void {
  execSync(`pnpm --filter ${filter} exec vite build --outDir dist-site --emptyOutDir`, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BASE_PATH: basePath },
  });
}

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

run('@plot42/lobby', baseRoot);
cpSync(join(root, 'apps/lobby/dist-site'), site, { recursive: true });

run('@horta/web', `${baseRoot}horta/`);
cpSync(join(root, 'apps/horta/dist-site'), join(site, 'horta'), { recursive: true });

run('@posto/web', `${baseRoot}posto/`);
cpSync(join(root, 'apps/posto/dist-site'), join(site, 'posto'), { recursive: true });

run('@mata/web', `${baseRoot}mata/`);
cpSync(join(root, 'apps/mata/dist-site'), join(site, 'mata'), { recursive: true });

run('@sitio/web', `${baseRoot}sitio/`);
cpSync(join(root, 'apps/sitio/dist-site'), join(site, 'sitio'), { recursive: true });

console.log(`Assembled site/ with BASE_PATH=${baseRoot}`);
