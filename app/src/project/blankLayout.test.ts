import { blankLayout } from './blankLayout';

describe('blankLayout', () => {
  it('создаёт N страниц с одним пустым местом', () => {
    const layout = blankLayout(20);
    expect(layout.pages).toHaveLength(20);
    expect(layout.pages[0]!.template).toBe('one');
    expect(layout.pages[0]!.cells).toHaveLength(1);
    expect(layout.pages[0]!.cells[0]!.photoId).toBeNull();
  });

  it('проставляет themeId', () => {
    const layout = blankLayout(10, 'film');
    expect(layout.themeId).toBe('film');
  });

  it('по умолчанию minimal', () => {
    const layout = blankLayout(10);
    expect(layout.themeId).toBe('minimal');
  });

  it('страниц ровно pagesMin', () => {
    expect(blankLayout(24).pages).toHaveLength(24);
    expect(blankLayout(1).pages).toHaveLength(1);
  });

  it('каждая страница имеет правильный crop', () => {
    const page = blankLayout(5).pages[0]!;
    expect(page.cells[0]!.crop).toEqual({ x: 0, y: 0, scale: 1, rotation: 0 });
  });
});
