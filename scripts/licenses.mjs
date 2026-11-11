// Генерирует LICENSES.md: все внешние библиотеки с версиями и лицензиями.
// Запуск из корня репозитория: npm run licenses
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const OWN = new Set(['@picpac/shared', 'api', 'picpac-mobile']);

// npm ls возвращает ненулевой код при любых замечаниях к дереву, но JSON в stdout остаётся валидным.
function tree(args) {
  try {
    return JSON.parse(execSync(`npm ls --all --json ${args}`, { cwd: root, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch (e) {
    return JSON.parse(e.stdout.toString());
  }
}

function manifestPath(name, dir) {
  for (let d = dir; ; d = resolve(d, '..')) {
    const p = join(d, 'node_modules', name, 'package.json');
    if (existsSync(p)) return p;
    if (d === root || d === resolve(d, '..')) return null;
  }
}

function licenseOf(manifest) {
  const l = manifest.license ?? manifest.licenses;
  if (typeof l === 'string') return l;
  if (Array.isArray(l)) return l.map((x) => x.type ?? x).join(' OR ');
  return l?.type ?? 'не указана в package.json';
}

function collect(node, dir, into) {
  for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
    if (OWN.has(name)) {
      collect(dep, dir, into);
      continue;
    }
    const path = manifestPath(name, dir);
    // Необязательные зависимости, которые npm не установил, в проект не попадают.
    if (!path) continue;
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    const version = dep.version ?? manifest.version;
    into.set(`${name}@${version}`, { name, version, license: licenseOf(manifest) });
    collect(dep, resolve(path, '..'), into);
  }
}

const prod = new Map();
collect(tree('--omit=dev'), root, prod);
const all = new Map();
collect(tree(''), root, all);
const dev = new Map([...all].filter(([k]) => !prod.has(k)));

const rows = (m) =>
  [...m.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
    .map((p) => `| ${p.name} | ${p.version} | ${p.license} |`)
    .join('\n');

const text = `# Лицензии внешних библиотек

Файл создаётся командой \`npm run licenses\` из деревьев зависимостей npm; лицензия берётся из \`package.json\` каждого пакета.
Модели и датасеты в проекте не используются: данные синтетические, AI-обработку фото выполняет внешний сервис (aiai.by) по API.

## Работают на сервере и в приложении (${prod.size})

| Пакет | Версия | Лицензия |
|---|---|---|
${rows(prod)}

## Нужны только для разработки и тестов (${dev.size})

| Пакет | Версия | Лицензия |
|---|---|---|
${rows(dev)}
`;
writeFileSync(join(root, 'LICENSES.md'), text);
console.log(`LICENSES.md: ${prod.size} пакетов для запуска, ${dev.size} для разработки`);
