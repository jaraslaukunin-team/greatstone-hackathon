# PicPac — гайд для агентов

## Стек

- Node.js ≥ 20, TypeScript, npm workspaces
- `packages/shared` — типы, zod-схемы, чистая бизнес-логика
- `api` — Fastify 5, Drizzle, Postgres 16, Vitest
- `app` — Expo, Expo Router, TanStack Query, Zustand
- Деньги: целые копейки, валюта `BYN`
- Время: `timestamptz` / ISO 8601 с `Z`

## Структура

```
packages/shared/src/   общие типы и логика
api/src/               HTTP API
app/                   мобильное приложение
docs/specs/            дизайн и UX спецификации
```

## Именование

- Пакет shared: `@picpac/shared`
- DTO: суффикс `DTO` (`UserDTO`, `OrderDTO`)
- Zod-схемы: суффикс `Schema` (`createOrderRequestSchema`)
- Коды ошибок: `SCREAMING_SNAKE` (`LAYOUT_PHOTO_MISSING`)
- Деньги в полях: суффикс `Kop` (`totalKop`)

## Жёсткие правила

1. **Права только в API.** Приложение границей безопасности не является. На каждом запросе проверяются роль и доступ к объекту.
2. **Цены только из API.** В коде приложения нет зашитых тарифов и формул — только отображение ответа `/price-quote` и каталога.
3. Секреты не коммитятся. Значения живут в `.env` на VPS, в репозитории только `.env.example` без значений.
4. Ошибки API: `{ "error": { "code": string, "message": string } }`, `message` по-русски.
5. Тестовые и синтетические данные; зоны касания UI ≥ 44×44.

## Зоны ответственности

| Папка | Ответственность |
| --- | --- |
| `packages/shared` | типы, zod, цена, автомакет, качество |
| `api/src/auth` | вход, JWT, роли |
| `api/src/modules/*` | доменные маршруты и сервисы |
| `api/src/storage` | файлы на диске и подписанные URL |
| `app` | UI и клиентский UX, без бизнес-правил денег и прав |

## Спецификация

- Дизайн / ТЗ: `docs/specs/2026-11-11-picpac-mobile-design.md`
- Экраны и жесты: `docs/specs/2026-11-11-picpac-mobile-ux.md`
- План задач: `2026-11-11-picpac-mobile.md`
