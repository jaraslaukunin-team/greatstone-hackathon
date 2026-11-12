import { clampTextPos, textBox } from './textBox';

const base = { text: 'Наше лето', x: 0.5, y: 0.5, style: 'title' as const };

describe('textBox', () => {
  it('блок центрирован по x и шириной 0.8 страницы', () => {
    const b = textBox(base, 200, 200);
    expect(b.width).toBe(160);
    expect(b.left).toBe(20);
  });
  it('блок не выходит за границы страницы по ширине', () => {
    expect(textBox({ ...base, x: 0 }, 200, 200).left).toBe(0);
    expect(textBox({ ...base, x: 1 }, 200, 200).left).toBe(40);
  });
  it('более длинный текст даёт более высокий блок', () => {
    const short = textBox({ ...base, text: 'Лето' }, 200, 200);
    const long = textBox({ ...base, text: 'Очень длинная подпись под фотографиями про наше лето' }, 200, 200);
    expect(long.height).toBeGreaterThan(short.height);
  });
  it('число строк ограничено (3, для цитаты 6)', () => {
    const text = 'слово '.repeat(200);
    const t = textBox({ ...base, text }, 200, 200);
    const q = textBox({ ...base, text, style: 'quote' }, 200, 200);
    expect(q.height).toBeGreaterThan(t.height);
  });
});

describe('clampTextPos', () => {
  it('держит центр надписи в пределах страницы', () => {
    expect(clampTextPos(-0.2, 1.4)).toEqual({ x: 0, y: 1 });
    expect(clampTextPos(0.3, 0.7)).toEqual({ x: 0.3, y: 0.7 });
  });
});
