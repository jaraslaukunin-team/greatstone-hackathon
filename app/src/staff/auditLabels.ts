import type { AuditEntryDTO } from '@picpac/shared';

const ACTIONS: Record<string, string> = {
  'access.denied': 'Доступ запрещён',
  'ai.adjust': 'AI: правка фото',
  'ai.chat': 'AI: сообщение в чате',
  'ai.consent': 'Согласие на AI',
  'ai.consent_revoked': 'Согласие на AI отозвано',
  'ai.edit': 'AI: редактирование фото',
  'ai.egress': 'AI: фото отправлено на обработку',
  'album.invite': 'Приглашение в альбом',
  'album.join': 'Вход в альбом по приглашению',
  'album.member_update': 'Данные участника альбома',
  'album.password_changed': 'Смена пароля альбома',
  'auth.code_failed': 'Неверный код входа',
  'auth.code_requested': 'Запрос кода входа',
  'auth.login': 'Вход в приложение',
  'data.delete': 'Удаление данных пользователя',
  'interaction.create': 'Новое обращение в поддержку',
  'interaction.message': 'Сообщение в обращении',
  'invite.password_failed': 'Неверный пароль приглашения',
  'order.cancel': 'Отмена заказа',
  'order.create': 'Создание заказа',
  'order.status': 'Смена статуса заказа',
  'photo.copy': 'Копия фото',
  'photo.delete': 'Удаление фото',
  'photo.upload': 'Загрузка фото',
  'project.create': 'Создание проекта',
  'project.delete': 'Удаление проекта',
  'project.duplicate': 'Копия проекта',
  'project.fork': 'Книга из общего альбома',
  'project.member_spread': 'Разворот участника',
  'project.rename': 'Переименование проекта',
  'project.sync': 'Обновление книги из общего альбома',
};

const OBJECTS: Record<string, string> = {
  order: 'заказ',
  profile: 'профиль',
  project: 'проект',
  photo: 'фото',
  ai_job: 'AI-задача',
  interaction: 'обращение',
  contact: 'контакт',
};

const ROLES: Record<NonNullable<AuditEntryDTO['actorRole']>, string> = { operator: 'сотрудник', customer: 'клиент' };

/** Подпись действия по-русски; незнакомый код показываем как есть, чтобы запись не пропала. */
export function actionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}

/** «заказ #11111111»: тип объекта и первые 8 символов его номера. */
export function objectLabel(objectType: string | null, objectId: string | null): string {
  if (!objectType) return '';
  const type = OBJECTS[objectType] ?? objectType;
  return objectId ? `${type} #${objectId.slice(0, 8)}` : type;
}

/** Кто совершил действие: имя и роль; для удалённого пользователя и действий без входа отдельные подписи. */
export function actorLabel(e: Pick<AuditEntryDTO, 'userId' | 'actorName' | 'actorRole'>): string {
  if (e.actorName) return e.actorRole ? `${e.actorName} · ${ROLES[e.actorRole]}` : e.actorName;
  return e.userId ? 'Пользователь удалён' : 'Без входа в приложение';
}
