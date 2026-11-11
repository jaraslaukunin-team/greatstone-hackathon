/**
 * Подхватывает все файлы Futura PT из `assets/fonts/futura-pt/`.
 * Имя семейства = имя файла без расширения (FuturaPT-Demi.otf → "FuturaPT-Demi").
 * Если папка пуста, возвращается пустой объект и работает системный шрифт.
 */
declare const require: {
  context(
    path: string,
    deep: boolean,
    filter: RegExp,
  ): { keys(): string[]; (id: string): number };
};

const context = require.context('../../assets/fonts/futura-pt', false, /\.(otf|ttf)$/);

export const futuraFonts: Record<string, number> = Object.fromEntries(
  context.keys().map((key) => [key.replace(/^\.\//, '').replace(/\.(otf|ttf)$/, ''), context(key)]),
);
