export type Config = {
  databaseUrl: string;
  jwtSecret: string;
  fileUrlSecret: string;
  uploadDir: string;
  demoMode: boolean;
  aiProvider: string;
  aiaiBaseUrl: string;
  aiaiApiKey: string;
  aiaiModel: string;
  aiaiChatModel: string;
  aiaiEditMode: 'images' | 'chat';
  /** AES-256 ключ (64 hex или base64) для файлов на диске; пусто = без шифрования. */
  fileEncryptionKey?: string;
  port: number;
  /** Публичный адрес сайта для ссылок-приглашений; без него берётся из заголовков запроса. */
  publicUrl?: string;
};

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (v === undefined || v === '') {
    throw new Error(`Не задана обязательная переменная окружения ${name}`);
  }
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const editMode = env.AIAI_EDIT_MODE || 'images';
  if (editMode !== 'images' && editMode !== 'chat') {
    throw new Error(`Недопустимое значение AIAI_EDIT_MODE: ${editMode} (допустимо images или chat)`);
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0) {
    throw new Error(`Недопустимое значение PORT: ${env.PORT}`);
  }
  const aiProvider = env.AI_PROVIDER || 'stub';
  const aiaiBaseUrl = env.AIAI_BASE_URL || 'https://api.aiai.by/v1';
  if (aiProvider === 'aiai' && !aiaiBaseUrl.startsWith('https://')) {
    throw new Error('При AI_PROVIDER=aiai переменная AIAI_BASE_URL должна начинаться с https://');
  }
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    fileUrlSecret: required(env, 'FILE_URL_SECRET'),
    uploadDir: env.UPLOAD_DIR || './uploads',
    demoMode: ['true', '1', 'yes'].includes((env.DEMO_MODE ?? '').toLowerCase()),
    aiProvider,
    aiaiBaseUrl,
    aiaiApiKey: env.AIAI_API_KEY ?? '',
    aiaiModel: env.AIAI_MODEL || 'qwen-image-edit',
    aiaiChatModel: env.AIAI_CHAT_MODEL || 'gpt-4o-mini',
    aiaiEditMode: editMode,
    fileEncryptionKey: env.FILE_ENCRYPTION_KEY || undefined,
    port,
    publicUrl: env.PUBLIC_URL || undefined,
  };
}
