import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOwnedCount, getTrackedCount } from '@/components/MangaCard';
import { useAppData } from '@/contexts/AppDataContext';
import type { MangaSeries } from '@/types';

const COMPLETE_COLOR = '#4CAF50';
const IN_PROGRESS_COLOR = '#f59e0b';

interface SeriesStat {
  series: MangaSeries;
  owned: number;
  total: number;
  percent: number;
}

function toPercentWidth(percent: number): `${number}%` {
  const clamped = Math.max(0, Math.min(100, percent));
  return `${clamped}%`;
}

export default function StatsScreen() {
  const { seriesList } = useAppData();

  const stats = useMemo(() => {
    const rows: SeriesStat[] = (seriesList ?? []).map((series) => {
      const owned = getOwnedCount(series);
      const total = getTrackedCount(series);
      const percent = total > 0 ? Math.round((owned / total) * 100) : 0;
      return { series, owned, total, percent };
    });

    const totalAppOwned = rows.reduce((sum, row) => sum + row.owned, 0);
    const totalAppTarget = rows.reduce((sum, row) => sum + row.total, 0);
    const totalAppPercent =
      totalAppTarget > 0 ? Math.round((totalAppOwned / totalAppTarget) * 100) : 0;

    return { rows, totalAppOwned, totalAppTarget, totalAppPercent };
  }, [seriesList]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thống kê bộ sưu tập</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.overviewCard}>
          <View style={styles.overviewStatRow}>
            <View style={styles.overviewStatItem}>
              <Text style={styles.overviewStatValue}>{stats.rows.length}</Text>
              <Text style={styles.overviewStatLabel}>Bộ truyện</Text>
            </View>
            <View style={styles.overviewStatDivider} />
            <View style={styles.overviewStatItem}>
              <Text style={styles.overviewStatValue}>
                {stats.totalAppOwned} / {stats.totalAppTarget}
              </Text>
              <Text style={styles.overviewStatLabel}>Tập sở hữu / mục tiêu</Text>
            </View>
          </View>

          <Text style={styles.overviewPercent}>{stats.totalAppPercent}%</Text>
          <View style={styles.progressTrackLarge}>
            <View
              style={[
                styles.progressFillLarge,
                {
                  width: toPercentWidth(stats.totalAppPercent),
                  backgroundColor:
                    stats.totalAppPercent >= 100 ? COMPLETE_COLOR : IN_PROGRESS_COLOR,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.list}>
          {stats.rows.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="stats-chart-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Chưa có bộ truyện nào để thống kê</Text>
            </View>
          ) : (
            stats.rows.map(({ series, owned, total, percent }) => (
              <View key={series.id} style={styles.seriesRow}>
                <View style={styles.seriesRowHeader}>
                  <Text style={styles.seriesName} numberOfLines={1}>
                    {series.name}
                  </Text>
                  <Text style={styles.seriesPercent}>{percent}%</Text>
                </View>
                <Text style={styles.seriesMeta}>
                  {owned}/{total} tập
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: toPercentWidth(percent),
                        backgroundColor: percent >= 100 ? COMPLETE_COLOR : IN_PROGRESS_COLOR,
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  overviewStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  overviewStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  overviewStatLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  overviewPercent: {
    fontSize: 32,
    fontWeight: '800',
    color: '#6366f1',
    textAlign: 'center',
    marginTop: 16,
  },
  progressTrackLarge: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFillLarge: {
    height: '100%',
    borderRadius: 7,
  },
  list: {
    marginTop: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
  },
  seriesRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  seriesRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  seriesName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  seriesPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
  },
  seriesMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
});

