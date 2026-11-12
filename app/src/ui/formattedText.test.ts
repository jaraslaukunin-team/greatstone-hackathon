import { parseFormattedText } from './formattedText';

describe('parseFormattedText', () => {
  it('returns empty for empty input', () => {
    expect(parseFormattedText('')).toEqual([]);
  });

  it('keeps plain text', () => {
    expect(parseFormattedText('привет')).toEqual([{ kind: 'plain', text: 'привет' }]);
  });

  it('parses bold with double asterisks', () => {
    expect(parseFormattedText('это **важно** сейчас')).toEqual([
      { kind: 'plain', text: 'это ' },
      { kind: 'bold', text: 'важно' },
      { kind: 'plain', text: ' сейчас' },
    ]);
  });

  it('parses italic with single asterisks', () => {
    expect(parseFormattedText('это *тихо*')).toEqual([
      { kind: 'plain', text: 'это ' },
      { kind: 'italic', text: 'тихо' },
    ]);
  });

  it('prefers bold over italic when both appear', () => {
    expect(parseFormattedText('**жирный** и *курсив*')).toEqual([
      { kind: 'bold', text: 'жирный' },
      { kind: 'plain', text: ' и ' },
      { kind: 'italic', text: 'курсив' },
    ]);
  });

  it('leaves unmatched asterisks as plain', () => {
    expect(parseFormattedText('цена * 10')).toEqual([{ kind: 'plain', text: 'цена * 10' }]);
  });
});
