# picPac Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать API на VPS, общий пакет бизнес-логики и мобильное приложение Expo, которое проходит обязательный путь трека 2 (фото → автомакет → правки → проверка → заказ → статус) плюс совместный выпускной альбом и AI-редактор.

**Architecture:** npm-монорепозиторий. `packages/shared` хранит типы, zod-схемы и чистую логику (цена, автомакет, проверка качества), которую используют и API, и приложение. `api` на Fastify с Postgres: права проверяются в коде на каждом запросе, фото лежат на диске VPS и выдаются по подписанным ссылкам, AI вызывается через адаптер. `app` на Expo ходит в API по HTTPS с JWT.

**Tech Stack:** Node.js ≥ 20, TypeScript, Fastify 5, zod, Drizzle ORM и drizzle-kit, Postgres 16, Vitest, `image-size`, `exifr`, Docker Compose, Caddy; Expo, Expo Router, TanStack Query, Zustand, AsyncStorage, Reanimated, gesture-handler, `@gorhom/bottom-sheet`, jest-expo.

**Spec:** `docs/specs/2026-11-11-picpac-mobile-design.md`, экраны и жесты: `docs/specs/2026-11-11-picpac-mobile-ux.md`.

**Кто делает:** задачи `S*` и `A*` пишет Claude. Задачи `B*` делают Mioryyy и egop_1k (Claude Code и Cursor), пока обязательный путь не проходит целиком, оба работают над `B1–B9`: один ведёт каталог, фото и проект, второй корзину, заказы и профиль.

## Global Constraints

- Только тестовые и синтетические данные. Секреты и ключи не хранятся в репозитории, только в `.env` на VPS (`.env.example` без значений).
- Деньги: целые копейки, валюта `BYN`. Время: `timestamptz`, в JSON ISO 8601 с `Z`.
- Форматы фото: только `image/jpeg` и `image/png`, проверка по сигнатуре файла, максимум 15 МБ (HEIC конвертируется на устройстве).
- Роли: `customer` и `operator`. Права проверяет API на каждом запросе, приложение границей безопасности не является.
- Ответ об ошибке: `{ "error": { "code": string, "message": string } }`, `message` по-русски и объясняет причину.
- Качество фото: DPI < 150 предупреждение, DPI < 100 серьёзное предупреждение, пустая ячейка блокирует заказ.
- Статусы заказа: `accepted` → `moderation` → `production` → `ready_for_delivery` → `completed`, отдельно `cancelled`. Отменить самому можно только в `accepted`.
- Повтор запроса создания заказа с тем же `Idempotency-Key` не создаёт дубль.
- Журнал `audit_log`: пользователь, время, действие, объект, результат. Отказ в доступе тоже пишется.
- Интерфейс на русском, шрифт и контраст по UX-документу, зоны касания не меньше 44×44.
- Все внешние библиотеки перечислены в `LICENSES.md`.

## Review Focus

Входы и ситуации, которые спецификация подразумевает, но обычные тесты не ловят. Каждый пункт закреплён тестом в задаче-владельце.

1. **Вертикальное фото с iPhone (EXIF-ориентация)** сообщает ширину и высоту наоборот, и DPI считается неверно. Ожидание: размеры берутся с учётом ориентации. Задача `A7`.
2. **Макет ссылается на фото, которого уже нет** (удалено или из чужого проекта). Ожидание: заказ не создаётся, понятная ошибка `LAYOUT_PHOTO_MISSING`. Задача `A8`.
3. **Тот же `Idempotency-Key` с другим содержимым корзины.** Ожидание: `422 IDEMPOTENCY_KEY_REUSED`, а не тихий возврат старого заказа. Задача `A8`.
4. **Промокод в другом регистре, с пробелами, просроченный или на пустую корзину; округление копеек.** Ожидание: код нормализуется, ошибка названа, сумма целая. Задача `A5`.
5. **Один и тот же человек принимает приглашение дважды или организатор принимает своё.** Ожидание: членство не дублируется, повтор безопасен. Задача `A11`.

## File Structure

```
greatstone-hackathon/
  package.json                      workspaces: packages/*, api, app
  tsconfig.base.json
  docker-compose.yml  Caddyfile  .env.example
  AGENTS.md  CLAUDE.md (одна строка @AGENTS.md)  README.md  LICENSES.md
  packages/shared/src/
    types.ts  schemas.ts            DTO и zod-схемы всех эндпоинтов
    money.ts  delivery.ts  pricing.ts
    layout.ts  quality.ts           автомакет и проверка качества
    index.ts
  api/
    src/app.ts  server.ts  config.ts  audit.ts  errors.ts
    src/db/{schema.ts, client.ts, seed.ts}
    src/auth/{plugin.ts, routes.ts}
    src/storage/{storage.ts, diskStorage.ts, signedUrl.ts}
    src/modules/{catalog,projects,photos,quote,orders,operator,support,albums,ai,privacy}/{routes.ts, service.ts}
    src/modules/ai/{provider.ts, aiaiProvider.ts, stubProvider.ts, promptFilter.ts}
    test/helpers.ts  test/<module>.test.ts
    scripts/{smoke.ts, ai-probe.ts}
    fixtures/{photo-ok.jpg, photo-small.jpg, photo-exif-rotated.jpg, ai-result.jpg}
  app/                              Expo, структура в задаче B1
```

---

## Часть 1. Общий пакет и API

### Task S0: Каркас монорепозитория и общие типы

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.env.example`, `AGENTS.md`, `CLAUDE.md`, `packages/shared/{package.json, tsconfig.json, src/types.ts, src/schemas.ts, src/money.ts, src/index.ts}`
- Modify: `.gitignore` (добавить `node_modules`, `dist`, `.env`, `uploads`, `.expo`)
- Test: `packages/shared/src/schemas.test.ts`

**Interfaces:**
- Produces (всё из `@picpac/shared`):
  - `type Kopecks = number` (целое), `formatByn(k: Kopecks): string` → `"87,40 BYN"`.
  - `type Role = 'customer' | 'operator'`, `type OrderStatus`, `type DeliveryMethodId = 'courier_minsk' | 'ems' | 'belpost'`.
  - DTO: `UserDTO {id, role, displayName, isGuest, aiConsent}`, `VariantDTO {id, productId, format, pagesMin, pagesMax, basePriceKop, pricePerPageKop, minDpi, pageWidthCm, leadTimeDays}`, `ProductDTO {id, kind: 'photobook'|'prints'|'graduation', title, description, variants}`, `CatalogDTO {products, delivery, limits}`, `PhotoDTO {id, width, height, takenAt, url, uploadedBy, source: 'gallery'|'ai'}`, `ProjectDTO {id, title, variantId, ownerId, status: 'draft'|'ordered', isShared, expectedMembers, layout, version, updatedAt}`, `QuoteRequest`, `QuoteResponse`, `CreateOrderRequest {projectId, delivery, promoCode?, expectedTotalKop, address?}`, `OrderDTO {id, number, projectId, status, totalKop, currency: 'BYN', delivery, createdAt, history}`, `InteractionDTO`, `AlbumProgressDTO`, `AiJobDTO {id, status: 'pending'|'done'|'failed', reason?, resultPhoto?}`, `ApiErrorBody`.
  - `Layout = { pages: Page[] }`, `Page = { template: 'one'|'two'|'four'|'spread-one'; cells: Cell[]; copies?: number }`, `Cell = { photoId: string | null; crop: { x: number; y: number; scale: number; rotation: 0|90|180|270 } }`.
  - zod-схемы `xxxSchema` для каждого тела запроса и ответа.

- [x] **Step 1: Write the failing test** в `schemas.test.ts`: `createOrderRequestSchema` принимает `{projectId: uuid, delivery: 'ems', expectedTotalKop: 8790}`; отклоняет `delivery: 'dhl'` и дробную сумму `8790.5`; `layoutSchema` отклоняет `scale: 0`; `formatByn(8740)` равно `'87,40 BYN'`.
- [x] **Step 2: Run** `npm test -w @picpac/shared`. Expected: FAIL (схем нет).
- [x] **Step 3: Implement** файлы из списка. В `AGENTS.md`: стек, структура папок, правила именования, «права только в API», «цены только из API», зоны ответственности по папкам, ссылка на спецификацию. `CLAUDE.md` содержит одну строку `@AGENTS.md`.
- [x] **Step 4: Run** `npm test -w @picpac/shared`. Expected: PASS.
- [x] **Step 5: Commit** `chore: монорепозиторий и общие типы`

### Task S1: Доставка и расчёт цены

**Files:**
- Create: `packages/shared/src/delivery.ts`, `packages/shared/src/pricing.ts`
- Test: `packages/shared/src/pricing.test.ts`

**Interfaces:**
- Consumes: `Kopecks`, `DeliveryMethodId` из `S0`.
- Produces:
  - `DELIVERY_METHODS: DeliveryMethod[]` где `DeliveryMethod = {id, title, priceKop, freeFromKop: Kopecks | null, etaDays: [number, number], payOnDelivery: boolean}`. Значения: `courier_minsk` 0 коп., оплата при получении; `ems` 2090, бесплатно от 30000; `belpost` 690, бесплатно от 15000.
  - `normalizePromoCode(raw: string): string` (trim и верхний регистр).
  - `calcPrice(input: { variant: Pick<VariantDTO,'basePriceKop'|'pricePerPageKop'|'pagesMin'>; pages: number; quantity: number; discountPercent: number; delivery: DeliveryMethodId }): PriceBreakdown`, где `PriceBreakdown = {itemsKop, discountKop, deliveryKop, totalKop}`.
  - Формула (описывается в README, ОТ-07): `unit = base + max(0, pages − pagesMin) × pricePerPage`; `items = unit × quantity`; `discount = round(items × percent / 100)`; доставка бесплатна, если `items − discount ≥ freeFrom`; `total = items − discount + delivery`.

- [ ] **Step 1: Write the failing test** `pricing.test.ts`, вариант `{basePriceKop: 8100, pricePerPageKop: 150, pagesMin: 20}`:
  ```ts
  calcPrice({variant, pages: 20, quantity: 1, discountPercent: 0, delivery: 'belpost'}) // items 8100, delivery 690, total 8790
  calcPrice({variant, pages: 30, quantity: 2, discountPercent: 10, delivery: 'belpost'}) // items 19200, discount 1920, delivery 0, total 17280
  calcPrice({variant, pages: 20, quantity: 1, discountPercent: 0, delivery: 'ems'}) // total 10190
  calcPrice({variant, pages: 25, quantity: 1, discountPercent: 15, delivery: 'courier_minsk'}) // items 8850, discount 1328 (1327.5 округляется), total 7522
  normalizePromoCode('  hello10 ') // 'HELLO10'
  ```
- [ ] **Step 2: Run** `npm test -w @picpac/shared -- pricing`. Expected: FAIL.
- [ ] **Step 3: Implement** `DELIVERY_METHODS`, `normalizePromoCode`, `calcPrice` по формуле выше. Округление `Math.round`.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shared): доставка и расчёт цены`

### Task S2: Автомакет и проверка качества

**Files:**
- Create: `packages/shared/src/layout.ts`, `packages/shared/src/quality.ts`
- Test: `packages/shared/src/layout.test.ts`, `packages/shared/src/quality.test.ts`

**Interfaces:**
- Consumes: `Layout`, `Page`, `Cell` из `S0`.
- Produces:
  - `type PhotoMeta = {id: string; width: number; height: number; takenAt: string | null}`.
  - `autoLayout(photos: PhotoMeta[], variant: {pagesMin: number; pagesMax: number}): Layout`. Правила: порядок по `takenAt`, фото без даты в конце в исходном порядке; число страниц не меньше `pagesMin` и не больше `pagesMax`; шаблон `one` для портрета, `two` для двух подряд пейзажей, `four` при 4+ оставшихся фото и нехватке страниц; недостающие страницы до `pagesMin` заполняются пустыми ячейками; при избытке фото возвращается ровно `pagesMax` страниц, а не поместившиеся фото возвращает `unplacedPhotos(layout: Layout, photos: PhotoMeta[]): PhotoMeta[]`.
  - `CELL_WIDTH_FRACTION: Record<Page['template'], number>` = `one` 1, `two` 1, `four` 0.5, `spread-one` 2 (доля ширины страницы).
  - `type QualityIssue = {kind: 'empty-cell' | 'low-dpi' | 'very-low-dpi'; severity: 'blocker' | 'warning'; pageIndex: number; cellIndex: number; dpi?: number}`.
  - `checkQuality(layout: Layout, photos: Record<string, PhotoMeta>, variant: {pageWidthCm: number}): QualityIssue[]`. `dpi = (photo.width / crop.scale) / (pageWidthCm / 2.54 × CELL_WIDTH_FRACTION[template])`.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  // layout.test.ts
  autoLayout(10 фото с takenAt в обратном порядке, {pagesMin: 10, pagesMax: 60}) // страницы идут по возрастанию takenAt
  autoLayout(3 фото, {pagesMin: 10, pagesMax: 60}).pages.length === 10 // добивается пустыми ячейками
  autoLayout(100 фото, {pagesMin: 10, pagesMax: 20}).pages.length <= 20 && unplacedPhotos(...).length > 0
  // портрет 3000×4000 попадает в шаблон 'one'
  // quality.test.ts, pageWidthCm 20 (7.874 дюйма), шаблон 'one'
  // фото 2400 px: dpi ≈ 305 → нет замечаний
  // фото 1000 px: dpi ≈ 127 → low-dpi warning
  // фото 700 px: dpi ≈ 89 → very-low-dpi warning
  // ячейка с photoId null → empty-cell blocker
  // crop.scale 2 удваивает требуемое разрешение: фото 2400 px при scale 2 даёт dpi ≈ 152, без замечаний
  ```
- [ ] **Step 2: Run** `npm test -w @picpac/shared -- layout quality`. Expected: FAIL.
- [ ] **Step 3: Implement** функции. Чистые, без побочных эффектов, без обращений к времени и случайности.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shared): автомакет и проверка качества`

### Task A1: Каркас API, Docker и здоровье сервиса

**Files:**
- Create: `api/package.json`, `api/tsconfig.json`, `api/src/{app.ts, server.ts, config.ts, errors.ts}`, `docker-compose.yml` (сервисы `db`, `api`), `api/test/helpers.ts`
- Test: `api/test/health.test.ts`

**Interfaces:**
- Produces:
  - `buildApp(overrides?: Partial<Config>): Promise<FastifyInstance>`.
  - `loadConfig(env: NodeJS.ProcessEnv): Config` с полями `databaseUrl, jwtSecret, fileUrlSecret, uploadDir, demoMode, aiProvider, aiaiBaseUrl, aiaiApiKey, aiaiModel, aiaiEditMode`. Отсутствие обязательного значения кидает понятную ошибку при старте.
  - `class AppError extends Error { constructor(status: number, code: string, message: string) }`, глобальный обработчик превращает её в `ApiErrorBody`, а неизвестные ошибки в `500 INTERNAL` без утечки деталей.
  - `testApp(): Promise<{app: FastifyInstance; db: Db; reset(): Promise<void>}>` в `helpers.ts`.

- [ ] **Step 1: Write the failing test:** `GET /health` отвечает `200 {status: 'ok'}`; запрос к несуществующему пути отвечает `404` в формате `ApiErrorBody`; `loadConfig({})` бросает ошибку с названием отсутствующей переменной.
- [ ] **Step 2: Run** `npm test -w api -- health`. Expected: FAIL.
- [ ] **Step 3: Implement** каркас. В `docker-compose.yml` `db` это `postgres:16` с томом и healthcheck, `DATABASE_URL_TEST` указывает на отдельную базу `picpac_test`.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): каркас, конфиг и обработка ошибок`

### Task A2: Схема базы, миграции и сид

**Files:**
- Create: `api/src/db/{schema.ts, client.ts, seed.ts}`, `api/drizzle.config.ts`, `api/fixtures/*`
- Modify: `api/test/helpers.ts` (реализовать `reset()` и `seed()`)
- Test: `api/test/seed.test.ts`

**Interfaces:**
- Produces: таблицы из спецификации §8 (`profiles, products, product_variants, promo_codes, projects, project_photos, project_members, project_invites, orders, order_status_history, interactions, interaction_messages, ai_jobs, consents, audit_log`) плюс `auth_codes {contact, code_hash, expires_at, used_at}`. Отклонения от §8, которые нужны реализации: `product_variants.page_width_cm`, `projects.expected_members`, `projects.version` (целое, растёт при сохранении), `orders.request_hash`, `orders.number` из последовательности (формат `PP-000123`). Уникальный индекс `orders (customer_id, idempotency_key)`.
- `seedDatabase(db: Db): Promise<SeedSummary>` идемпотентна (повторный запуск не плодит строки): 6 продуктов (Lite, Classic, Premium, выпускной альбом, печать 10×15, печать 15×20), 2–3 варианта у каждого (вариант Classic 20×20: `base_price` 8100, `price_per_page` 150, `pages_min` 20, `pages_max` 60, `page_width_cm` 20, `min_dpi` 150, от него считаются тесты цены), 3 промокода (`HELLO10` на 10%, `SCHOOL15` на 15%, просроченный `OLD20`), 2 клиента, 1 оператор, 5 заказов в разных статусах, 2 обращения.

- [ ] **Step 1: Write the failing test:** после `seedDatabase` продуктов 6, вариантов не меньше 12, у каждого варианта `pageWidthCm > 0` и `minDpi = 150`; есть пользователи ролей `customer` и `operator`; промокода `OLD20` срок в прошлом; заказы покрывают минимум 4 разных статуса; второй вызов `seedDatabase` не меняет число строк.
- [ ] **Step 2: Run** `npm test -w api -- seed`. Expected: FAIL.
- [ ] **Step 3: Implement** `schema.ts` (Drizzle), миграции через `drizzle-kit generate`, скрипты `db:migrate` и `db:seed`. Фикстуры фото сгенерировать скриптом (JPEG 2400×1600, JPEG 700×500, JPEG с EXIF-ориентацией 6), без реальных людей.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): схема базы, миграции, сид`

### Task A3: Вход, роли и журнал

**Files:**
- Create: `api/src/auth/{plugin.ts, routes.ts}`, `api/src/audit.ts`
- Test: `api/test/auth.test.ts`

**Interfaces:**
- Consumes: `UserDTO` из `S0`, `AppError` из `A1`.
- Produces:
  - Эндпоинты: `POST /auth/guest` → `{token, user}`; `POST /auth/request-code {contact}` → `204` (код пишется в лог, в `demoMode` принимается `000000`); `POST /auth/verify-code {contact, code}` → `{token, user}`; `GET /me` → `UserDTO`.
  - JWT: `{sub, role, guest}`, срок 7 дней.
  - `requireAuth`, `requireRole(role: Role)` как preHandler.
  - `audit(db: Db, e: {userId: string | null; action: string; objectType: string; objectId: string | null; result: 'ok' | 'denied' | 'error'}): Promise<void>`.
  - `deny(req, objectType, objectId): never` пишет `access.denied` и кидает `403 FORBIDDEN` (для чужих объектов в ответах на чтение используется `404 NOT_FOUND`, чтобы не раскрывать существование).

- [ ] **Step 1: Write the failing test:** гость получает токен и `isGuest: true`; запрос без токена к `/me` даёт `401`; неверный код даёт `401 CODE_INVALID`, истёкший `401 CODE_EXPIRED`, верный создаёт пользователя `customer`; маршрут с `requireRole('operator')` для клиента даёт `403` и строку `access.denied` в `audit_log`; вход пишет `auth.login`.
- [ ] **Step 2: Run** `npm test -w api -- auth`. Expected: FAIL.
- [ ] **Step 3: Implement** плагин и маршруты, коды хранятся хешем с TTL 10 минут.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): вход, роли, журнал`

### Task A4: Каталог

**Files:**
- Create: `api/src/modules/catalog/{routes.ts, service.ts}`
- Test: `api/test/catalog.test.ts`

**Interfaces:**
- Consumes: `CatalogDTO`, `DELIVERY_METHODS`.
- Produces: `GET /catalog` → `CatalogDTO` (продукты с вариантами, способы доставки, `limits: {maxPhotoBytes: 15728640, formats}`), `GET /catalog/:productId` → `ProductDTO` или `404`.

- [ ] **Step 1: Write the failing test:** авторизованный гость получает 6 продуктов; без токена `401`; у каждого варианта есть цены и `minDpi`; `GET /catalog/<несуществующий uuid>` даёт `404 NOT_FOUND`.
- [ ] **Step 2: Run** `npm test -w api -- catalog`. Expected: FAIL.
- [ ] **Step 3: Implement** чтение из базы без кеша.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): каталог`

### Task A5: Расчёт цены по запросу

**Files:**
- Create: `api/src/modules/quote/{routes.ts, service.ts}`
- Test: `api/test/quote.test.ts`

**Interfaces:**
- Consumes: `calcPrice`, `normalizePromoCode` (`S1`), таблицы `product_variants`, `promo_codes`.
- Produces: `POST /price-quote` (`QuoteRequest` → `QuoteResponse`); `resolvePromo(db: Db, raw: string | undefined, now: Date): Promise<{discountPercent: number; applied: boolean}>`, общая для `A8`. Ошибки: `404 VARIANT_NOT_FOUND`, `422 PROMO_UNKNOWN`, `422 PROMO_EXPIRED`, `422 PAGES_OUT_OF_RANGE` (страниц меньше `pagesMin` или больше `pagesMax`).

- [ ] **Step 1: Write the failing test:** Classic 30 страниц, 2 шт., `' hello10 '`, `belpost` возвращает `totalKop` 17280 и `promoApplied: true`; `OLD20` даёт `422 PROMO_EXPIRED`; `XXX` даёт `422 PROMO_UNKNOWN`; страниц на 1 меньше `pagesMin` даёт `422 PAGES_OUT_OF_RANGE`; запрос без промокода не падает; все суммы целые.
- [ ] **Step 2: Run** `npm test -w api -- quote`. Expected: FAIL.
- [ ] **Step 3: Implement** маршрут поверх `calcPrice`, время берётся из `now()` сервиса, а не из клиента.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): расчёт цены`

### Task A6: Проекты и сохранение макета

**Files:**
- Create: `api/src/modules/projects/{routes.ts, service.ts}`
- Test: `api/test/projects.test.ts`

**Interfaces:**
- Consumes: `ProjectDTO`, `layoutSchema`.
- Produces: `POST /projects {variantId, title, isShared?, expectedMembers?}`; `GET /projects` (свои и совместные, где пользователь участник); `GET /projects/:id`; `PUT /projects/:id {layout, version}` → `{version}`; `DELETE /projects/:id`. Ошибки: `409 VERSION_CONFLICT`, `409 PROJECT_ORDERED` (заказанный проект не меняется).
- `assertProjectAccess(db: Db, user: AuthUser, projectId: string, need: 'read' | 'write' | 'organizer'): Promise<ProjectRow>` для `A7`, `A8`, `A11`.

- [ ] **Step 1: Write the failing test:** созданный проект возвращается только владельцу, другой клиент получает `404`, оператор получает `404`, пока нет заказа; макет из 10 страниц сохраняется и читается с тем же порядком; `PUT` с устаревшей `version` даёт `409 VERSION_CONFLICT`; `PUT` после заказа даёт `409 PROJECT_ORDERED`; невалидный макет (`scale: 0`) даёт `422`.
- [ ] **Step 2: Run** `npm test -w api -- projects`. Expected: FAIL.
- [ ] **Step 3: Implement** с оптимистичной блокировкой через `version` (`UPDATE ... WHERE version = $v`).
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): проекты и макет`

### Task A7: Загрузка фото и подписанные ссылки

**Files:**
- Create: `api/src/storage/{storage.ts, diskStorage.ts, signedUrl.ts}`, `api/src/modules/photos/{routes.ts, service.ts}`
- Test: `api/test/photos.test.ts`

**Interfaces:**
- Consumes: `assertProjectAccess` (`A6`), `PhotoDTO`.
- Produces:
  - `interface Storage { put(key: string, data: Buffer): Promise<void>; get(key: string): Promise<Buffer>; remove(key: string): Promise<void> }`, реализация `DiskStorage(dir: string)`.
  - `signUrl(photoId: string, expiresAt: Date, secret: string): string` и `verifySignature(photoId: string, exp: number, sig: string, secret: string, now: Date): boolean`.
  - `POST /projects/:id/photos` (multipart, поле `file`) → `PhotoDTO`; `DELETE /photos/:id`; `GET /files/:photoId?exp&sig` отдаёт файл без токена, только по подписи.
  - `readImageMeta(buf: Buffer): {mime: 'image/jpeg' | 'image/png'; width: number; height: number; takenAt: Date | null}` с учётом EXIF-ориентации (ориентации 5–8 меняют ширину и высоту местами).
  - Ошибки: `415 FORMAT_UNSUPPORTED` (текст называет допустимые форматы), `413 FILE_TOO_LARGE` (называет лимит 15 МБ).

- [ ] **Step 1: Write the failing test:** JPEG из фикстуры загружается и возвращает `width 2400, height 1600`; файл с расширением `.jpg`, но содержимым GIF даёт `415`; файл больше лимита даёт `413`; **фикстура с EXIF-ориентацией 6 (хранится 1600×2400) возвращает `width 1600, height 2400`**; ссылка с истёкшим `exp` или неверной подписью даёт `403`; чужой пользователь не может загрузить в чужой проект (`404`); `DELETE` удаляет строку и файл; сохранённый `takenAt` берётся из EXIF.
- [ ] **Step 2: Run** `npm test -w api -- photos`. Expected: FAIL.
- [ ] **Step 3: Implement.** Размеры через `image-size`, ориентация и дата через `exifr`; ключ хранения `projects/<projectId>/<photoId>`; ссылки живут 1 час.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): загрузка фото и подписанные ссылки`

### Task A8: Заказы и идемпотентность

**Files:**
- Create: `api/src/modules/orders/{routes.ts, service.ts}`
- Test: `api/test/orders.test.ts`

**Interfaces:**
- Consumes: `calcPrice`, `resolvePromo` (`A5`), `checkQuality` (`S2`), `assertProjectAccess` (`A6`), `audit` (`A3`).
- Produces:
  - `POST /orders` с заголовком `Idempotency-Key` (uuid, обязателен) и телом `CreateOrderRequest` → `201 OrderDTO` (первый раз) или `200 OrderDTO` (повтор того же запроса).
  - `GET /orders` (свои), `GET /orders/:id` с историей статусов.
  - `POST /orders/:id/cancel` разрешён владельцу только в `accepted`.
  - `hashOrderRequest(req: CreateOrderRequest): string` для `request_hash`.
  - Ошибки: `409 PRICE_CHANGED` (в ответе новая сумма), `422 LAYOUT_BLOCKED` (есть пустые ячейки), `422 LAYOUT_PHOTO_MISSING`, `422 IDEMPOTENCY_KEY_REUSED`, `409 CANNOT_CANCEL`, `400 IDEMPOTENCY_KEY_REQUIRED`.

- [ ] **Step 1: Write the failing test:**
  ```ts
  // успешный заказ: 201, status 'accepted', в order_status_history одна строка, в audit_log 'order.create'
  // тот же ключ и то же тело, дважды: второй ответ 200 с тем же order.id, в таблице orders одна строка
  // тот же ключ, два запроса через Promise.all: в таблице orders одна строка, оба ответа содержат один id
  // тот же ключ, другое тело (другой delivery): 422 IDEMPOTENCY_KEY_REUSED
  // expectedTotalKop не совпадает с пересчитанной: 409 PRICE_CHANGED, заказ не создан
  // макет с пустой ячейкой: 422 LAYOUT_BLOCKED
  // макет ссылается на удалённое фото и на фото из чужого проекта: 422 LAYOUT_PHOTO_MISSING
  // после заказа project.status 'ordered', PUT макета даёт 409 PROJECT_ORDERED
  // чужой заказ: GET даёт 404; отмена в статусе 'production': 409 CANNOT_CANCEL
  // для проекта-печати pages считается как сумма copies страниц, quantity 1
  ```
- [ ] **Step 2: Run** `npm test -w api -- orders`. Expected: FAIL.
- [ ] **Step 3: Implement.** Всё в одной транзакции: проверка доступа → `checkQuality` на фото из базы → пересчёт цены → `INSERT ... ON CONFLICT (customer_id, idempotency_key) DO NOTHING RETURNING` → при конфликте читаем существующий заказ и сверяем `request_hash` → история статусов и журнал.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): заказы с идемпотентностью`

### Task A9: Оператор и статусы

**Files:**
- Create: `api/src/modules/operator/{routes.ts, service.ts}`
- Test: `api/test/operator.test.ts`

**Interfaces:**
- Produces: `GET /operator/orders?status=`, `POST /operator/orders/:id/status {status, comment?}`, `GET /operator/audit?limit=`; `canTransition(from: OrderStatus, to: OrderStatus): boolean` (только вперёд по цепочке, `cancelled` не покидается).
- Ошибки: `403` для клиента, `409 INVALID_TRANSITION`.

- [ ] **Step 1: Write the failing test:** клиент получает `403` на все три маршрута и строку `access.denied`; оператор видит заказы всех клиентов; `accepted` → `moderation` проходит и добавляет строку в историю с `changed_by`; `accepted` → `completed` даёт `409`; клиент в `GET /orders/:id` видит новый статус; смена статуса пишет `order.status` в журнал.
- [ ] **Step 2: Run** `npm test -w api -- operator`. Expected: FAIL.
- [ ] **Step 3: Implement** `canTransition` и маршруты.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): оператор и статусы заказа`

### Task A10: Обращения в поддержку

**Files:**
- Create: `api/src/modules/support/{routes.ts, service.ts}`
- Test: `api/test/support.test.ts`

**Interfaces:**
- Produces: `POST /orders/:id/interactions {topic, body}`, `GET /interactions` (свои; оператору все), `GET /interactions/:id`, `POST /interactions/:id/messages {body}`. `InteractionDTO` содержит `orderId` и сообщения.

- [ ] **Step 1: Write the failing test:** клиент создаёт обращение по своему заказу; по чужому получает `404`; оператор видит все и отвечает; сообщение чужого клиента в чужое обращение даёт `404`; `GET /orders/:id` возвращает `interactionIds`.
- [ ] **Step 2: Run** `npm test -w api -- support`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): обращения в поддержку`

### Task A11: Совместный альбом

**Files:**
- Create: `api/src/modules/albums/{routes.ts, service.ts}`
- Modify: `api/src/modules/photos/service.ts` (видимость фото по роли в проекте)
- Test: `api/test/albums.test.ts`

**Interfaces:**
- Consumes: `assertProjectAccess` (`A6`).
- Produces: `POST /projects/:id/invites` (организатор) → `{token, url: 'picpac://invite/<token>', expiresAt}` (срок 14 дней); `POST /invites/accept {token, childName?}` → `ProjectDTO`; `GET /projects/:id/progress` → `AlbumProgressDTO {expected: number | null, members: {userId, childName, photosCount}[]}`. Видимость: организатор видит все фото проекта, участник только свои; участник может загружать и удалять только свои.
- Ошибки: `410 INVITE_EXPIRED`, `404 INVITE_UNKNOWN`.

- [ ] **Step 1: Write the failing test:**
  ```ts
  // участник принимает приглашение и добавляет фото; организатор видит 2 фото (своё и участника)
  // участник в GET /projects/:id/photos видит только своё; удалить чужое фото: 404
  // приглашение с истёкшим сроком: 410
  // одно приглашение приняли дважды тем же пользователем: одна строка в project_members, оба ответа 200
  // организатор принимает собственное приглашение: ничего не дублируется, роль остаётся organizer
  // progress при expectedMembers 25 и двух участниках с фото возвращает expected 25 и photosCount по каждому
  // обычный клиент, не участник: на progress и photos получает 404
  ```
- [ ] **Step 2: Run** `npm test -w api -- albums`. Expected: FAIL.
- [ ] **Step 3: Implement** с уникальным индексом `project_members (project_id, user_id)`.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): совместный альбом`

### Task A12: AI-редактор

**Files:**
- Create: `api/src/modules/ai/{routes.ts, service.ts, provider.ts, aiaiProvider.ts, stubProvider.ts, promptFilter.ts}`, `api/scripts/ai-probe.ts`
- Test: `api/test/ai.test.ts`

**Interfaces:**
- Consumes: `Storage` (`A7`), `assertProjectAccess` (`A6`).
- Produces:
  - `interface ImageEditProvider { readonly name: string; edit(input: {image: Buffer; mime: 'image/jpeg' | 'image/png'; prompt: string; signal: AbortSignal}): Promise<{image: Buffer; mime: string}> }`.
  - `StubProvider` возвращает `fixtures/ai-result.jpg`. `AiaiProvider(config)` вызывает `config.aiaiBaseUrl` с моделью `config.aiaiModel`; режим `config.aiaiEditMode` равен `'images'` (multipart `POST /images/edits`, ответ `data[0].b64_json`) или `'chat'` (`POST /chat/completions` с картинкой в `image_url` как data URL, ответ разбирается из `message.images[0].image_url.url`). Формат на aiai.by не документирован, поэтому оба режима реализуются по гипотезе и проверяются пробой.
  - `isPromptAllowed(prompt: string): boolean`, список запрещённых тем лежит в `promptFilter.ts` и экспортируется как `BLOCKED_TERMS`.
  - Эндпоинты: `POST /ai/consent` → `204`; `POST /ai/edit {projectId, photoId, prompt}` → `202 {jobId}`; `GET /ai/jobs/:id` → `AiJobDTO`. Лимит: 10 задач в час на пользователя (считаются `pending` и `done`, не `failed`). Таймаут провайдера 90 секунд.
  - Ошибки: `403 AI_CONSENT_REQUIRED`, `422 PROMPT_REJECTED`, `429 AI_LIMIT`.

- [ ] **Step 1: Write the failing test:**
  ```ts
  // без согласия: 403 AI_CONSENT_REQUIRED
  // запрос с первым словом из BLOCKED_TERMS: 422 PROMPT_REJECTED, задача не создана
  // со StubProvider: задача проходит pending → done, результат лежит в проекте как фото с source 'ai', макет проекта не изменился
  // провайдер бросает ошибку: job 'failed' с причиной по-русски, фото не добавлено, лимит не уменьшается (после сбоя доступны все 10 попыток)
  // 11-я задача за час: 429 AI_LIMIT
  // чужой photoId или projectId: 404
  // AiaiProvider в режиме 'images' с подменённым fetch: отправляет multipart с полями model, image, prompt и разбирает b64_json
  // AiaiProvider в режиме 'chat' с подменённым fetch: разбирает data URL из ответа
  // ответ провайдера не картинка: job 'failed', а не падение процесса
  ```
- [ ] **Step 2: Run** `npm test -w api -- ai`. Expected: FAIL.
- [ ] **Step 3: Implement.** Обработка задачи в том же процессе (`setImmediate`), статус пишется в `ai_jobs`; выбор провайдера по `config.aiProvider` (`stub` или `aiai`). В `ai-probe.ts`: читает `.env`, берёт `fixtures/photo-ok.jpg`, пробует оба режима по очереди и печатает, какой сработал и сколько занял ответ.
- [ ] **Step 4: Run** `npm test -w api -- ai`. Expected: PASS. Затем вручную, когда появится ключ: `npx tsx api/scripts/ai-probe.ts`. Expected: строка `OK images` или `OK chat`; результат записать в `AGENTS.md` как выбранный режим.
- [ ] **Step 5: Commit** `feat(api): AI-редактор через адаптер`

### Task A13: Удаление данных

**Files:**
- Create: `api/src/modules/privacy/{routes.ts, service.ts}`
- Test: `api/test/privacy.test.ts`

**Interfaces:**
- Produces: `DELETE /me/data` → `204`. Удаляются фото (строки и файлы), проекты, AI-задачи, согласия, сообщения обращений и профиль. Заказы остаются как финансовая запись, у них `customer_id` становится `null`, адрес и имя стираются. Запись `data.delete` остаётся в журнале.

- [ ] **Step 1: Write the failing test:** после `DELETE /me/data` для пользователя с проектом из 3 фото, AI-задачей и заказом в базе нет его фото и проектов, файлов на диске нет, заказ остался с `customer_id null`, токен после удаления даёт `401`, журнал содержит `data.delete`; другой пользователь не затронут; повторный вызов безопасен.
- [ ] **Step 2: Run** `npm test -w api -- privacy`. Expected: FAIL.
- [ ] **Step 3: Implement** одной транзакцией, файлы удаляются после фиксации.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): удаление данных пользователя`

### Task A14: Развёртывание, сквозная проверка и документы

**Files:**
- Create: `api/Dockerfile`, `Caddyfile`, `api/scripts/smoke.ts`, `README.md`, `LICENSES.md`, `docs/test-report.md`
- Modify: `docker-compose.yml` (добавить `caddy`, `api`, том `uploads`), `.env.example`

**Interfaces:**
- Produces: `docker compose up -d` поднимает `caddy`, `api`, `db`; API отвечает по `https://$API_DOMAIN/health`. Если домена нет, используется `<ip>.nip.io`, и Caddy сам получает сертификат. `smoke.ts <baseUrl>` проходит весь обязательный путь по HTTP: гость → каталог → проект → 10 фото → `PUT` макета → `price-quote` → `POST /orders` дважды с одним ключом → оператор переводит статус → клиент видит новый статус.
- `LICENSES.md` генерируется из `npm ls --all --json`.

- [ ] **Step 1: Write the failing test:** `smoke.ts` против незапущенного сервера завершается с кодом 1 и сообщением, на каком шаге остановился.
- [ ] **Step 2: Run** `npx tsx api/scripts/smoke.ts http://localhost:3000`. Expected: FAIL (сервер не запущен).
- [ ] **Step 3: Implement** Dockerfile, compose и скрипт. README: задача, архитектура, стек, роли, запуск за 15 минут, тестовые учётки (`customer1@test.local`, `operator@test.local`, код `000000`), переменные окружения, формула цены, известные ограничения.
- [ ] **Step 4: Run** `docker compose up -d --build`, затем `npm run db:migrate -w api && npm run db:seed -w api`, затем `npx tsx api/scripts/smoke.ts https://$API_DOMAIN`. Expected: каждый шаг печатает `OK`, финальная строка `SMOKE PASSED`, заказ создан ровно один.
- [ ] **Step 5: Commit** `chore: развёртывание, smoke-тест, документация`

---

## Часть 2. Приложение Expo

Задачи `B*` выполняют Mioryyy и egop_1k. Чистая логика (очередь, хранилище черновика) покрывается тестами `jest-expo`, экраны проверяются руками по описанному результату. Все цены и права берутся из API, в коде приложения цифр нет.

### Task B1: Каркас приложения, тема и API-клиент

**Files:**
- Create: `app/` (Expo + Expo Router), `app/src/theme/theme.ts`, `app/src/api/{client.ts, hooks.ts}`, `app/src/ui/{Button.tsx, Card.tsx, StateBanner.tsx}`, `app/app/(tabs)/_layout.tsx`
- Test: `app/src/api/client.test.ts`

**Interfaces:**
- Consumes: DTO и схемы из `@picpac/shared`.
- Produces: `theme.ts` с токенами из UX-документа (цвета светлой и тёмной тем, шаг 4, радиусы 8/16/24, типографика); `createApiClient(opts: {baseUrl: string; getToken: () => string | null}): {get<T>(path: string): Promise<T>; post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>; put; delete}`, где ошибки приходят как `ApiRequestError {status, code, message}`, а сетевой сбой как `NetworkError`. Нижнее меню из 5 вкладок: Главная, Мои дизайны, Корзина, Заказы, Профиль.

- [ ] **Step 1: Write the failing test:** клиент подставляет `Authorization: Bearer`; ответ `{error: {code: 'PRICE_CHANGED', message}}` превращается в `ApiRequestError` с этим `code`; отказ `fetch` превращается в `NetworkError`.
- [ ] **Step 2: Run** `npm test -w app -- client`. Expected: FAIL.
- [ ] **Step 3: Implement** каркас. Проверить, что Metro видит `@picpac/shared` из соседней папки монорепозитория (импорт `formatByn` на экране вкладки «Главная» показывает `0,00 BYN`); если нет, настроить `metro.config.js` на `watchFolders` корня.
- [ ] **Step 4: Run** `npm test -w app` и `npx expo start`. Expected: тесты PASS, на устройстве видны 5 вкладок.
- [ ] **Step 5: Commit** `feat(app): каркас, тема, API-клиент`

### Task B2: Вход и гостевой режим

**Files:**
- Create: `app/src/auth/{AuthProvider.tsx, tokenStore.ts}`, `app/app/(auth)/{welcome.tsx, login.tsx, code.tsx}`
- Test: `app/src/auth/tokenStore.test.ts`

**Interfaces:**
- Produces: `useAuth(): {user: UserDTO | null; token: string | null; loginAsGuest(): Promise<void>; requestCode(contact: string): Promise<void>; verifyCode(contact: string, code: string): Promise<void>; logout(): Promise<void>}`; токен хранится в `expo-secure-store`, при `401` приложение возвращается на экран входа.

- [ ] **Step 1: Write the failing test:** `tokenStore` сохраняет и читает токен; при ошибке хранилища `get()` возвращает `null`, а не падает.
- [ ] **Step 2: Run** `npm test -w app -- tokenStore`. Expected: FAIL.
- [ ] **Step 3: Implement** экраны по списку из UX-документа (онбординг, вход, код, «Продолжить как гость»).
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: вход гостем открывает вкладки; неверный код `111111` показывает «Неверный код», `000000` пускает; после перезапуска приложения пользователь остаётся авторизован.
- [ ] **Step 5: Commit** `feat(app): вход и гостевой режим`

### Task B3: Каталог

**Files:**
- Create: `app/app/(tabs)/index.tsx`, `app/app/catalog/{books.tsx, [productId].tsx, prints.tsx}`, `app/src/catalog/{useCatalog.ts, VariantPicker.tsx}`

**Interfaces:**
- Consumes: `GET /catalog`, `POST /price-quote`.
- Produces: `useCatalog(): UseQueryResult<CatalogDTO>`; главная с двумя крупными входами («Фотокнига», «Печать фото») и плитками «Выпускной альбом» и «AI-редактор»; карточка линейки с переключателем формата и числа страниц, цена обновляется запросом `price-quote`.

- [ ] **Step 1: Write the failing test:** хук `useVariantPrice(variantId, pages)` вызывает `price-quote` и отдаёт `totalKop`; при ошибке сети возвращает последнее удачное значение с флагом `stale`.
- [ ] **Step 2: Run** `npm test -w app -- catalog`. Expected: FAIL.
- [ ] **Step 3: Implement** экраны и хук.
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: каталог показывает 6 продуктов из API, при выключенном API видно состояние ошибки с кнопкой «Повторить», цен в коде приложения нет (`grep -rn "8100" app/src` ничего не находит).
- [ ] **Step 5: Commit** `feat(app): каталог`

### Task B4: Выбор фото и очередь загрузки

**Files:**
- Create: `app/src/photos/{pickPhotos.ts, UploadQueue.ts, convertToJpeg.ts}`, `app/app/project/[id]/photos.tsx`
- Test: `app/src/photos/UploadQueue.test.ts`

**Interfaces:**
- Consumes: `POST /projects/:id/photos`.
- Produces: `class UploadQueue { constructor(deps: {upload: (task: UploadTask) => Promise<PhotoDTO>; storage: KeyValueStore; isOnline: () => boolean}); enqueue(task: UploadTask): void; onChange(cb: (state: QueueState) => void): () => void; resume(): Promise<void> }`, где `UploadTask = {localId: string; projectId: string; uri: string}`. Очередь переживает перезапуск (хранится в `storage`), делает до 5 повторов с нарастающей паузой, при отсутствии сети ждёт. `pickPhotos()` выбирает несколько фото и конвертирует HEIC в JPEG.

- [ ] **Step 1: Write the failing test:** задача выполняется и вызывает `onChange` с прогрессом; при `isOnline() === false` ничего не отправляется, после `resume()` отправляется; после ошибки `upload` повторяется и в итоге завершается; очередь из сохранённого `storage` восстанавливается новым экземпляром; одна и та же `localId` не загружается дважды.
- [ ] **Step 2: Run** `npm test -w app -- UploadQueue`. Expected: FAIL.
- [ ] **Step 3: Implement** очередь, выбор фото и экран загрузки с кольцом прогресса и сообщениями о неподдерживаемом формате и слишком большом файле (тексты из ответа API).
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: выбрать 12 фото, отключить сеть на середине, включить, все фото догрузились без дублей.
- [ ] **Step 5: Commit** `feat(app): выбор фото и очередь загрузки`

### Task B5: Хранилище проекта и черновик

**Files:**
- Create: `app/src/project/{projectStore.ts, syncProject.ts}`, `app/app/(tabs)/designs.tsx`
- Test: `app/src/project/projectStore.test.ts`

**Interfaces:**
- Consumes: `ProjectDTO`, `Layout`, `PUT /projects/:id`.
- Produces: `useProjectStore` (Zustand с `persist` в AsyncStorage): `{draft: ProjectDraft | null; setLayout(layout: Layout): void; syncState: 'saved' | 'saving' | 'local-only'}`, `ProjectDraft = {project: ProjectDTO; layout: Layout; idempotencyKey: string | null}`; `syncProject(deps): Promise<void>` отправляет макет с `version`, при `409 VERSION_CONFLICT` подтягивает серверную версию и сохраняет локальные правки как новую.

- [ ] **Step 1: Write the failing test:** `setLayout` сохраняет макет локально сразу; при недоступной сети `syncState` равен `local-only`, после успешной отправки `saved`; конфликт версий не теряет локальные правки; макет из 10 страниц сохраняется и читается с тем же порядком; перезапуск (новое создание стора из `storage`) восстанавливает черновик.
- [ ] **Step 2: Run** `npm test -w app -- projectStore`. Expected: FAIL.
- [ ] **Step 3: Implement** стор, синхронизацию и список «Мои дизайны» с состояниями пусто, загрузка, «только на телефоне».
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: изменить порядок, закрыть приложение принудительно, открыть, порядок сохранён.
- [ ] **Step 5: Commit** `feat(app): черновик проекта и синхронизация`

### Task B6: Автомакет и редактор разворота

**Files:**
- Create: `app/app/project/[id]/{overview.tsx, spread/[index].tsx}`, `app/src/editor/{SpreadCanvas.tsx, ToolBar.tsx, LayoutSheet.tsx, PhotoStrip.tsx, gestures.ts}`
- Test: `app/src/editor/editorActions.test.ts`

**Interfaces:**
- Consumes: `autoLayout` (`S2`), `useProjectStore` (`B5`).
- Produces: чистые действия над макетом `swapCells(layout, a: CellRef, b: CellRef): Layout`, `moveSpread(layout, from: number, to: number): Layout`, `setCrop(layout, ref: CellRef, crop: Cell['crop']): Layout`, `applyTemplate(layout, pageIndex: number, template: Page['template']): Layout`, `replacePhoto(layout, ref: CellRef, photoId: string): Layout`. Экраны: обзор книги, редактор разворота с жестами и панелью инструментов по UX-документу (раздел 5). Первая очередь: порядок, кадрирование, поворот на 90°, замена фото, шаблоны на 1, 2 и 4 фото. Фон, текст и обложка только после обязательного пути.

- [ ] **Step 1: Write the failing test:** `swapCells` меняет фото местами и не трогает остальное; `moveSpread` переставляет и сохраняет все фото; `applyTemplate('four')` на странице с одним фото сохраняет фото и добавляет пустые ячейки; `setCrop` с `scale < 1` приводит значение к 1; действия не мутируют входной макет.
- [ ] **Step 2: Run** `npm test -w app -- editorActions`. Expected: FAIL.
- [ ] **Step 3: Implement** действия и экраны. Все жесты дублируются кнопками. Автомакет запускается после загрузки фото и показывает экран «Собираем вашу книгу».
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: из 12 фото собирается книга, поменять местами два фото, повернуть одно, закрыть и открыть, правки на месте, кнопки «Отменить» и «Повторить» работают.
- [ ] **Step 5: Commit** `feat(app): автомакет и редактор разворота`

### Task B7: Проверка перед заказом

**Files:**
- Create: `app/app/project/[id]/review.tsx`, `app/src/editor/QualityBadge.tsx`

**Interfaces:**
- Consumes: `checkQuality` (`S2`), `VariantDTO.pageWidthCm`.
- Produces: экран со списком замечаний; тап по замечанию открывает нужный разворот; кнопки «Заменить», «Оставить как есть» (для предупреждений); при `empty-cell` кнопка «Оформить» заблокирована с пояснением.

- [ ] **Step 1: Write the failing test:** `groupIssues(issues): {blockers: QualityIssue[]; warnings: QualityIssue[]}` разделяет замечания, а `canProceed(issues, acknowledged: string[]): boolean` истинна только без блокеров и когда предупреждения подтверждены.
- [ ] **Step 2: Run** `npm test -w app -- review`. Expected: FAIL.
- [ ] **Step 3: Implement** экран и функции.
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: добавить фото 700 px (фикстура `photo-small.jpg`), видно «серьёзное предупреждение», пустая ячейка блокирует кнопку и объясняет почему.
- [ ] **Step 5: Commit** `feat(app): проверка качества перед заказом`

### Task B8: Корзина и оформление

**Files:**
- Create: `app/app/(tabs)/cart.tsx`, `app/app/checkout/{delivery.tsx, payment.tsx, confirm.tsx, result.tsx}`, `app/src/checkout/{useCheckout.ts, idempotency.ts}`
- Test: `app/src/checkout/useCheckout.test.ts`

**Interfaces:**
- Consumes: `POST /price-quote`, `POST /orders`.
- Produces: `ensureIdempotencyKey(draft): string` создаёт ключ один раз при входе в корзину и хранит в черновике; `useCheckout()` с `submit(): Promise<OrderDTO>`. Оплата в тестовом режиме: экраны карты, ЕРИП (27-значный номер с кнопкой «Скопировать» и инструкцией пути) и оплаты курьеру (только для `courier_minsk`) с плашкой «Тестовый режим». Реальных платежей нет.

- [ ] **Step 1: Write the failing test:** повторный вызов `ensureIdempotencyKey` возвращает тот же ключ; `submit()` при `NetworkError` оставляет ключ и позволяет повторить; при `PRICE_CHANGED` обновляет сумму и не создаёт заказ; успешный ответ очищает ключ и возвращает заказ; двойное нажатие «Оплатить» создаёт один запрос.
- [ ] **Step 2: Run** `npm test -w app -- useCheckout`. Expected: FAIL.
- [ ] **Step 3: Implement** экраны и хук. Порог бесплатной доставки показывается в карточке способа («До бесплатной доставки Белпочтой 23,40 BYN»).
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: оформить заказ, выключить сеть перед «Оплатить», видно «Заказ не отправлен», включить, «Повторить», в `GET /orders` ровно один новый заказ.
- [ ] **Step 5: Commit** `feat(app): корзина и оформление`

### Task B9: Заказы, статусы и поддержка

**Files:**
- Create: `app/app/(tabs)/orders.tsx`, `app/app/orders/[id].tsx`, `app/app/orders/[id]/support.tsx`, `app/src/orders/{useOrderPolling.ts, StatusTimeline.tsx}`
- Test: `app/src/orders/useOrderPolling.test.ts`

**Interfaces:**
- Produces: `useOrderPolling(orderId: string, intervalMs = 5000)` опрашивает `GET /orders/:id` пока экран открыт и останавливается на `completed` или `cancelled`; лента статусов; кнопка «Отменить» видна только в `accepted`; обращение по заказу (чат), история с составом, суммой и статусом.

- [ ] **Step 1: Write the failing test:** опрос обновляет статус при изменении; останавливается на финальном статусе; при ошибке сети не падает и продолжает; размонтирование останавливает таймер.
- [ ] **Step 2: Run** `npm test -w app -- useOrderPolling`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: оператор (через `curl` или экран `B13`) меняет статус, на телефоне лента обновляется за 5 секунд, из истории открывается состав, сумма и обращение.
- [ ] **Step 5: Commit** `feat(app): заказы, статусы и поддержка`

### Task B10: Печать фото

**Files:**
- Create: `app/app/print/{format.tsx, frames.tsx, crop.tsx}`

**Interfaces:**
- Consumes: `Layout` из `S0`. Макет печати: страница на каждое фото, шаблон `one`, `copies` у страницы. Цена: `pages` равно сумме `copies`, как зафиксировано в `A8`.
- Produces: выбор формата и бумаги, лента кадров со счётчиком копий, кадрирование одного кадра, переход в корзину.

- [ ] **Step 1: Verify the baseline** `npm test -w app`. Expected: все тесты предыдущих задач PASS.
- [ ] **Step 2: Implement** экраны, повторно используя `UploadQueue`, `projectStore`, `QualityBadge`.
- [ ] **Step 3: Run вручную:** выбрать 24 фото 10×15, поставить копии, цена в корзине совпадает с `price-quote` для суммы копий.
- [ ] **Step 4: Commit** `feat(app): печать фото`

### Task B11: Совместный выпускной альбом

**Files:**
- Create: `app/app/album/{create.tsx, [id].tsx, invite.tsx}`, `app/src/album/useAlbumProgress.ts`; Modify: `app/app.json` (схема `picpac`)
- Test: `app/src/album/parseInvite.test.ts`

**Interfaces:**
- Consumes: эндпоинты `A11`.
- Produces: `parseInviteUrl(url: string): string | null` достаёт токен из `picpac://invite/<token>` и из веб-формы; экран создания альбома (название, число учеников), кнопка «Поделиться ссылкой» через системное меню, экран приглашения, прогресс «18 из 25 добавили».

- [ ] **Step 1: Write the failing test:** `parseInviteUrl('picpac://invite/abc123')` равно `'abc123'`; пустая строка и чужая схема дают `null`.
- [ ] **Step 2: Run** `npm test -w app -- parseInvite`. Expected: FAIL.
- [ ] **Step 3: Implement** экраны и обработку deep link в корневом `_layout.tsx`.
- [ ] **Step 4: Run.** Expected: тест PASS; вручную с двумя телефонами или двумя учётками: организатор создаёт альбом и отправляет ссылку, второй открывает её, добавляет фото, у организатора прогресс растёт, второй не видит фото организатора.
- [ ] **Step 5: Commit** `feat(app): совместный выпускной альбом`

### Task B12: AI-редактор

**Files:**
- Create: `app/app/ai/{consent.tsx, edit.tsx, result.tsx}`, `app/src/ai/useAiJob.ts`
- Test: `app/src/ai/useAiJob.test.ts`

**Interfaces:**
- Consumes: `POST /ai/consent`, `POST /ai/edit`, `GET /ai/jobs/:id`.
- Produces: `useAiJob(jobId: string | null): {status: 'idle' | 'pending' | 'done' | 'failed'; result?: PhotoDTO; reason?: string; cancel(): void}`; экраны: согласие на передачу фото, выбор фото и запрос с пресетами, ожидание с отменой, «До и После», кнопки «В книгу» (добавляет фото в проект) и «Напечатать». Результат попадает в заказ только после действия клиента.

- [ ] **Step 1: Write the failing test:** хук опрашивает задачу до `done` и отдаёт `result`; при `failed` отдаёт `reason`; `cancel()` останавливает опрос; повторный вызов `POST /ai/edit` при двойном нажатии не создаёт две задачи.
- [ ] **Step 2: Run** `npm test -w app -- useAiJob`. Expected: FAIL.
- [ ] **Step 3: Implement** экраны, тексты ошибок берутся из API (`PROMPT_REJECTED`, `AI_LIMIT`, `AI_CONSENT_REQUIRED`).
- [ ] **Step 4: Run.** Expected: тест PASS; вручную: без согласия переход на экран согласия, после согласия задача проходит (на `stub` за секунду), результат видно в сравнении, кнопка «В книгу» добавляет фото в проект.
- [ ] **Step 5: Commit** `feat(app): AI-редактор`

### Task B13: Экраны оператора

**Files:**
- Create: `app/app/operator/{queue.tsx, order/[id].tsx}`, `app/src/operator/useOperatorOrders.ts`

**Interfaces:**
- Consumes: `A9`, `A10`.
- Produces: очередь заказов с фильтром по статусу, карточка заказа с макетом, кнопка «Следующий статус» (разрешённые переходы с `canTransition`), ответы на обращения. Раздел виден только при `user.role === 'operator'`.

- [ ] **Step 1: Verify the baseline** `npm test -w app`. Expected: PASS.
- [ ] **Step 2: Implement** экраны.
- [ ] **Step 3: Run вручную:** вход как `operator@test.local` показывает очередь, клиентская учётка раздела не видит; перевод статуса отражается у клиента за 5 секунд.
- [ ] **Step 4: Commit** `feat(app): экраны оператора`

### Task B14: Профиль, удаление данных и имитация сбоя

**Files:**
- Create: `app/app/(tabs)/profile.tsx`, `app/app/profile/{data.tsx, support.tsx}`, `app/src/dev/networkFailure.ts`

**Interfaces:**
- Produces: профиль с адресами, уведомлениями и поддержкой (чат, Instagram `@picpac_by`, `support@picpac.by`); экран «Мои данные» с `DELETE /me/data` и подтверждением; переключатель «Имитация сбоя сети» в меню разработчика: `setNetworkFailure(on: boolean): void`, при `on` клиент из `B1` бросает `NetworkError` на каждый запрос.

- [ ] **Step 1: Verify the baseline** `npm test -w app`. Expected: PASS.
- [ ] **Step 2: Implement** экраны и переключатель (виден только в разработческой сборке и при долгом нажатии на версию в профиле).
- [ ] **Step 3: Run вручную:** удаление данных возвращает на экран входа, старый токен после этого получает `401`; при включённом сбое сети все запросы падают с понятной плашкой, черновик не теряется.
- [ ] **Step 4: Commit** `feat(app): профиль, удаление данных, имитация сбоя`

### Task B15: Сборка APK и сценарий демо

**Files:**
- Create: `app/eas.json`, `docs/demo-script.md`

**Interfaces:**
- Produces: APK по ссылке из EAS Build, запасной вариант через Expo Go по QR; `EXPO_PUBLIC_API_URL` указывает на VPS; сценарий демо на 5–7 минут: вход, каталог, 10+ фото, автомакет, правка, предупреждение о качестве, заказ, сбой сети и повтор без дубля, смена статуса оператором, альбом с двумя участниками, AI-редактор.

- [ ] **Step 1: Run** `eas build -p android --profile preview` в день 1 и повторять каждый вечер. Expected: ссылка на APK.
- [ ] **Step 2: Install** APK на чистый телефон, пройти обязательный путь без помощи автора. Expected: заказ создан, статус виден.
- [ ] **Step 3: Write** `docs/demo-script.md` по списку выше с тем, что говорит каждый участник.
- [ ] **Step 4: Commit** `chore(app): сборка APK и сценарий демо`

---

## Порядок по дням

| Когда | Задачи |
|---|---|
| День 1 до 18:00 | `S0–S2`, `A1–A4`, `B1–B3`; первый APK |
| День 1 вечер | `A5–A7`, `B4–B6` |
| День 2 до обеда | `A8–A10`, `B7–B9`: обязательный путь проходит целиком, `smoke.ts` на VPS зелёный |
| День 2 после обеда | `A11–A13` и `B11–B13` (один фуллстек ведёт альбом, второй AI и оператора), `B10` |
| День 3 до 11:00 | `A14`, `B14`, `B15`, отчёт о тестировании, прогон демо |

Порядок отказа при нехватке времени совпадает с разделом 12 спецификации.

## Если останется время

Отбор дублей и размытых фото, белорусская локализация, пресеты AI («в стиле ретро», «на море»), повтор заказа из истории (`POST /orders/:id/repeat`), фон, текст и обложка в редакторе, WebSocket вместо опроса.

## Покрытие спецификации

| Требование | Задачи |
|---|---|
| МП-01 каталог через API | `A4`, `B3` |
| МП-02 JPEG/PNG и лимиты | `A7`, `B4` |
| МП-03 черновик | `A6`, `B5` |
| МП-04 пересчёт цены | `S1`, `A5`, `B3`, `B8` |
| МП-05 идемпотентность | `A8`, `B8` |
| МП-06 удаление данных | `A13`, `B14` |
| ОТ-01 запуск за 15 минут | `A14`, `B15` |
| ОТ-02 роли и серверные права | `A3`, `A6`, `A9`, `A11` |
| ОТ-03 тестовые данные, секреты | `A2`, `S0`, `A14` |
| ОТ-04 журнал | `A3` и все модули |
| ОТ-05 ошибки без потери данных | `A1`, `B1`, `B4`, `B5`, `B8` |
| ОТ-06 русский, контраст | `B1`, все экраны |
| ОТ-07 время, валюта, формулы | `S1`, `A14` (README) |
| ОТ-08 лицензии | `A14` |
| Автомакет, качество, альбом, AI, оператор | `S2`, `A11`, `A12`, `A9`, `B6`, `B7`, `B11`, `B12`, `B13` |
