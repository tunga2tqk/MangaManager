import type { Chapter } from '@/types';

export type TagMatchMode = 'any' | 'all';

const normalizeTag = (tag?: string) => (tag || '').toLowerCase().trim();

/** So khớp danh sách tag của một mục với các tag đang lọc. Không có tag lọc => false. */
export function tagsMatch(itemTags?: string[], activeTags?: string[], mode: TagMatchMode = 'any'): boolean {
  const active = (activeTags || []).map(normalizeTag);
  if (active.length === 0) return false;
  const item = (itemTags || []).map(normalizeTag);
  return mode === 'any' ? item.some((t) => active.includes(t)) : active.every((t) => item.includes(t));
}

/**
 * Lọc chương theo tag. Nếu bộ truyện khớp tag thì giữ toàn bộ chương,
 * ngược lại chỉ giữ các chương có tag khớp. Không có tag lọc => giữ nguyên.
 */
export function filterChaptersByTags(
  seriesTags: string[] | undefined,
  chapters: Chapter[],
  activeTags: string[],
  mode: TagMatchMode,
): Chapter[] {
  if (activeTags.length === 0) return chapters;
  if (tagsMatch(seriesTags, activeTags, mode)) return chapters;
  return chapters.filter((ch) => tagsMatch(ch.tags, activeTags, mode));
}
