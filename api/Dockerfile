# Образ API. Контекст сборки: корень репозитория (docker compose build api).
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Сначала манифесты: слой с зависимостями кешируется, пока они не меняются.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY api/package.json api/package.json
RUN npm ci --omit=dev

COPY packages/shared packages/shared
COPY api api

# Загрузки лежат в томе /data/uploads; приложение работает не от root.
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
WORKDIR /app/api
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# Миграции применяются при каждом старте (повторный запуск безопасен), затем сервер.
CMD ["sh", "-c", "node --import tsx src/db/migrate.ts && exec node --import tsx src/server.ts"]
