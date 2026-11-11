import { parseInviteUrl } from './parseInvite';

describe('parseInviteUrl', () => {
  it('достаёт токен из picpac://invite/...', () => {
    expect(parseInviteUrl('picpac://invite/abc123')).toBe('abc123');
  });

  it('пустая строка и чужая схема дают null', () => {
    expect(parseInviteUrl('')).toBeNull();
    expect(parseInviteUrl('https://example.com/other')).toBeNull();
  });
});
