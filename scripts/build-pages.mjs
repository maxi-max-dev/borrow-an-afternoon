import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('../', import.meta.url);
const out = new URL('_site/', root);
await mkdir(out, {recursive: true});
// Only public assets are deployed. No server, configuration, or runtime data.
await cp(new URL('public/', root), out, {recursive: true});
const index = await readFile(new URL('index.html', out), 'utf8');
await writeFile(new URL('index.html', out), index.replace('<html lang="zh-CN">', '<html lang="zh-CN" data-mode="pages-demo">'));
await cp(new URL('pages/review.html', root), new URL('review.html', out));
// The review site works without waiting for a third-party font provider.
const css = await readFile(new URL('style.css', out), 'utf8');
await writeFile(new URL('style.css', out), css.replace(/^@import[^\n]*\n/, ''));
await writeFile(new URL('.nojekyll', out), '');
console.log(`Pages demo built: ${fileURLToPath(out)}`);
