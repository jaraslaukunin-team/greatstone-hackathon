export function parseInviteUrl(url: string): string | null {
  if (!url) return null;
  try {
    if (url.startsWith('picpac://invite/')) {
      const token = url.slice('picpac://invite/'.length).split(/[?#]/)[0];
      return token || null;
    }
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const inviteIndex = parts.findIndex((p) => p === 'invite');
    if (inviteIndex >= 0) {
      return parts[inviteIndex + 1] ?? null;
    }
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}
