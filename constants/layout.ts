import { Dimensions } from 'react-native';

export const SCREEN_WIDTH = Dimensions.get('window').width;
export const GRID_GAP = 10;
export const GRID_PADDING = 16;

const DEFAULT_GRID_COLUMNS = 3;
const MIN_LEVEL = 1;
const MAX_LEVEL = 10;

/** Chiều rộng một ô khi lưới có `columns` cột. */
export const getCellWidth = (columns: number) =>
  Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns);

export const CELL_SIZE = getCellWidth(DEFAULT_GRID_COLUMNS);

// Ảnh bìa mặc định = 1.5 lần icon ứng dụng (48dp) = 72dp
export const SERIES_COVER_SIZE = 48 * 1.5;
// Giới hạn tối đa để ảnh luôn nằm gọn trong ô (padding 10*2 + border 1*2)
export const SERIES_COVER_MAX_SIZE = Math.max(32, CELL_SIZE - 22);

export type SeriesInfoLevel = 'minimal' | 'medium' | 'full';

/** Số cột hiển thị trên lưới theo mức kích thước icon (1-10). */
export function getGridColumns(level: number): number {
  if (level <= 2) return 5;
  if (level === 3) return 4;
  if (level <= 6) return 3;
  return 2;
}

/** Mức hiển thị thông tin trên thẻ truyện. */
export function getInfoLevel(level: number): SeriesInfoLevel {
  if (level <= 3) return 'minimal';
  if (level <= 6) return 'medium';
  return 'full';
}

/** Cỡ chữ theo level 1-10 (level 1 = 6px, tăng đều đến level 10). Dùng cho tên bộ truyện và số tập. */
export function getFontSizeForLevel(level: number): number {
  const clamped = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
  return Math.round(6 + (clamped - 1) * 1.11);
}
