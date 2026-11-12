import { doneRoute } from './doneRoute';

describe('doneRoute: куда вести после «Готово» на экране загрузки фото', () => {
  it('обычная книга — в редактор книги', () => {
    expect(doneRoute({ id: 'p1', isShared: false, ownerId: 'u1' }, 'u1')).toBe('/project/p1/overview');
  });
  it('организатор общего альбома — на экран сбора фото', () => {
    expect(doneRoute({ id: 'p1', isShared: true, ownerId: 'u1' }, 'u1')).toBe('/album/p1');
  });
  it('участник общего альбома — на «Моё пожелание», конструктор книги ему не нужен', () => {
    expect(doneRoute({ id: 'p1', isShared: true, ownerId: 'u1' }, 'u2')).toBe('/album/me?projectId=p1');
  });
  it('пока проект не загрузился — null, экран использует переход по умолчанию', () => {
    expect(doneRoute(null, 'u1')).toBeNull();
  });
});
