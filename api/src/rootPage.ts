// Страница-визитка для браузера: показывает, что сервис жив. Без внешних шрифтов и скриптов.
export function renderRootPage(): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>picPac API</title>
<style>
  :root { --bg: #faf7f2; --fg: #1f1b16; --muted: #6b645b; --card: #ffffff; --line: #e6dfd4; --ok: #2f8f5b; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #151311; --fg: #f3eee6; --muted: #a59d92; --card: #201d1a; --line: #332f2a; --ok: #5cc48a; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
         background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 520px; background: var(--card); border: 1px solid var(--line);
         border-radius: 16px; padding: 28px 24px; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  p { margin: 8px 0; color: var(--muted); }
  .status { display: inline-flex; align-items: center; gap: 8px; margin: 12px 0 8px; font-weight: 600; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ok); }
  a { color: var(--fg); }
  ul { padding-left: 20px; margin: 8px 0 0; color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>picPac API</h1>
  <div class="status"><span class="dot"></span>Сервис работает</div>
  <p>Это серверная часть мобильного приложения для заказа фотокниг и печати фото. Открывать её в браузере для работы не нужно: приложение обращается к ней само.</p>
  <ul>
    <li><a href="/health">Проверка состояния</a></li>
  </ul>
</main>
</body>
</html>`;
}
