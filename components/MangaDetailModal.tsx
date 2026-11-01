import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Chapter, MangaSeries } from '@/types';

const GRID_PADDING = 16;
const GRID_GAP = 10;

export const STATUS_COLORS = {
  owned: '#22c55e',
  missing: '#64748b',
};

export type ChapterFilter = 'all' | 'owned' | 'missing';

interface MangaDetailModalProps {
  series: MangaSeries;
  owned: number;
  total: number;
  chapterFilter: ChapterFilter;
  filteredChapters: Chapter[];
  chapterFontSize: number;
  onBack: () => void;
  onCoverPress: (uri: string | null) => void;
  onOpenGallery: () => void;
  onFilterChange: (filter: ChapterFilter) => void;
  onDelete: (id: string) => void;
  onAddSpecial: () => void;
  onChapterPress: (number: number) => void;
  onSpecialPress: (id: string) => void;
}

export function ChapterCell({
  chapter,
  onPress,
  onLongPress,
  size,
  fontSize,
}: {
  chapter: Chapter;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: number;
  fontSize?: number;
}) {
  const isOwned = chapter.status === 'owned';
  const count = chapter.count || 1;
  const hasDuplicate = isOwned && count > 1;

  const numStr = String(chapter.number);
  const is3DigitsPlus = numStr.length >= 3;

  const baseFontSize = fontSize ?? 14;
  const effectiveFontSize = is3DigitsPlus && size ? Math.min(baseFontSize, Math.round(size * 0.38)) : baseFontSize;

  const paddingHorizontal = size
    ? (is3DigitsPlus ? 2 : Math.max(2, Math.round(effectiveFontSize * 0.2)))
    : Math.max(4, Math.round(effectiveFontSize * 0.5));
  const paddingVertical = size
    ? 2
    : Math.max(2, Math.round(effectiveFontSize * 0.3));
  const badgeSize = Math.max(10, Math.round(effectiveFontSize * 0.85));
  const badgeFontSize = Math.max(7, Math.round(effectiveFontSize * 0.65));

  return (
    <Pressable
      style={[
        styles.chapterCell,
        {
          paddingHorizontal,
          paddingVertical,
          minWidth: size ? size : Math.max(Math.round(effectiveFontSize * 1.8), Math.round(effectiveFontSize * 0.7 * numStr.length + paddingHorizontal * 2)),
        },
        size ? { width: size, height: size } : null,
        isOwned ? styles.chapterCellOwned : styles.chapterCellMissing,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.5}
        style={[
          styles.chapterNumber,
          isOwned && styles.chapterNumberOwned,
          { fontSize: effectiveFontSize },
        ]}>
        {chapter.number}
      </Text>
      {hasDuplicate && (
        <View
          style={[
            styles.duplicateBadge,
            {
              minWidth: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              paddingHorizontal: Math.max(1, Math.round(effectiveFontSize * 0.15)),
            },
          ]}>
          <Text style={[styles.duplicateBadgeText, { fontSize: badgeFontSize }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function MangaDetailModal({
  series,
  owned,
  total,
  chapterFilter,
  filteredChapters,
  chapterFontSize,
  onBack,
  onCoverPress,
  onOpenGallery,
  onFilterChange,
  onDelete,
  onAddSpecial,
  onChapterPress,
  onSpecialPress,
}: MangaDetailModalProps) {
  return (
    <>
      <View style={styles.detailHeader}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>

        <Pressable
          style={styles.detailCoverWrap}
          onPress={() => onCoverPress(series.coverImageUri || series.galleryImageUris?.[0] || null)}
          onLongPress={onOpenGallery}>
          {series.coverImageUri ? (
            <Image source={{ uri: series.coverImageUri }} style={styles.detailCoverImage} />
          ) : (
            <Ionicons name="library" size={30} color="#6366f1" />
          )}
        </Pressable>

        <View style={styles.detailHeaderContent}>
          <View style={styles.detailTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
              <View style={styles.chapterFilterBar}>
                {([
                  { key: 'all', label: 'Tất cả' },
                  { key: 'owned', label: 'Đã có' },
                  { key: 'missing', label: 'Chưa có' },
                ] as { key: ChapterFilter; label: string }[]).map(({ key, label }) => (
                  <Pressable
                    key={key}
                    style={[
                      styles.chapterFilterBtn,
                      chapterFilter === key && styles.chapterFilterBtnActive,
                    ]}
                    onPress={() => onFilterChange(key)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.chapterFilterBtnText, chapterFilter === key && styles.chapterFilterBtnTextActive]}>{label}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={() => onDelete(series.id)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </Pressable>
            </View>
          </View>

          <Text style={styles.detailSubtitle}>{owned}/{total} tập · {(series.tags || []).join(', ')}</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.missing }]} />
          <Text style={styles.legendText}>Chưa có</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.owned }]} />
          <Text style={styles.legendText}>Đã có</Text>
        </View>
        <Pressable style={styles.addSpecialButton} onPress={onAddSpecial}>
          <Ionicons name="add" size={16} color="#4338ca" />
          <Text style={styles.addSpecialButtonText}>Thêm tập đặc biệt</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.gridList}
        contentContainerStyle={styles.seriesGridContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {series.chapters.length > 0 && (
          filteredChapters.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="filter-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptySubtitle}>Không có tập nào phù hợp bộ lọc</Text>
            </View>
          ) : (
            <View style={styles.seriesGrid}>
              {filteredChapters.map((item) => (
                <ChapterCell
                  key={item.number}
                  chapter={item}
                  fontSize={chapterFontSize}
                  onPress={() => onChapterPress(item.number)}
                  onLongPress={() => onChapterPress(item.number)}
                />
              ))}
            </View>
          )
        )}

        {(series.specialChapters || []).length > 0 && (
          <View style={[styles.specialSection, series.chapters.length > 0 && { marginTop: 16 }]}>
            <View style={styles.specialList}>
              {(series.specialChapters || []).map((chapter) => {
                const spCount = chapter.count || 1;
                const spHasDuplicate = chapter.status === 'owned' && spCount > 1;
                return (
                  <Pressable
                    key={chapter.id}
                    style={[styles.specialChapter, chapter.status === 'owned' && styles.specialChapterOwned]}
                    onPress={() => onSpecialPress(chapter.id)}
                    onLongPress={() => onSpecialPress(chapter.id)}>
                    <Ionicons
                      name={chapter.status === 'owned' ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={chapter.status === 'owned' ? STATUS_COLORS.owned : STATUS_COLORS.missing}
                    />
                    <Text style={styles.specialChapterName}>{chapter.name}</Text>
                    {spHasDuplicate && (
                      <View style={styles.duplicateBadge}>
                        <Text style={styles.duplicateBadgeText}>{spCount}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  gridList: {
    flex: 1,
  },
  seriesGridContent: {
    padding: GRID_PADDING,
    paddingBottom: 24,
  },
  seriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCoverWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailCoverImage: {
    width: '100%',
    height: '100%',
  },
  detailHeaderContent: {
    flex: 1,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  chapterFilterBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  chapterFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  chapterFilterBtnActive: {
    backgroundColor: '#fff',
  },
  chapterFilterBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  chapterFilterBtnTextActive: {
    color: '#6366f1',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
  },
  addSpecialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  addSpecialButtonText: {
    fontSize: 12,
    color: '#4338ca',
    fontWeight: '600',
  },
  specialSection: {},
  specialList: {
    gap: 8,
  },
  specialChapter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  specialChapterOwned: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  specialChapterName: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  chapterCell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chapterCellOwned: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  chapterCellMissing: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  chapterNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  chapterNumberOwned: {
    color: '#166534',
  },
  duplicateBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  duplicateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});

