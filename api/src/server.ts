import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { loadRepoEnv } from './loadEnv.js';

loadRepoEnv();
const config = loadConfig(process.env);
const app = await buildApp(config);
await app.listen({ port: config.port, host: '0.0.0.0' });
