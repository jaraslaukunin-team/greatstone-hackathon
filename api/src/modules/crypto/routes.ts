import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/plugin.js';
import { deriveUserPayloadKey, parsePayloadMasterKey } from '../../crypto/payload.js';
import { AppError } from '../../errors.js';

export function registerCryptoRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.get('/crypto/client-key', auth, async (req) => {
    const master = parsePayloadMasterKey(req.server.config.payloadEncryptionKey);
    if (!master) {
      throw new AppError(503, 'CRYPTO_DISABLED', 'Шифрование полезной нагрузки не настроено на сервере');
    }
    const key = deriveUserPayloadKey(master, req.user!.id);
    return {
      alg: 'AES-256-GCM',
      v: 1 as const,
      key: key.toString('base64'),
    };
  });
}
