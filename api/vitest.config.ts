import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    // Тесты делят одну тестовую базу, поэтому файлы идут по очереди.
    fileParallelism: false,
  },
});
