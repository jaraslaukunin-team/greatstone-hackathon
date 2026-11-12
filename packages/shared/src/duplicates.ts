/** Группы id фото с одинаковым непустым contentHash (размер группы ≥ 2). */
export function findDuplicatePhotoGroups(
  photos: { id: string; contentHash: string | null }[],
): string[][] {
  const byHash = new Map<string, string[]>();
  for (const photo of photos) {
    const hash = photo.contentHash?.trim();
    if (!hash) continue;
    const list = byHash.get(hash);
    if (list) list.push(photo.id);
    else byHash.set(hash, [photo.id]);
  }
  return [...byHash.values()].filter((group) => group.length >= 2);
}
