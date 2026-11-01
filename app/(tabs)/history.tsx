import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppData } from '@/contexts/AppDataContext';

export default function HistoryScreen() {
  const { changeHistory } = useAppData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lịch sử thay đổi</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {changeHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>Chưa có lịch sử thay đổi</Text>
          </View>
        ) : (
          changeHistory.map((entry) => (
            <View key={entry.timestamp} style={styles.historyRow}>
              <Text style={styles.historyTime}>
                {new Date(entry.timestamp).toLocaleString()}
              </Text>
              <Text style={styles.historyText}>
                {entry.action}
                {entry.seriesName ? ` — ${entry.seriesName}` : ''}
                {entry.details ? `: ${entry.details}` : ''}
              </Text>
            </View>
          ))
        )}
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
  historyRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  historyTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  historyText: {
    fontSize: 14,
    color: '#1e293b',
  },
});
