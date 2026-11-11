# Переключение приложения на API тиммейта

Пока API на VPS не готов, приложение ходит в локальный мок:

```bash
npm run mock-api
# EXPO_PUBLIC_API_URL=http://localhost:3000 (значение по умолчанию)
npm start -w app
```

Когда тиммейт задеплоит API:

1. Выставить `EXPO_PUBLIC_API_URL` на публичный URL API (см. `.env.example`).
2. Для EAS preview/production поправить `env.EXPO_PUBLIC_API_URL` в `app/eas.json`.
3. Пройти обязательный путь из `docs/demo-script.md`.
4. Расхождения контракта править в `@picpac/shared` вместе с тиммейтом.

Код приложения менять не нужно: клиент читает только `EXPO_PUBLIC_API_URL` / `extra.apiUrl`.
