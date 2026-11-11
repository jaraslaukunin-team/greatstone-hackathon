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
  port: number;
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
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    fileUrlSecret: required(env, 'FILE_URL_SECRET'),
    uploadDir: env.UPLOAD_DIR || './uploads',
    demoMode: ['true', '1', 'yes'].includes((env.DEMO_MODE ?? '').toLowerCase()),
    aiProvider: env.AI_PROVIDER || 'stub',
    aiaiBaseUrl: env.AIAI_BASE_URL || 'https://api.aiai.by/v1',
    aiaiApiKey: env.AIAI_API_KEY ?? '',
    aiaiModel: env.AIAI_MODEL || 'qwen-image-edit',
    aiaiChatModel: env.AIAI_CHAT_MODEL || 'gpt-4o-mini',
    aiaiEditMode: editMode,
    port,
  };
}
