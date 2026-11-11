import { frameSizeOf, orientFrame } from './frame';

describe('frameSizeOf', () => {
  it('берёт размер из названия формата', () => {
    expect(frameSizeOf('10×15 глянцевая')).toEqual({ width: 10, height: 15 });
    expect(frameSizeOf('15x20')).toEqual({ width: 15, height: 20 });
    expect(frameSizeOf('Classic 20×20')).toEqual({ width: 20, height: 20 });
  });
  it('без размера в названии — null', () => {
    expect(frameSizeOf('матовая')).toBeNull();
  });
});

describe('orientFrame', () => {
  it('разворачивает кадр под горизонтальное фото и оставляет под вертикальное', () => {
    expect(orientFrame({ width: 10, height: 15 }, { width: 4000, height: 3000 })).toEqual({ width: 15, height: 10 });
    expect(orientFrame({ width: 10, height: 15 }, { width: 3000, height: 4000 })).toEqual({ width: 10, height: 15 });
  });
  it('квадратное фото не меняет кадр', () => {
    expect(orientFrame({ width: 10, height: 15 }, { width: 100, height: 100 })).toEqual({ width: 10, height: 15 });
  });
});
