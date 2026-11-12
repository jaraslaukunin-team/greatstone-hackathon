/**
 * Автосохранение макета живёт на нескольких экранах одного проекта (книга и экраны правки поверх неё).
 * Сохраняет только первый из них, иначе два запроса с одной версией конфликтуют между собой;
 * если открыт один экран (например, по прямой ссылке), он и есть владелец.
 */
const owners = new Map<string, symbol[]>();

export function claimSync(projectId: string, token: symbol): void {
  const list = owners.get(projectId) ?? [];
  if (!list.includes(token)) list.push(token);
  owners.set(projectId, list);
}

export function releaseSync(projectId: string, token: symbol): void {
  const list = (owners.get(projectId) ?? []).filter((t) => t !== token);
  if (list.length) owners.set(projectId, list);
  else owners.delete(projectId);
}

export function isSyncOwner(projectId: string, token: symbol): boolean {
  return owners.get(projectId)?.[0] === token;
}
