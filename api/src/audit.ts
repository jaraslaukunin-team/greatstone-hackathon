import type { Db } from './db/client.js';
import { auditLog } from './db/schema.js';

export type AuditEvent = {
  userId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  result: 'ok' | 'denied' | 'error';
  /** Время события; по умолчанию его ставит база. Нужно там, где окно считают по часам приложения. */
  at?: Date;
};

// Время записи ставит база (колонка at), журнал только дополняется.
export async function audit(db: Db, e: AuditEvent): Promise<void> {
  await db.insert(auditLog).values({
    userId: e.userId,
    action: e.action,
    objectType: e.objectType,
    objectId: e.objectId,
    result: e.result,
    ...(e.at ? { at: e.at } : {}),
  });
}
