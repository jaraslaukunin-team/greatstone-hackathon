import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = readFileSync(join(root, 'picpac-mobile-red.svg'), 'utf8');
const viewBox = src.match(/viewBox="([^"]+)"/)?.[1];
const pathMatches = [...src.matchAll(/<path([^>]*)>/g)];
if (!viewBox || pathMatches.length === 0) throw new Error('failed to parse logo svg');

const paths = pathMatches.map((m) => {
  const attrs = m[1];
  const d = attrs.match(/\sd="([^"]*)"/)?.[1];
  if (!d) throw new Error('path without d');
  const fill = attrs.match(/fill="([^"]+)"/)?.[1] ?? '#dd5656';
  const evenOdd = /fill-rule="evenodd"/i.test(attrs);
  return { d, fill, evenOdd };
});

const brandDir = join(root, 'app', 'assets', 'brand');
mkdirSync(brandDir, { recursive: true });

const clean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">
${paths.map((p) => `  <path fill="${p.fill}"${p.evenOdd ? ' fill-rule="evenodd"' : ''} d="${p.d}"/>`).join('\n')}
</svg>
`;
writeFileSync(join(brandDir, 'logo.svg'), clean);

const copies = [
  ['picpac-mobile-red.svg', 'picpac-red.svg'],
  ['picpac-mobile-white.svg', 'picpac-white.svg'],
  ['picpac-mobile-green.svg', 'picpac-green.svg'],
  ['tile-white-on-beige-mobile.svg', 'tile-white-on-beige.svg'],
  ['tile-red-on-beige-mobile.svg', 'tile-red-on-beige.svg'],
  ['tile-green-on-beige-mobile.svg', 'tile-green-on-beige.svg'],
  ['tile-white-on-red-mobile.svg', 'tile-white-on-red.svg'],
];
for (const [from, to] of copies) {
  copyFileSync(join(root, from), join(brandDir, to));
}

const primary = paths[0];
const secondary = paths[1];
const ts = `/** Пути логотипа PicPac (векторизация брендбука). viewBox ${viewBox}. */
export const logoViewBox = '${viewBox}' as const;
export const logoAspect = ${Number(viewBox.split(' ')[2]) / Number(viewBox.split(' ')[3])};

export type LogoPath = { d: string; evenOdd: boolean; /** если задан — фиксированный fill, иначе цвет Wordmark */ fill?: string };

export const logoPaths: LogoPath[] = [
  { d: ${JSON.stringify(primary.d)}, evenOdd: ${primary.evenOdd} },
${secondary ? `  { d: ${JSON.stringify(secondary.d)}, evenOdd: ${secondary.evenOdd}, fill: ${JSON.stringify(secondary.fill)} },` : ''}
];
`;
writeFileSync(join(root, 'app', 'src', 'ui', 'logoPaths.ts'), ts);
console.log('wrote logo.svg, brand copies, logoPaths.ts; paths', paths.length, 'd lens', paths.map((p) => p.d.length));
