import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { STATUS_COLORS } from '@/components/MangaDetailModal';
import type { MangaSeries } from '@/types';

export type SeriesStatus = 'completed' | 'collecting' | 'none';
export type SeriesInfoLevel = 'minimal' | 'medium' | 'full';

export function getOwnedCount(series: MangaSeries) {
  const regularOwned = series.chapters
    .filter((chapter) => chapter.status === 'owned')
    .reduce((sum, chapter) => sum + (chapter.count || 1), 0);
  const specialOwned = (series.specialChapters || [])
    .filter((chapter) => chapter.status === 'owned')
    .reduce((sum, chapter) => sum + (chapter.count || 1), 0);
  return regularOwned + specialOwned;
}

export function getTrackedCount(series: MangaSeries) {
  return series.totalChapters + (series.specialChapters || []).length;
}

export function getSeriesStatus(series: MangaSeries): SeriesStatus {
  const owned = getOwnedCount(series);
  const total = getTrackedCount(series);
  if (owned === 0) return 'none';
  if (owned === total) return 'completed';
  return 'collecting';
}

interface MangaCardProps {
  series: MangaSeries;
  cardWidth: number;
  cardPadding: number;
  seriesCoverSize: number;
  nameFontSize: number;
  infoLevel: SeriesInfoLevel;
  onPress: () => void;
  onLongPress: () => void;
}

export default function MangaCard({
  series,
  cardWidth,
  cardPadding,
  seriesCoverSize,
  nameFontSize,
  infoLevel,
  onPress,
  onLongPress,
}: MangaCardProps) {
  const owned = getOwnedCount(series);
  const total = getTrackedCount(series);
  const status = getSeriesStatus(series);

  return (
    <Pressable
      style={[styles.seriesCell, { width: cardWidth, padding: cardPadding }]}
      onPress={onPress}
      onLongPress={onLongPress}>
      <View
        style={[
          styles.seriesIconWrap,
          {
            width: seriesCoverSize,
            height: seriesCoverSize,
            borderRadius: Math.max(6, Math.round(cardPadding * 0.8)),
            marginBottom: cardPadding,
          },
        ]}>
        {series.coverImageUri ? (
          <Image source={{ uri: series.coverImageUri }} style={styles.seriesCoverImage} />
        ) : (
          <Ionicons name="library" size={Math.round(seriesCoverSize * 0.5)} color="#6366f1" />
        )}
      </View>
      <Text style={[styles.seriesName, { fontSize: nameFontSize }]} numberOfLines={2}>
        {series.name}
      </Text>
      {infoLevel === 'full' && (
        <View style={styles.seriesMeta}>
          <View style={styles.tagBadge}>
            <Ionicons name="pricetag" size={12} color="#6366f1" />
            <Text style={styles.tagText}>{(series.tags || []).slice(0, 1).join(', ') || 'Khác'}</Text>
          </View>
          <Text style={styles.progressText}>
            {owned}/{total} tập
          </Text>
        </View>
      )}
      {infoLevel === 'medium' && (
        <Text style={[styles.progressText, styles.progressStandalone]}>
          {owned}/{total} tập
        </Text>
      )}
      <View
        style={[
          styles.seriesStatusBar,
          status === 'completed' && { backgroundColor: STATUS_COLORS.owned },
          status === 'collecting' && { backgroundColor: '#f59e0b' },
          status === 'none' && { backgroundColor: STATUS_COLORS.missing },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  seriesCell: {
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  seriesIconWrap: {
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  seriesCoverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  seriesName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
    minHeight: 34,
  },
  seriesMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexShrink: 1,
  },
  tagText: {
    fontSize: 10,
    color: '#6366f1',
    fontWeight: '600',
  },
  progressText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  progressStandalone: {
    marginBottom: 8,
  },
  seriesStatusBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
});
