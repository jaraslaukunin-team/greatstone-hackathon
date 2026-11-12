import { describe, expect, it } from 'vitest';
import { isCourierZone } from '../src/modules/orders/courierZone.js';

describe('isCourierZone', () => {
  it('Минск на кириллице — в зоне', () => {
    expect(isCourierZone('Минск')).toBe(true);
  });

  it('минск в нижнем регистре — в зоне', () => {
    expect(isCourierZone('минск')).toBe(true);
  });

  it('МИНСК в верхнем регистре — в зоне', () => {
    expect(isCourierZone('МИНСК')).toBe(true);
  });

  it('Minsk латиницей — в зоне', () => {
    expect(isCourierZone('Minsk')).toBe(true);
  });

  it('minsk латиницей строчными — в зоне', () => {
    expect(isCourierZone('minsk')).toBe(true);
  });

  it('MINSK латиницей заглавными — в зоне', () => {
    expect(isCourierZone('MINSK')).toBe(true);
  });

  it('  Минск  с пробелами — в зоне', () => {
    expect(isCourierZone('  Минск  ')).toBe(true);
  });

  it('Брест — не в зоне', () => {
    expect(isCourierZone('Брест')).toBe(false);
  });

  it('Гомель — не в зоне', () => {
    expect(isCourierZone('Гомель')).toBe(false);
  });

  it('Витебск — не в зоне', () => {
    expect(isCourierZone('Витебск')).toBe(false);
  });

  it('пустая строка — не в зоне', () => {
    expect(isCourierZone('')).toBe(false);
  });

  it('частичное совпадение Мins — не в зоне', () => {
    expect(isCourierZone('Mins')).toBe(false);
  });
});
