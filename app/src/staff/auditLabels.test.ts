import type { AuditEntryDTO } from '@picpac/shared';
import { actionLabel, actorLabel, objectLabel } from './auditLabels';

const base: AuditEntryDTO = {
  id: '1',
  userId: 'u1',
  actorName: 'Оператор Тестовый',
  actorRole: 'operator',
  at: '2026-11-12T10:00:00.000Z',
  action: 'order.status',
  objectType: 'order',
  objectId: '11111111-2222-3333-4444-555555555555',
  result: 'ok',
};

describe('actorLabel', () => {
  it('имя и роль: кто совершил действие', () => {
    expect(actorLabel(base)).toBe('Оператор Тестовый · сотрудник');
    expect(actorLabel({ ...base, actorName: 'Анна', actorRole: 'customer' })).toBe('Анна · клиент');
  });

  it('пользователь удалён: запись есть, имени нет', () => {
    expect(actorLabel({ ...base, actorName: null, actorRole: null })).toBe('Пользователь удалён');
  });

  it('действие без входа в приложение', () => {
    expect(actorLabel({ ...base, userId: null, actorName: null, actorRole: null })).toBe('Без входа в приложение');
  });
});

describe('actionLabel и objectLabel', () => {
  it('известные действия переводятся, неизвестные остаются как есть', () => {
    expect(actionLabel('order.status')).toBe('Смена статуса заказа');
    expect(actionLabel('access.denied')).toBe('Доступ запрещён');
    expect(actionLabel('something.new')).toBe('something.new');
  });

  it('объект: тип по-русски и короткий номер', () => {
    expect(objectLabel('order', '11111111-2222-3333-4444-555555555555')).toBe('заказ #11111111');
    expect(objectLabel('order', null)).toBe('заказ');
    expect(objectLabel(null, null)).toBe('');
    expect(objectLabel('unknown_type', 'abcdef123')).toBe('unknown_type #abcdef12');
  });

  it('у каждого действия, которое пишет API, есть русская подпись', () => {
    const actions = [
      'access.denied', 'ai.adjust', 'ai.chat', 'ai.consent', 'ai.consent_revoked', 'ai.edit', 'ai.egress',
      'album.invite', 'album.join', 'album.member_update', 'album.password_changed', 'auth.code_failed',
      'auth.code_requested', 'auth.login', 'data.delete',
      'interaction.create', 'interaction.message', 'invite.password_failed', 'order.cancel', 'order.create',
      'order.status', 'photo.copy', 'photo.delete', 'photo.upload', 'project.create', 'project.delete',
      'project.duplicate', 'project.fork', 'project.member_spread', 'project.rename', 'project.sync',
    ];
    const missing = actions.filter((a) => actionLabel(a) === a);
    expect(missing).toEqual([]);
  });
});
