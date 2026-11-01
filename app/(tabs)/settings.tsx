import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { ChapterCell } from '@/components/MangaDetailModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { INITIAL_SERIES } from '@/constants/seedData';
import type { AttributeGroup, MangaSeries, Chapter, SpecialChapter } from '@/types';

// Helper to parse a CSV line, handling quotes and commas properly
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Map any raw imported item (JSON object) to standard MangaSeries structure
function mapToMangaSeries(item: any, idx: number): MangaSeries {
  const name = item.name || item.title || item.seriesName || `Bộ truyện #${idx + 1}`;
  const totalChapters = parseInt(item.totalChapters, 10) || item.chapters?.length || 0;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const baseId = item.id || `import-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${slug}`;
  
  let chapters: Chapter[] = [];
  if (Array.isArray(item.chapters) && item.chapters.length > 0) {
    chapters = item.chapters.map((c: any, cIdx: number) => ({
      number: parseInt(c.number, 10) || (cIdx + 1),
      status: c.status === 'owned' || c.status === 'Đã có' ? 'owned' : 'missing',
      tags: Array.isArray(c.tags) ? c.tags : undefined,
      count: c.count !== undefined ? parseInt(c.count, 10) : undefined
    }));
  } else {
    // Reconstruct chapters from ownedChapters or missingChapters
    let ownedSet = new Set<number>();
    if (typeof item.ownedChapters === 'string') {
      item.ownedChapters.split(',').forEach((numStr: string) => {
        const num = parseInt(numStr.trim(), 10);
        if (!isNaN(num)) ownedSet.add(num);
      });
    } else if (Array.isArray(item.ownedChapters)) {
      item.ownedChapters.forEach((num: any) => {
        const n = parseInt(num, 10);
        if (!isNaN(n)) ownedSet.add(n);
      });
    }

    let missingSet = new Set<number>();
    if (typeof item.missingChapters === 'string') {
      item.missingChapters.split(',').forEach((numStr: string) => {
        const num = parseInt(numStr.trim(), 10);
        if (!isNaN(num)) missingSet.add(num);
      });
    } else if (Array.isArray(item.missingChapters)) {
      item.missingChapters.forEach((num: any) => {
        const n = parseInt(num, 10);
        if (!isNaN(n)) missingSet.add(n);
      });
    }

    chapters = Array.from({ length: totalChapters }, (_, i) => {
      const num = i + 1;
      let status: 'owned' | 'missing' = 'missing';
      if (ownedSet.size > 0) {
        status = ownedSet.has(num) ? 'owned' : 'missing';
      } else if (missingSet.size > 0) {
        status = missingSet.has(num) ? 'missing' : 'owned';
      } else {
        status = 'owned';
      }
      return {
        number: num,
        status
      };
    });
  }

  const specialChapters: SpecialChapter[] = Array.isArray(item.specialChapters)
    ? item.specialChapters.map((sc: any, scIdx: number) => ({
        id: sc.id || `${baseId}-special-${scIdx + 1}`,
        name: sc.name || `Tập đặc biệt ${scIdx + 1}`,
        status: sc.status === 'owned' || sc.status === 'Đã có' ? 'owned' : 'missing',
        tags: Array.isArray(sc.tags) ? sc.tags : undefined,
        count: sc.count !== undefined ? parseInt(sc.count, 10) : undefined
      }))
    : [];

  return {
    id: baseId,
    name,
    totalChapters,
    chapters,
    specialChapters: specialChapters.length > 0 ? specialChapters : undefined,
    tags: Array.isArray(item.tags) ? item.tags : [],
    coverImageUri: item.coverImageUri,
    galleryImageUris: Array.isArray(item.galleryImageUris) ? item.galleryImageUris : undefined
  };
}

export default function SettingsScreen() {
  const {
    user,
    isLoggedIn,
    loading: authLoading,
    webClientId,
    androidClientId,
    syncStatus,
    signInWithGoogle,
    signOut,
    updateClientIds,
    syncUserToGoogleSheets,
  } = useAuth();

  const {
    seriesList,
    setSeriesList,
    setChangeHistory,
    addHistory,
    attributeGroups,
    setAttributeGroups,
    sizeMultiplier,
    handleSizeChange,
    backupEndpoint,
    setBackupEndpoint,
    lastBackupDate,
    backupStatus,
    restoreStatus,
    restoreLoading,
    saveBackupSettings,
    backupToGoogleSheets,
    restoreFromGoogleSheets,
    shareExportFile,
    resetToSeed,
  } = useAppData();

  const [inputWebClientId, setInputWebClientId] = useState(webClientId);
  const [inputAndroidClientId, setInputAndroidClientId] = useState(androidClientId);
  const [newGroupName, setNewGroupName] = useState('');
  const [newTagInputs, setNewTagInputs] = useState<{ [groupId: string]: string }>({});


  const promptImportAction = (
    importedList: MangaSeries[],
    importedGroups: AttributeGroup[],
    importedHistory: any[],
    formatName: string
  ) => {
    Alert.alert(
      'Chọn phương thức nhập',
      `Phát hiện ${importedList.length} bộ truyện từ file ${formatName}. Bạn muốn nhập dữ liệu này như thế nào?`,
      [
        {
          text: 'Trộn dữ liệu (Khuyên dùng)',
          onPress: () => {
            setSeriesList(prev => {
              const merged = [...prev];
              importedList.forEach(imported => {
                const existingIndex = merged.findIndex(s => s.name.toLowerCase() === imported.name.toLowerCase());
                if (existingIndex !== -1) {
                  const existing = merged[existingIndex];
                  merged[existingIndex] = {
                    ...imported,
                    coverImageUri: imported.coverImageUri || existing.coverImageUri,
                    galleryImageUris: imported.galleryImageUris || existing.galleryImageUris,
                  };
                } else {
                  merged.push(imported);
                }
              });
              return merged;
            });
            addHistory('Imported from file', `Trộn ${importedList.length} bộ truyện từ file ${formatName}`);
            Alert.alert('Thành công', `Đã nhập thành công ${importedList.length} bộ truyện từ file!`);
          }
        },
        {
          text: 'Ghi đè (Xóa dữ liệu cũ)',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Xác nhận ghi đè',
              'Toàn bộ danh sách bộ truyện, lịch sử và nhóm đặc điểm hiện tại sẽ bị xóa sạch và thay thế. Bạn có chắc muốn tiếp tục?',
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Xác nhận xóa & ghi đè',
                  style: 'destructive',
                  onPress: () => {
                    setSeriesList(importedList);
                    if (importedGroups && importedGroups.length > 0) {
                      setAttributeGroups(importedGroups);
                    }
                    if (importedHistory && importedHistory.length > 0) {
                      setChangeHistory(importedHistory);
                    } else {
                      setChangeHistory([]);
                    }
                    addHistory('Restored from file', `Ghi đè khôi phục ${importedList.length} bộ truyện từ file ${formatName}`);
                    Alert.alert('Thành công', `Đã nhập thành công ${importedList.length} bộ truyện từ file!`);
                  }
                }
              ]
            );
          }
        },
        { text: 'Hủy', style: 'cancel' }
      ]
    );
  };

  const processJsonImport = async (content: string) => {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error('File JSON không hợp lệ (lỗi cú pháp JSON).');
    }

    let rawList: any[] = [];
    let importedGroups: AttributeGroup[] = [];
    let importedHistory: any[] = [];

    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.seriesList)) {
        rawList = parsed.seriesList;
      } else if (parsed.name || parsed.title) {
        rawList = [parsed];
      } else {
        const firstArrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
        if (firstArrayKey) {
          rawList = parsed[firstArrayKey];
        }
      }

      if (Array.isArray(parsed.attributeGroups)) {
        importedGroups = parsed.attributeGroups;
      }
      if (Array.isArray(parsed.history)) {
        importedHistory = parsed.history;
      }
    }

    const validItems = rawList.filter(item => item && (item.name || item.title));
    if (validItems.length === 0) {
      throw new Error('Dữ liệu JSON không chứa bộ truyện hợp lệ (thiếu trường name hoặc title).');
    }

    const mappedSeriesList: MangaSeries[] = validItems.map((item, idx) => mapToMangaSeries(item, idx));
    promptImportAction(mappedSeriesList, importedGroups, importedHistory, 'JSON');
  };

  const processCsvImport = async (content: string) => {
    const lines = content.split(/\r?\n/);
    if (lines.length <= 1) {
      throw new Error('File CSV trống hoặc không đúng định dạng.');
    }

    const headers = parseCsvLine(lines[0]);
    let seriesIdx = 0;
    let typeIdx = 1;
    let chapterIdx = 2;
    let statusIdx = 3;
    let tagsIdx = 4;

    if (headers.length >= 5) {
      const normHeaders = headers.map(h => h.trim().toLowerCase());
      const sIdx = normHeaders.indexOf('bộ truyện');
      const tIdx = normHeaders.indexOf('loại');
      const cIdx = normHeaders.indexOf('tập');
      const stIdx = normHeaders.indexOf('trạng thái');
      const tgIdx = normHeaders.indexOf('tags');

      if (sIdx !== -1) seriesIdx = sIdx;
      if (tIdx !== -1) typeIdx = tIdx;
      if (cIdx !== -1) chapterIdx = cIdx;
      if (stIdx !== -1) statusIdx = stIdx;
      if (tgIdx !== -1) tagsIdx = tgIdx;
    }

    const seriesMap = new Map<string, {
      name: string;
      chapters: Array<{ number: number; status: 'owned' | 'missing'; tags: string[] }>;
      specials: Array<{ name: string; status: 'owned' | 'missing'; tags: string[] }>;
    }>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = parseCsvLine(line);
      if (columns.length < 3) continue;

      const seriesName = columns[seriesIdx];
      if (!seriesName) continue;

      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, {
          name: seriesName,
          chapters: [],
          specials: []
        });
      }

      const seriesData = seriesMap.get(seriesName)!;
      const cType = columns[typeIdx] || 'Tập thường';
      const cVal = columns[chapterIdx] || '';
      const cStatusText = columns[statusIdx] || '';
      const cTagsText = columns[tagsIdx] || '';

      const status: 'owned' | 'missing' = (cStatusText.toLowerCase() === 'đã có' || cStatusText.toLowerCase() === 'owned') ? 'owned' : 'missing';
      const tags = cTagsText ? cTagsText.split(',').map(t => t.trim()).filter(Boolean) : [];

      if (cType.includes('đặc biệt') || cType.includes('special')) {
        seriesData.specials.push({
          name: cVal,
          status,
          tags
        });
      } else {
        const chapterNum = parseInt(cVal, 10);
        if (!isNaN(chapterNum) && chapterNum > 0) {
          seriesData.chapters.push({
            number: chapterNum,
            status,
            tags
          });
        }
      }
    }

    if (seriesMap.size === 0) {
      throw new Error('Không tìm thấy dữ liệu bộ truyện hợp lệ từ file CSV.');
    }

    const mappedSeriesList: MangaSeries[] = [];
    seriesMap.forEach((data, seriesName) => {
      const slug = seriesName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const baseId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${slug}`;
      
      const maxChapter = data.chapters.reduce((max, c) => Math.max(max, c.number), 0);
      
      const chapters: Chapter[] = Array.from({ length: maxChapter }, (_, index) => {
        const number = index + 1;
        const found = data.chapters.find(c => c.number === number);
        if (found) {
          return {
            number,
            status: found.status,
            tags: found.tags.length > 0 ? found.tags : undefined
          };
        } else {
          return {
            number,
            status: 'missing'
          };
        }
      });

      const specialChapters: SpecialChapter[] = data.specials.map((s, idx) => ({
        id: `${baseId}-special-${idx + 1}`,
        name: s.name,
        status: s.status,
        tags: s.tags.length > 0 ? s.tags : undefined
      }));

      mappedSeriesList.push({
        id: baseId,
        name: seriesName,
        totalChapters: maxChapter,
        chapters,
        specialChapters: specialChapters.length > 0 ? specialChapters : undefined,
        tags: []
      });
    });

    promptImportAction(mappedSeriesList, [], [], 'CSV');
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const fileUri = file.uri;
      const fileName = file.name.toLowerCase();

      const fileContent = await FileSystem.readAsStringAsync(fileUri);

      if (fileName.endsWith('.json')) {
        await processJsonImport(fileContent);
      } else if (fileName.endsWith('.csv')) {
        await processCsvImport(fileContent);
      } else {
        try {
          await processJsonImport(fileContent);
        } catch (jsonErr) {
          try {
            await processCsvImport(fileContent);
          } catch (csvErr) {
            Alert.alert(
              'Định dạng không hỗ trợ',
              'Vui lòng chọn file có đuôi mở rộng là .json hoặc .csv.'
            );
          }
        }
      }
    } catch (error) {
      console.error('Lỗi khi nhập file:', error);
      Alert.alert(
        'Lỗi đọc file',
        error instanceof Error ? error.message : 'Không thể đọc file đã chọn.'
      );
    }
  };



  useEffect(() => {
    setInputWebClientId(webClientId);
    setInputAndroidClientId(androidClientId);
  }, [webClientId, androidClientId]);

  const sizeScale = sizeMultiplier / 5;
  const chapterFontSize = Math.round(
    6 + (Math.min(10, Math.max(1, sizeMultiplier)) - 1) * 1.11,
  );
  const previewBoxSize = Math.max(24, Math.min(48, 72 * sizeScale * 0.5));

  const handleAddAttributeGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhóm đặc điểm.');
      return;
    }
    if (attributeGroups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Đã tồn tại', `Nhóm đặc điểm "${trimmed}" đã tồn tại.`);
      return;
    }
    const newGroup: AttributeGroup = {
      id: `group-${Date.now()}`,
      name: trimmed,
      tags: [],
    };
    setAttributeGroups((prev) => [...prev, newGroup]);
    setNewGroupName('');
  };

  const handleDeleteAttributeGroup = (groupId: string) => {
    const group = attributeGroups.find((g) => g.id === groupId);
    if (!group) return;
    Alert.alert('Xóa nhóm đặc điểm', `Bạn có chắc muốn xóa nhóm "${group.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setAttributeGroups((prev) => prev.filter((g) => g.id !== groupId));
        },
      },
    ]);
  };

  const handleAddTagToGroup = (groupId: string) => {
    const input = (newTagInputs[groupId] || '').trim();
    if (!input) return;
    setAttributeGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        if (g.tags.some((t) => t.toLowerCase() === input.toLowerCase())) return g;
        return { ...g, tags: [...g.tags, input] };
      }),
    );
    setNewTagInputs((prev) => ({ ...prev, [groupId]: '' }));
  };

  const handleRemoveTagFromGroup = (groupId: string, tagToRemove: string) => {
    setAttributeGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, tags: g.tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()) };
      }),
    );
  };

  const handleResetToSeed = () => {
    Alert.alert(
      'Khôi phục dữ liệu mẫu',
      `Thao tác này sẽ thay thế dữ liệu hiện tại bằng ${INITIAL_SERIES.length + 1} bộ truyện mẫu (gồm Hexman 9x). Tiếp tục?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục',
          onPress: () => resetToSeed(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cài đặt hệ thống</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <TouchableWithoutFeedback style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <Text style={styles.label}>Tài khoản Google & Đồng bộ</Text>
              {isLoggedIn && user ? (
                <View style={styles.card}>
                  <View style={styles.accountHeader}>
                    {user.photoURL ? (
                      <Image source={{ uri: user.photoURL }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={24} color="#4338ca" />
                      </View>
                    )}
                    <View style={styles.accountInfo}>
                      <Text style={styles.accountName}>
                        {user.displayName || 'Người dùng Google'}
                      </Text>
                      <Text style={styles.accountEmail}>{user.email}</Text>
                      <View style={styles.activeStatusRow}>
                        <View style={styles.statusDotActive} />
                        <Text style={styles.activeStatusText}>Đã đăng nhập qua Google</Text>
                      </View>
                    </View>
                  </View>

                  {syncStatus && <Text style={styles.statusText}>{syncStatus}</Text>}

                  <View style={styles.row}>
                    <Pressable
                      style={styles.primaryBtn}
                      onPress={() => syncUserToGoogleSheets(user, backupEndpoint)}>
                      <Ionicons name="sync-outline" size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>Đồng bộ Sheet</Text>
                    </Pressable>
                    <Pressable style={styles.signOutBtn} onPress={signOut}>
                      <Ionicons name="log-out-outline" size={16} color="#dc2626" />
                      <Text style={styles.signOutBtnText}>Đăng xuất</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.hint}>
                    Đăng nhập bằng tài khoản Google (Gmail) để lưu thông tin phiên làm việc và đồng bộ tự động với Google Sheets.
                  </Text>
                  <GoogleSignInButton
                    onPress={signInWithGoogle}
                    loading={authLoading}
                    style={{ marginTop: 10 }}
                  />
                </View>
              )}

              <Text style={[styles.label, { fontSize: 13, marginTop: 16 }]}>
                Cấu hình Google Client ID (Tùy chọn)
              </Text>
              <Text style={styles.hint}>
                Nhập OAuth Web/Android Client ID nếu kết nối với Google Cloud Console riêng.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Web Client ID (vd: xxx.apps.googleusercontent.com)"
                placeholderTextColor="#94a3b8"
                value={inputWebClientId}
                onChangeText={setInputWebClientId}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Android Client ID (vd: yyy.apps.googleusercontent.com)"
                placeholderTextColor="#94a3b8"
                value={inputAndroidClientId}
                onChangeText={setInputAndroidClientId}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.outlineBtn}
                onPress={async () => {
                  await updateClientIds(inputWebClientId, inputAndroidClientId);
                  Alert.alert('Thành công', 'Đã lưu cấu hình Google Client ID.');
                }}>
                <Ionicons name="save-outline" size={16} color="#4338ca" />
                <Text style={styles.outlineBtnText}>Lưu Client ID</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Kích thước icon bộ truyện và tập truyện</Text>
              <Text style={styles.hint}>
                Chọn kích thước từ 1 (nhỏ nhất) đến 10 (lớn nhất). Mặc định là 5.
              </Text>

              <View style={styles.sizeRow}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                  <Pressable
                    key={value}
                    style={[
                      styles.sizeOption,
                      sizeMultiplier === value && styles.sizeOptionActive,
                    ]}
                    onPress={() => handleSizeChange(value)}>
                    <Text
                      style={[
                        styles.sizeOptionText,
                        sizeMultiplier === value && styles.sizeOptionTextActive,
                      ]}>
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.previewRow}>
                <View style={styles.previewItem}>
                  <View
                    style={[styles.previewBox, { width: previewBoxSize, height: previewBoxSize }]}>
                    <Ionicons
                      name="library"
                      size={Math.max(14, Math.round(20 * sizeScale))}
                      color="#6366f1"
                    />
                  </View>
                  <Text style={styles.previewLabel}>Bộ truyện</Text>
                </View>
                <View style={styles.previewItem}>
                  <ChapterCell
                    chapter={{ number: 1, status: 'owned' }}
                    fontSize={chapterFontSize}
                  />
                  <Text style={styles.previewLabel}>Tập truyện</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Quản lý Nhóm đặc điểm</Text>
              <Text style={styles.hint}>
                Tạo các nhóm đặc điểm (ví dụ: "Giá bìa", "Năm xuất bản") để tự động hiển thị trong Form tạo/sửa truyện và Bộ lọc.
              </Text>

              <View style={styles.addGroupRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Tên nhóm mới (vd: Giá bìa)..."
                  placeholderTextColor="#94a3b8"
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                />
                <Pressable style={styles.addGroupBtn} onPress={handleAddAttributeGroup}>
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.addGroupBtnText}>Thêm</Text>
                </Pressable>
              </View>

              <View style={styles.groupList}>
                {attributeGroups.map((group) => (
                  <View key={group.id} style={styles.groupCard}>
                    <View style={styles.groupCardHeader}>
                      <Text style={styles.groupCardTitle}>{group.name}</Text>
                      <Pressable
                        style={styles.groupCardDeleteBtn}
                        onPress={() => handleDeleteAttributeGroup(group.id)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </Pressable>
                    </View>

                    <View style={styles.groupTagsRow}>
                      {group.tags.length === 0 && (
                        <Text style={styles.noTagText}>Chưa có tag nào</Text>
                      )}
                      {group.tags.map((tag) => (
                        <View key={tag} style={styles.groupTagChip}>
                          <Text style={styles.groupTagChipText}>{tag}</Text>
                          <Pressable onPress={() => handleRemoveTagFromGroup(group.id, tag)}>
                            <Ionicons name="close-circle" size={16} color="#64748b" />
                          </Pressable>
                        </View>
                      ))}
                    </View>

                    <View style={styles.addTagToGroupRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0, height: 38, fontSize: 13 }]}
                        placeholder={`Thêm giá trị cho ${group.name}...`}
                        placeholderTextColor="#94a3b8"
                        value={newTagInputs[group.id] || ''}
                        onChangeText={(text) =>
                          setNewTagInputs((prev) => ({ ...prev, [group.id]: text }))
                        }
                      />
                      <Pressable
                        style={styles.addTagToGroupBtn}
                        onPress={() => handleAddTagToGroup(group.id)}>
                        <Text style={styles.addTagToGroupBtnText}>+ Thêm</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Sao lưu Google Sheets</Text>
              <Text style={styles.hint}>
                Dán URL Google Apps Script Web App. Ứng dụng sẽ sao lưu khi bấm nút và tối đa một lần mỗi ngày khi mở app.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="https://script.google.com/macros/s/.../exec"
                placeholderTextColor="#94a3b8"
                value={backupEndpoint}
                onChangeText={setBackupEndpoint}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={async () => {
                  await saveBackupSettings(backupEndpoint, lastBackupDate);
                  await backupToGoogleSheets();
                }}>
                <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>Sao lưu ngay</Text>
              </Pressable>

              <Text style={[styles.label, { marginTop: 16 }]}>Đọc dữ liệu đã sao lưu</Text>
              <Text style={styles.hint}>
                Tải dữ liệu đã sao lưu trước đó từ Google Sheets về thiết bị. Dữ liệu hiện tại sẽ được thay thế.
              </Text>
              <Pressable
                style={[styles.primaryBtn, restoreLoading && styles.btnDisabled]}
                disabled={restoreLoading}
                onPress={restoreFromGoogleSheets}>
                <Ionicons name="cloud-download-outline" size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  {restoreLoading ? 'Đang đọc...' : 'Đọc bản ghi đã sao lưu'}
                </Text>
              </Pressable>
              {restoreStatus && <Text style={styles.statusText}>{restoreStatus}</Text>}

              <Pressable
                style={[styles.primaryBtn, { backgroundColor: '#0d9488', marginTop: 12 }]}
                onPress={handleImportFile}>
                <Ionicons name="folder-open-outline" size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>📂 Nhập dữ liệu từ file (.json/.csv)</Text>
              </Pressable>

              <Text style={[styles.label, { marginTop: 16 }]}>Xuất file để gửi cho người khác</Text>
              <View style={styles.exportRow}>
                <Pressable style={styles.exportButton} onPress={() => shareExportFile('json')}>
                  <Ionicons name="document-text-outline" size={20} color="#4338ca" />
                  <Text style={styles.exportButtonText}>Chia sẻ JSON</Text>
                </Pressable>
                <Pressable style={styles.exportButton} onPress={() => shareExportFile('csv')}>
                  <Ionicons name="grid-outline" size={20} color="#4338ca" />
                  <Text style={styles.exportButtonText}>Chia sẻ CSV</Text>
                </Pressable>
              </View>
              {backupStatus && <Text style={styles.statusText}>{backupStatus}</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Dữ liệu mẫu</Text>
              <Text style={styles.hint}>
                Khôi phục toàn bộ 40 bộ truyện mẫu. Dữ liệu hiện tại sẽ được thay thế.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={handleResetToSeed}>
                <Ionicons name="refresh-outline" size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>Khôi phục dữ liệu mẫu</Text>
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  section: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  accountEmail: {
    fontSize: 12,
    color: '#64748b',
  },
  activeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  activeStatusText: {
    fontSize: 12,
    color: '#16a34a',
  },
  statusText: {
    fontSize: 13,
    color: '#6366f1',
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  signOutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
  },
  signOutBtnText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 10,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  outlineBtnText: {
    color: '#4338ca',
    fontSize: 14,
    fontWeight: '600',
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeOption: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  sizeOptionActive: {
    backgroundColor: '#6366f1',
  },
  sizeOptionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  sizeOptionTextActive: {
    color: '#fff',
  },
  previewRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  previewItem: {
    alignItems: 'center',
  },
  previewBox: {
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  addGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  addGroupBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  groupList: {
    gap: 10,
    marginTop: 4,
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  groupCardDeleteBtn: {
    padding: 4,
  },
  groupTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  noTagText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  groupTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groupTagChipText: {
    fontSize: 12,
    color: '#1e293b',
  },
  addTagToGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  addTagToGroupBtn: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  addTagToGroupBtnText: {
    color: '#4338ca',
    fontSize: 13,
    fontWeight: '600',
  },
  exportRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingVertical: 12,
  },
  exportButtonText: {
    color: '#4338ca',
    fontSize: 13,
    fontWeight: '600',
  },
});


