import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = readFileSync(join(root, 'picpac-red.svg'), 'utf8');
const viewBox = src.match(/viewBox="([^"]+)"/)?.[1];
const d = src.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
if (!viewBox || !d) throw new Error('failed to parse logo svg');

const brandDir = join(root, 'app', 'assets', 'brand');
mkdirSync(brandDir, { recursive: true });

const clean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">
  <path fill="#dd5656" fill-rule="evenodd" d="${d}"/>
</svg>
`;
writeFileSync(join(brandDir, 'logo.svg'), clean);

for (const f of [
  'picpac-red.svg',
  'picpac-white.svg',
  'picpac-green.svg',
  'tile-white-on-beige.svg',
  'tile-red-on-beige.svg',
  'tile-green-on-beige.svg',
  'tile-white-on-red.svg',
]) {
  copyFileSync(join(root, f), join(brandDir, f));
}

const ts = `/** Пути логотипа PicPac (векторизация брендбука). viewBox ${viewBox}. */
export const logoViewBox = '${viewBox}' as const;
export const logoAspect = ${Number(viewBox.split(' ')[2]) / Number(viewBox.split(' ')[3])};

export type LogoPath = { d: string; evenOdd: boolean };

export const logoPaths: LogoPath[] = [
  { d: ${JSON.stringify(d)}, evenOdd: true },
];
`;
writeFileSync(join(root, 'app', 'src', 'ui', 'logoPaths.ts'), ts);
console.log('wrote logo.svg, brand copies, logoPaths.ts; d length', d.length);
