import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, output, root } from './build.mjs';

export async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}

export async function check() {
  const { pages } = await build({ quiet: true });
  const allFiles = await files(output);
  const errors = [];
  let references = 0;
  const exists = async filename => { try { return (await stat(filename)).isFile(); } catch { return false; } };
  async function checkReference(reference, origin) {
    if (!reference || /^(?:[a-z]+:|#|\/\/)/i.test(reference)) return;
    const pathname = reference.split(/[?#]/)[0];
    const absolute = pathname.startsWith('/') ? path.join(output, pathname) : path.resolve(path.dirname(origin), pathname);
    references++;
    if (!(await exists(absolute)) && !(await exists(path.join(absolute, 'index.html')))) {
      errors.push(`Missing reference ${reference} in ${path.relative(output, origin)}`);
    }
  }
  for (const file of allFiles) {
    if (file.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      if (/\{\{[A-Z_]+\}\}/.test(html)) errors.push(`Unresolved template in ${file}`);
      if (/raviklaassens\.b-cdn\.net|i\.scdn\.co/.test(html)) errors.push(`Hotlinked artwork in ${file}`);
      for (const match of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) await checkReference(match[1], file);
    }
    if (file.endsWith('.css')) {
      for (const match of (await readFile(file, 'utf8')).matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) await checkReference(match[1], file);
    }
    if (file.endsWith('.js')) {
      const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (syntax.status) errors.push(syntax.stderr);
      const js = await readFile(file, 'utf8');
      for (const match of js.matchAll(/(?:from\s*|import\s*\(?\s*)[`'"](\.\.?\/[^`'"]+\.js)[`'"]/g)) await checkReference(match[1], file);
      for (const match of js.matchAll(/[`'"](vendor\/[^`'"]+\.js)[`'"]/g)) await checkReference('/' + match[1], file);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Passed: ${pages.length} pages, ${allFiles.length} files, ${references} local references, JavaScript syntax and module dependencies.`);
  return { pages, allFiles, references };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await check();
