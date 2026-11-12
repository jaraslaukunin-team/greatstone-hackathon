import { paperOf } from './paper';

describe('paperOf', () => {
  it('глянцевая', () => {
    expect(paperOf('10×15 глянцевая')).toBe('glossy');
    expect(paperOf('15×21 Glossy')).toBe('glossy');
    expect(paperOf('глянц')).toBe('glossy');
    expect(paperOf('Глянцевая 10×15')).toBe('glossy');
  });

  it('матовая', () => {
    expect(paperOf('10×15 матовая')).toBe('matte');
    expect(paperOf('Matte 15×21')).toBe('matte');
    expect(paperOf('матт 10×13')).toBe('matte');
    expect(paperOf('Матовая 20×30')).toBe('matte');
  });

  it('без указания типа бумаги — null', () => {
    expect(paperOf('10×15')).toBeNull();
    expect(paperOf('15×21 premium')).toBeNull();
    expect(paperOf('')).toBeNull();
  });
});
