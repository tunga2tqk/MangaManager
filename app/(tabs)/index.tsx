import type { AttributeGroup, Chapter, ChapterStatus, MangaSeries } from '@/types';
import { useAppData } from '@/contexts/AppDataContext';
import MangaDetailModal, { ChapterCell, STATUS_COLORS, type ChapterFilter } from '@/components/MangaDetailModal';
import MangaCard, { getOwnedCount, getSeriesStatus, getTrackedCount } from '@/components/MangaCard';

























import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Screen = 'main' | 'detail';
type StatusFilter = 'all' | 'collecting' | 'completed' | 'none';


const GRID_COLUMNS = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const GRID_PADDING = 16;
const CELL_SIZE =
  Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
const CHAPTER_CELL_SIZE = CELL_SIZE / 2;
// Kích thước tối thiểu của ô tập truyện để luôn hiển thị được 2 chữ số
const MIN_CHAPTER_CELL_SIZE = 26;
// Kích thước ảnh bìa bộ truyện = 1.5 lần logo ứng dụng điện thoại (48dp)
const APP_ICON_SIZE = 48;
const SERIES_COVER_SIZE = APP_ICON_SIZE * 1.5; // 72dp
// Giới hạn kích thước ảnh bìa tối đa để luôn nằm gọn trong ô lưới
// (ô có width CELL_SIZE, padding 10*2 và border 1*2)
const SERIES_COVER_MAX_SIZE = Math.max(32, CELL_SIZE - 22);
const CHAPTER_GRID_COLUMNS = Math.max(
  4,
  Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 + GRID_GAP) / (CHAPTER_CELL_SIZE + GRID_GAP)),
);

// Số cột hiển thị trên lưới tùy theo mức kích thước icon (1-10)
function getGridColumns(level: number): number {
  if (level <= 2) return 5;
  if (level === 3) return 4;
  if (level <= 6) return 3;
  return 2;
}

// Mức hiển thị thông tin trên thẻ truyện
function getInfoLevel(level: number): 'minimal' | 'medium' | 'full' {
  if (level <= 3) return 'minimal';
  if (level <= 6) return 'medium';
  return 'full';
}

// Cỡ chữ tên bộ truyện theo level 1-10 (Level 1 giảm xuống 1/2 ~ 6px, chia đều lại từ level 1 đến 10)
function getSeriesNameFontSize(level: number): number {
  const clamped = Math.min(10, Math.max(1, level));
  return Math.round(6 + (clamped - 1) * 1.11);
}

// Cỡ chữ số tập truyện theo level 1-10 (Level 1 giảm xuống 1/2 ~ 6px, chia đều lại từ level 1 đến 10)
function getChapterNumberFontSize(level: number): number {
  const clamped = Math.min(10, Math.max(1, level));
  return Math.round(6 + (clamped - 1) * 1.11);
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const {
    seriesList,
    setSeriesList,
    attributeGroups,
    setAttributeGroups,
    saveError,
    addHistory,
    sizeMultiplier,
  } = useAppData();
  const [screen, setScreen] = useState<Screen>('main');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Lưu vị trí cuộn của danh sách lưới chính để phục hồi khi đóng màn hình chi tiết
  const scrollOffsetRef = useRef(0);
  const gridScrollRef = useRef<ScrollViewInstance>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [showMissingPanel, setShowMissingPanel] = useState(true);
  const [filterMatchMode, setFilterMatchMode] = useState<'any' | 'all'>('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formSelectedTagChips, setFormSelectedTagChips] = useState<string[]>([]);
  const [formNewTags, setFormNewTags] = useState('');
  const [previewChapters, setPreviewChapters] = useState<Chapter[]>([]);

  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>('all');

  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [showEditChapterModal, setShowEditChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingChapterTags, setEditingChapterTags] = useState('');
  const [showSpecialChapterModal, setShowSpecialChapterModal] = useState(false);
  const [specialChapterNames, setSpecialChapterNames] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityChapterNumber, setQuantityChapterNumber] = useState<number | null>(null);
  const [quantityTargetType, setQuantityTargetType] = useState<'regular' | 'special'>('regular');
  const [quantitySpecialId, setQuantitySpecialId] = useState<string | null>(null);
  const [quantityValue, setQuantityValue] = useState(0);

  const [formGroupValues, setFormGroupValues] = useState<{ [groupId: string]: string }>({});
  const [openGroupDropdownId, setOpenGroupDropdownId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  // Kích thước icon động dựa trên sizeMultiplier (1-10)
  // sizeMultiplier = 5 là kích thước mặc định (100%)
  const sizeScale = sizeMultiplier / 5;
  const dynamicSeriesCoverSize = Math.min(SERIES_COVER_SIZE * sizeScale, SERIES_COVER_MAX_SIZE);
  const dynamicChapterCellSize = Math.max(MIN_CHAPTER_CELL_SIZE, CHAPTER_CELL_SIZE * sizeScale);
  const gridColumns = getGridColumns(sizeMultiplier);
  const cardWidth = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (gridColumns - 1)) / gridColumns);
  const cardPadding = Math.max(6, Math.round(cardWidth * 0.1));
  const seriesCoverSize = Math.max(24, cardWidth - cardPadding * 2 - 2);
  const infoLevel = getInfoLevel(sizeMultiplier);
  const baseFontSize = getSeriesNameFontSize(sizeMultiplier);
  const nameFontSize = baseFontSize + 5;
  const chapterFontSize = getChapterNumberFontSize(sizeMultiplier);



  const copyImageToAppStorage = async (uri: string) => {
    const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const destination = `${FileSystem.documentDirectory}manga-image-${Date.now()}.${extension}`;
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  };

  const pickSeriesImage = async (kind: 'cover' | 'gallery') => {
    if (!selectedId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Hãy cho phép ứng dụng truy cập thư viện ảnh để chọn ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const storedUri = await copyImageToAppStorage(result.assets[0].uri);
    setSeriesList((prev) => prev.map((series) => {
      if (series.id !== selectedId) return series;
      if (kind === 'cover') return { ...series, coverImageUri: storedUri };
      const gallery = series.galleryImageUris || [];
      if (gallery.length >= 4) {
        Alert.alert('Đã đủ ảnh phụ', 'Mỗi bộ truyện chỉ được có tối đa 4 ảnh phụ.');
        return series;
      }
      return { ...series, galleryImageUris: [...gallery, storedUri] };
    }));
    setSelectedImageUri(storedUri);
  };

  const removeSeriesImage = (kind: 'cover' | 'gallery', uri?: string) => {
    if (!selectedId) return;
    setSeriesList((prev) => prev.map((series) => {
      if (series.id !== selectedId) return series;
      if (kind === 'cover') return { ...series, coverImageUri: undefined };
      return { ...series, galleryImageUris: (series.galleryImageUris || []).filter((item) => item !== uri) };
    }));
  };

  const handleDeleteSeries = (id: string) => {
    const series = seriesList.find((s) => s.id === id);
    if (!series) return;
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc muốn xóa bộ truyện "${series.name}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setSeriesList((prev) => prev.filter((s) => s.id !== id));
            addHistory('Deleted series', `Xóa bộ truyện "${series.name}"`, series);
            // if viewing deleted series, go back to main
            if (selectedId === id) {
              goToMainScreen();
            }
          },
        },
      ],
    );
  };

  const goToMainScreen = useCallback(() => {
    setScreen('main');
    setSelectedId(null);
    setShowCreateModal(false);
    setShowFilterModal(false);
    // Phục hồi vị trí cuộn sau khi overlay chi tiết được tháo khỏi giao diện
    setTimeout(() => {
      gridScrollRef.current?.scrollTo({ y: scrollOffsetRef.current, animated: false });
    }, 50);
  }, []);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', () => {
      goToMainScreen();
    });
    return unsubscribe;
  }, [navigation, goToMainScreen]);

  // Handle Android hardware back button: close filter modal or go back from detail to main
  useEffect(() => {
    const onBackPress = () => {
      if (showFilterModal) {
        setShowFilterModal(false);
        return true;
      }
      if (screen === 'detail') {
        goToMainScreen();
        return true;
      }
      return false; // allow default behavior (exit app)
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showFilterModal, screen, goToMainScreen]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    seriesList.forEach((s) => (s.tags || []).forEach((t) => t && tags.add(t)));
    seriesList.forEach((s) => s.chapters.forEach((ch) => (ch.tags || []).forEach((t) => t && tags.add(t))));
    return Array.from(tags);
  }, [seriesList]);

  // Helper: normalize tag strings for comparison
  const normalizeTag = (t?: string) => (t || '').toLowerCase().trim();
  const tagsArrayNormalized = (arr?: string[]) => (arr || []).map((t) => normalizeTag(t));

  const tagsMatch = (itemTags?: string[], activeTags?: string[], mode: 'any'|'all' = 'any') => {
    const a = tagsArrayNormalized(itemTags);
    const act = (activeTags || []).map((t) => normalizeTag(t));
    if (act.length === 0) return false;
    if (mode === 'any') return a.some((t) => act.includes(t));
    return act.every((tag) => a.includes(tag));
  };

  const getMatchingCountForTags = useCallback(
    (testTags: string[], mode: 'any' | 'all', missingOnly: boolean) => {
      let count = 0;
      seriesList.forEach((series) => {
        if (missingOnly) {
          const missing = series.chapters.filter((c) => c.status === 'missing');
          if (missing.length === 0) return;
          let includeSeries = true;
          if (testTags.length > 0) {
            const seriesTagsMatch = tagsMatch(series.tags, testTags, mode);
            const chapterTagsMatch = missing.some((ch) => tagsMatch(ch.tags, testTags, mode));
            includeSeries = seriesTagsMatch || chapterTagsMatch;
          }
          if (!includeSeries) return;

          const displayedMissing = testTags.length > 0
            ? (tagsMatch(series.tags, testTags, mode) ? missing : missing.filter((ch) => tagsMatch(ch.tags, testTags, mode)))
            : missing;
          count += displayedMissing.length;
        } else {
          const chaptersToShow = testTags.length > 0
            ? (tagsMatch(series.tags, testTags, mode) ? series.chapters : series.chapters.filter((ch) => tagsMatch(ch.tags, testTags, mode)))
            : series.chapters;
          count += chaptersToShow.length;
        }
      });
      return count;
    },
    [seriesList],
  );

  const dimmedUngroupedTags = useMemo(() => {
    const dimmedSet = new Set<string>();
    if (filterMatchMode !== 'all' || selectedFilterTags.length === 0) {
      return dimmedSet;
    }

    const groupedTagSet = new Set(
      attributeGroups.flatMap((g) => g.tags.map((t) => t.toLowerCase())),
    );
    const ungroupedTags = allTags.filter((t) => !groupedTagSet.has(t.toLowerCase()));

    for (const tag of ungroupedTags) {
      if (selectedFilterTags.includes(tag)) continue;
      const testTags = [...selectedFilterTags, tag];
      const resultCount = getMatchingCountForTags(testTags, 'all', showMissingPanel);
      if (resultCount === 0) {
        dimmedSet.add(tag);
      }
    }
    return dimmedSet;
  }, [filterMatchMode, selectedFilterTags, attributeGroups, allTags, showMissingPanel, getMatchingCountForTags]);

  const filteredSeries = useMemo(() => {
    return seriesList.filter((series) => {
      const normalizedSearch = searchQuery.toLowerCase().trim();
      const matchSearch =
        series.name.toLowerCase().includes(normalizedSearch) ||
        (series.specialChapters || []).some((chapter) =>
          chapter.name.toLowerCase().includes(normalizedSearch),
        );
      let matchTag = true;
      const activeTags = selectedFilterTags.length > 0 ? selectedFilterTags : (tagFilter === 'all' ? [] : [tagFilter]);
      if (activeTags.length > 0) {
        // match if series has any of the active tags OR any chapter matches the active tags
        const seriesTagsMatch = tagsMatch(series.tags, activeTags, filterMatchMode);
        const chapterTagsMatch = series.chapters.some((ch) => tagsMatch(ch.tags, activeTags, filterMatchMode));
        matchTag = seriesTagsMatch || chapterTagsMatch;
      }
      return matchSearch && matchTag;
    });
  }, [seriesList, searchQuery, tagFilter, selectedFilterTags, filterMatchMode]);

  // Enhanced search results: matching series + matching special chapters (grouped by series)
  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return null;

    const matchingSeries = seriesList.filter((series) =>
      series.name.toLowerCase().includes(query),
    );

    const matchingSpecialChapters = seriesList.flatMap((series) =>
      (series.specialChapters || [])
        .filter((chapter) => chapter.name.toLowerCase().includes(query))
        .map((chapter) => ({ series, chapter })),
    );

    return { matchingSeries, matchingSpecialChapters };
  }, [seriesList, searchQuery]);

  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.id === selectedId) ?? null,
    [seriesList, selectedId],
  );

  const filteredChapters = useMemo(() => {
    if (!selectedSeries) return [];
    if (chapterFilter === 'owned') {
      return selectedSeries.chapters.filter((c) => c.status === 'owned');
    }
    if (chapterFilter === 'missing') {
      return selectedSeries.chapters.filter((c) => c.status === 'missing');
    }
    return selectedSeries.chapters;
  }, [selectedSeries, chapterFilter]);

  useEffect(() => {
    const total = parseInt(formTotal, 10);
    if (isNaN(total) || total <= 0) {
      setPreviewChapters([]);
      return;
    }

    const capped = Math.min(total, 200);
    setPreviewChapters((prev) => {
      const statusMap = new Map(prev.map((ch) => [ch.number, ch.status]));
      return Array.from({ length: capped }, (_, i) => {
        const number = i + 1;
        return {
          number,
          status: statusMap.get(number) ?? 'missing',
        };
      });
    });
  }, [formTotal]);

  const openEditSeriesModal = (series: MangaSeries) => {
    setEditingSeriesId(series.id);
    setFormName(series.name);
    setFormTotal(String(series.totalChapters));
    setFormSelectedTagChips(series.tags || []);
    setFormNewTags('');

    const initialVals: { [groupId: string]: string } = {};
    attributeGroups.forEach((group) => {
      const groupTagSet = new Set(group.tags.map((t) => t.toLowerCase()));
      const matchingTag = (series.tags || []).find((t) => groupTagSet.has(t.toLowerCase()));
      if (matchingTag) {
        initialVals[group.id] = matchingTag;
      }
    });
    setFormGroupValues(initialVals);
    setOpenGroupDropdownId(null);
    setShowCreateModal(true);
  };

  const resetCreateForm = () => {
    setFormName('');
    setFormTotal('');
    setFormSelectedTagChips([]);
    setFormNewTags('');
    setPreviewChapters([]);
    setEditingSeriesId(null);
    setFormGroupValues({});
    setOpenGroupDropdownId(null);
  };

  const handleSaveSeries = () => {
    const name = formName.trim();
    const total = parseInt(formTotal, 10);
    const newTags = formNewTags.split(',').map((t) => t.trim()).filter(Boolean);

    // Collect values from attribute group inputs
    const groupValuesToSave: { groupId: string; value: string }[] = [];
    Object.entries(formGroupValues).forEach(([groupId, val]) => {
      const trimmed = val.trim();
      if (trimmed) {
        groupValuesToSave.push({ groupId, value: trimmed });
      }
    });
    const extraGroupTags = groupValuesToSave.map((item) => item.value);

    const tags = Array.from(new Set([...(formSelectedTagChips || []), ...newTags, ...extraGroupTags]));

    if (!name) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên truyện.');
      return;
    }
    if (isNaN(total) || total <= 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tổng số tập hợp lệ.');
      return;
    }

    // Auto update attribute groups to include newly typed tags
    if (groupValuesToSave.length > 0) {
      setAttributeGroups((prevGroups) =>
        prevGroups.map((g) => {
          const itemsForGroup = groupValuesToSave.filter((item) => item.groupId === g.id);
          if (itemsForGroup.length === 0) return g;
          const newTagsToAdd = itemsForGroup
            .map((item) => item.value)
            .filter((val) => !g.tags.some((existing) => existing.toLowerCase() === val.toLowerCase()));
          if (newTagsToAdd.length === 0) return g;
          return { ...g, tags: [...g.tags, ...newTagsToAdd] };
        }),
      );
    }

    if (editingSeriesId) {
      // Update existing series
      setSeriesList((prev) =>
        prev.map((series) => {
          if (series.id !== editingSeriesId) return series;
          const existingChapters = series.chapters || [];
          const newChapters = Array.from({ length: total }, (_, i) => {
            const number = i + 1;
            const existing = existingChapters.find((c) => c.number === number);
            const preview = previewChapters.find((ch) => ch.number === number);
            return {
              number,
              status: existing?.status ?? preview?.status ?? 'missing',
              tags: existing?.tags ?? preview?.tags ?? [],
            } as Chapter;
          });
          const updated = {
            ...series,
            name,
            totalChapters: total,
            tags: tags.length ? tags : series.tags ?? [],
            chapters: newChapters,
          } as MangaSeries;
          addHistory('Edited series', `Chỉnh sửa bộ truyện "${name}"`, updated);
          return updated;
        }),
      );
    } else {
      const newSeries: MangaSeries = {
        id: Date.now().toString(),
        name,
        totalChapters: total,
        tags: tags,
        chapters: Array.from({ length: total }, (_, i) => {
          const number = i + 1;
          const preview = previewChapters.find((ch) => ch.number === number);
          return {
            number,
            status: preview?.status ?? 'missing',
            tags: [],
          } as Chapter;
        }),
      };

      setSeriesList((prev) => [newSeries, ...prev]);
      addHistory('Created series', `Tạo bộ truyện "${name}"`, newSeries);
    }

    resetCreateForm();
    setShowCreateModal(false);
  };

  const handleTogglePreviewChapter = (chapterNumber: number) => {
    setPreviewChapters((prev) =>
      prev.map((ch) =>
        ch.number === chapterNumber
          ? { ...ch, status: ch.status === 'owned' ? 'missing' : 'owned' }
          : ch,
      ),
    );
  };

  // Mở modal điều chỉnh số lượng tập (thường)
  const handleOpenQuantityModalForChapter = (chapterNumber: number) => {
    if (!selectedId || !selectedSeries) return;
    const chapter = selectedSeries.chapters.find((ch) => ch.number === chapterNumber);
    const currentCount = chapter?.status === 'owned' ? chapter.count || 1 : 0;
    setQuantityTargetType('regular');
    setQuantityChapterNumber(chapterNumber);
    setQuantitySpecialId(null);
    setQuantityValue(Math.max(0, Math.min(99, currentCount)));
    setShowQuantityModal(true);
  };

  // Mở modal điều chỉnh số lượng tập đặc biệt
  const handleOpenQuantityModalForSpecial = (specialChapterId: string) => {
    if (!selectedId || !selectedSeries) return;
    const chapter = (selectedSeries.specialChapters || []).find((ch) => ch.id === specialChapterId);
    const currentCount = chapter?.status === 'owned' ? chapter.count || 1 : 0;
    setQuantityTargetType('special');
    setQuantityChapterNumber(null);
    setQuantitySpecialId(specialChapterId);
    setQuantityValue(Math.max(0, Math.min(99, currentCount)));
    setShowQuantityModal(true);
  };

  // Tiêu đề modal: tên bộ truyện + gạch ngang + "tập" + số tập
  const getModalTitleText = () => {
    if (!selectedSeries) return '';
    let chapterIdentifier = '';
    if (quantityTargetType === 'regular' && quantityChapterNumber !== null) {
      chapterIdentifier = `tập ${quantityChapterNumber}`;
    } else if (quantityTargetType === 'special' && quantitySpecialId !== null) {
      const sp = (selectedSeries.specialChapters || []).find((c) => c.id === quantitySpecialId);
      chapterIdentifier = `tập ${sp?.name || ''}`;
    }
    return `${selectedSeries.name} - ${chapterIdentifier}`;
  };

  // Xác nhận thay đổi số lượng từ modal
  const handleConfirmQuantityModal = () => {
    if (!selectedId || !selectedSeries) return;
    const newCount = Math.max(0, Math.min(99, quantityValue));

    if (quantityTargetType === 'regular' && quantityChapterNumber !== null) {
      setSeriesList((prev) =>
        prev.map((series) => {
          if (series.id !== selectedId) return series;
          return {
            ...series,
            chapters: series.chapters.map((ch) =>
              ch.number === quantityChapterNumber
                ? {
                    ...ch,
                    status: newCount > 0 ? 'owned' : 'missing',
                    count: newCount > 0 ? newCount : undefined,
                  }
                : ch,
            ),
          };
        }),
      );
      addHistory('Updated chapter quantity', `Đổi số lượng tập ${quantityChapterNumber} thành ${newCount}`, selectedSeries ?? undefined);
    } else if (quantityTargetType === 'special' && quantitySpecialId !== null) {
      const sp = (selectedSeries.specialChapters || []).find((c) => c.id === quantitySpecialId);
      const spName = sp?.name || 'tập đặc biệt';
      setSeriesList((prev) =>
        prev.map((series) => {
          if (series.id !== selectedId) return series;
          return {
            ...series,
            specialChapters: (series.specialChapters || []).map((ch) =>
              ch.id === quantitySpecialId
                ? {
                    ...ch,
                    status: newCount > 0 ? 'owned' : 'missing',
                    count: newCount > 0 ? newCount : undefined,
                  }
                : ch,
            ),
          };
        }),
      );
      addHistory('Updated special chapter quantity', `Đổi số lượng ${spName} thành ${newCount}`, selectedSeries ?? undefined);
    }

    setShowQuantityModal(false);
    setQuantityChapterNumber(null);
    setQuantitySpecialId(null);
  };

  const handleToggleChapter = (chapterNumber: number) => {
    if (!selectedId) return;
    setSeriesList((prev) =>
      prev.map((series) => {
        if (series.id !== selectedId) return series;
        return {
          ...series,
          chapters: series.chapters.map((ch) =>
            ch.number === chapterNumber
              ? {
                  ...ch,
                  status: ch.status === 'owned' ? 'missing' : 'owned',
                  count: ch.status === 'owned' ? undefined : 1,
                }
              : ch,
          ),
        };
      }),
    );
    addHistory('Toggled chapter', `Đổi trạng thái tập ${chapterNumber}`, selectedSeries ?? undefined);
  };

  // Nhấn giữ để thêm bản trùng (tăng số lượng bản đã có)
  const handleIncrementChapter = (chapterNumber: number) => {

    if (!selectedId) return;
    setSeriesList((prev) =>
      prev.map((series) => {
        if (series.id !== selectedId) return series;
        return {
          ...series,
          chapters: series.chapters.map((ch) =>
            ch.number === chapterNumber
              ? {
                  ...ch,
                  status: 'owned',
                  count: (ch.count || 1) + 1,
                }
              : ch,
          ),
        };
      }),
    );
    addHistory('Added duplicate chapter', `Thêm bản trùng tập ${chapterNumber}`, selectedSeries ?? undefined);
  };

  const handleToggleSpecialChapter = (specialChapterId: string) => {

    if (!selectedId) return;
    setSeriesList((prev) =>
      prev.map((series) => {
        if (series.id !== selectedId) return series;
        return {
          ...series,
          specialChapters: (series.specialChapters || []).map((chapter) =>
            chapter.id === specialChapterId
              ? {
                  ...chapter,
                  status: chapter.status === 'owned' ? 'missing' : 'owned',
                  count: chapter.status === 'owned' ? undefined : 1,
                }
              : chapter,
          ),
        };
      }),
    );
    addHistory('Toggled special chapter', 'Đổi trạng thái tập đặc biệt', selectedSeries ?? undefined);
  };

  // Nhấn giữ để thêm bản trùng cho tập đặc biệt
  const handleIncrementSpecialChapter = (specialChapterId: string) => {
    if (!selectedId) return;
    setSeriesList((prev) =>
      prev.map((series) => {
        if (series.id !== selectedId) return series;
        return {
          ...series,
          specialChapters: (series.specialChapters || []).map((chapter) =>
            chapter.id === specialChapterId
              ? {
                  ...chapter,
                  status: 'owned',
                  count: (chapter.count || 1) + 1,
                }
              : chapter,
          ),
        };
      }),
    );
    addHistory('Added duplicate special chapter', 'Thêm bản trùng tập đặc biệt', selectedSeries ?? undefined);
  };

  const handleAddSpecialChapters = () => {
    if (!selectedId) return;
    const names = specialChapterNames
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập ít nhất một tên tập đặc biệt.');
      return;
    }

    setSeriesList((prev) =>
      prev.map((series) => {
        if (series.id !== selectedId) return series;
        const existingNames = new Set((series.specialChapters || []).map((chapter) => chapter.name.toLowerCase()));
        const added = names
          .filter((name) => !existingNames.has(name.toLowerCase()))
          .map((name, index) => ({
            id: `${Date.now()}-${index}-${name}`,
            name,
            status: 'missing' as ChapterStatus,
            tags: [],
          }));
        return { ...series, specialChapters: [...(series.specialChapters || []), ...added] };
      }),
    );
    addHistory('Added special chapters', `Thêm ${names.length} tập đặc biệt`, selectedSeries ?? undefined);
    setSpecialChapterNames('');
    setShowSpecialChapterModal(false);
  };

  const handleDeleteSpecialChapter = (specialChapterId: string) => {
    if (!selectedId) return;
    setSeriesList((prev) =>
      prev.map((series) =>
        series.id === selectedId
          ? { ...series, specialChapters: (series.specialChapters || []).filter((chapter) => chapter.id !== specialChapterId) }
          : series,
      ),
    );
    addHistory('Deleted special chapter', 'Xóa tập đặc biệt', selectedSeries ?? undefined);
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setChapterFilter('all');
    setScreen('detail');
  };

  const renderSearchResults = () => {
    if (!searchResults) return null;
    const { matchingSeries, matchingSpecialChapters } = searchResults;
    const hasAny = matchingSeries.length > 0 || matchingSpecialChapters.length > 0;

    if (!hasAny) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Không tìm thấy kết quả</Text>
          <Text style={styles.emptySubtitle}>
            Không có bộ truyện hoặc tập nào khớp với “{searchQuery}”
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.searchResultsContent}
        showsVerticalScrollIndicator={false}>
        {matchingSeries.length > 0 && (
          <>
            <Text style={styles.searchSectionTitle}>Bộ truyện ({matchingSeries.length})</Text>
            <View style={styles.searchSeriesGrid}>
              {matchingSeries.map((item) => {
                const owned = getOwnedCount(item);
                const total = getTrackedCount(item);
                const status = getSeriesStatus(item);
                return (
                  <Pressable key={item.id} style={styles.searchSeriesCard} onPress={() => openDetail(item.id)}>
                    <View style={[styles.searchSeriesIconWrap, { width: dynamicSeriesCoverSize, height: dynamicSeriesCoverSize }]}>
                      {item.coverImageUri ? (
                        <Image source={{ uri: item.coverImageUri }} style={styles.seriesCoverImage} />
                      ) : (
                        <Ionicons name="library" size={Math.round(24 * sizeScale)} color="#6366f1" />
                      )}
                    </View>
                    <Text style={[styles.searchSeriesName, { fontSize: baseFontSize }]} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.searchSeriesMeta}>{owned}/{total} tập</Text>
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
              })}
            </View>
          </>
        )}

        {matchingSpecialChapters.length > 0 && (
          <>
            <Text style={styles.searchSectionTitle}>Tập đặc biệt ({matchingSpecialChapters.length})</Text>
            <View style={styles.searchChapterList}>
              {matchingSpecialChapters.map(({ series, chapter }) => (
                <Pressable
                  key={chapter.id}
                  style={[styles.searchChapterRow, chapter.status === 'owned' && styles.searchChapterRowOwned]}
                  onPress={() => openDetail(series.id)}>
                  <Ionicons
                    name={chapter.status === 'owned' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={chapter.status === 'owned' ? STATUS_COLORS.owned : STATUS_COLORS.missing}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchChapterName} numberOfLines={2}>{chapter.name}</Text>
                    <Text style={styles.searchChapterSeries}>{series.name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  const renderMainScreen = () => (
    <>
      <View style={styles.toolbar}>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm tên truyện, tập đặc biệt..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[
            styles.filterButton,
            (selectedFilterTags.length > 0 || tagFilter !== 'all') && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilterModal(true)}>
          <Ionicons name="filter" size={22} color="#6366f1" />
        </Pressable>

      </View>

      {(selectedFilterTags.length > 0 || tagFilter !== 'all') && (
        <View style={styles.activeFilters}>
          {selectedFilterTags.map((t) => (
            <View key={t} style={styles.filterChip}>
              <Text style={styles.filterChipText}>{t}</Text>
            </View>
          ))}
          {tagFilter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>{tagFilter}</Text>
            </View>
          )}
        </View>
      )}

      {searchQuery.trim().length > 0 ? (
        renderSearchResults()
      ) : filteredSeries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Chưa có bộ truyện nào</Text>
          <Text style={styles.emptySubtitle}>
            Nhấn “Thêm mới” để bắt đầu quản lý truyện tranh
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={gridScrollRef}
          style={styles.gridList}
          contentContainerStyle={styles.seriesGridContent}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.seriesGrid}>
            {filteredSeries.map((item) => (
              <MangaCard
                key={item.id}
                series={item}
                cardWidth={cardWidth}
                cardPadding={cardPadding}
                seriesCoverSize={seriesCoverSize}
                nameFontSize={nameFontSize}
                infoLevel={infoLevel}
                onPress={() => openDetail(item.id)}
                onLongPress={() => {
                  setSelectedId(item.id);
                  setShowGalleryModal(true);
                }}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="library-outline" size={28} color="#6366f1" />
        {screen === 'main' ? (
          <Text style={styles.headerTitle}>Quản lý Truyện Tranh</Text>
        ) : (
          <Pressable
            style={styles.headerTitlePressable}
            onPress={() => {
              if (selectedSeries) {
                openEditSeriesModal(selectedSeries);
              }
            }}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {selectedSeries?.name ?? 'Chi tiết'}
            </Text>
          </Pressable>
        )}
        {screen === 'main' && (
          <Pressable
            style={styles.headerAddButton}
            onPress={() => { resetCreateForm(); setShowCreateModal(true); }}
            android_ripple={{ color: 'rgba(255,255,255,0.12)', radius: 20 }}>
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        )}
        {saveError && (
          <View style={styles.errorIndicator}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={styles.errorText}>Lỗi lưu!</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {renderMainScreen()}
        {selectedSeries ? (
          <View style={styles.detailOverlay}>
            <MangaDetailModal
              series={selectedSeries}
              owned={getOwnedCount(selectedSeries)}
              total={getTrackedCount(selectedSeries)}
              chapterFilter={chapterFilter}
              filteredChapters={filteredChapters}
              chapterFontSize={chapterFontSize}
              onBack={goToMainScreen}
              onCoverPress={(uri) => {
                setSelectedImageUri(uri);
                setShowGalleryModal(true);
              }}
              onOpenGallery={() => setShowGalleryModal(true)}
              onFilterChange={setChapterFilter}
              onDelete={handleDeleteSeries}
              onAddSpecial={() => setShowSpecialChapterModal(true)}
              onChapterPress={handleOpenQuantityModalForChapter}
              onSpecialPress={handleOpenQuantityModalForSpecial}
            />
          </View>
        ) : null}
      </View>

      {/* Modal tạo bộ truyện */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <TouchableWithoutFeedback style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['bottom']} style={[styles.modalContent, styles.createModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingSeriesId ? 'Chỉnh sửa bộ truyện' : 'Tạo bộ truyện mới'}</Text>
              <Pressable onPress={() => { setShowCreateModal(false); resetCreateForm(); }}>
                <Ionicons name="close" size={26} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}>
              <Text style={styles.label}>Tên truyện</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tên truyện..."
                placeholderTextColor="#94a3b8"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Tổng số tập</Text>
              <TextInput
                style={styles.input}
                placeholder="Chỉ nhập số, ví dụ: 12"
                placeholderTextColor="#94a3b8"
                value={formTotal}
                onChangeText={(text) => setFormTotal(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />

              {attributeGroups.length > 0 && (
                <View style={styles.attributeGroupsSection}>
                  <Text style={[styles.label, { marginTop: 12 }]}>Nhóm đặc điểm</Text>
                  {attributeGroups.map((group) => {
                    const isDropdownOpen = openGroupDropdownId === group.id;
                    const currentValue = formGroupValues[group.id] || '';

                    return (
                      <View key={group.id} style={styles.groupInputContainer}>
                        <Text style={styles.groupInputLabel}>{group.name}</Text>
                        <View style={styles.groupInputRow}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder={`Nhập ${group.name.toLowerCase()} (vd: ${group.tags[0] || 'mới'})...`}
                            placeholderTextColor="#94a3b8"
                            value={currentValue}
                            onChangeText={(text) =>
                              setFormGroupValues((prev) => ({ ...prev, [group.id]: text }))
                            }
                          />
                          {group.tags.length > 0 && (
                            <Pressable
                              style={styles.groupDropdownButton}
                              onPress={() =>
                                setOpenGroupDropdownId((prev) => (prev === group.id ? null : group.id))
                              }>
                              <Ionicons
                                name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color="#4338ca"
                              />
                              <Text style={styles.groupDropdownButtonText}>Chọn nhanh</Text>
                            </Pressable>
                          )}
                        </View>

                        {isDropdownOpen && group.tags.length > 0 && (
                          <View style={styles.groupDropdownMenu}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.groupDropdownScroll}>
                              {group.tags.map((tag) => {
                                const isSelected = currentValue.toLowerCase() === tag.toLowerCase();
                                return (
                                  <Pressable
                                    key={tag}
                                    style={[
                                      styles.groupDropdownChip,
                                      isSelected && styles.groupDropdownChipSelected,
                                    ]}
                                    onPress={() => {
                                      setFormGroupValues((prev) => ({ ...prev, [group.id]: tag }));
                                      setOpenGroupDropdownId(null);
                                    }}>
                                    <Text
                                      style={[
                                        styles.groupDropdownChipText,
                                        isSelected && styles.groupDropdownChipTextSelected,
                                      ]}>
                                      {tag}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={styles.label}>Chọn Thẻ (chọn sẵn hoặc thêm mới)</Text>
              <View style={styles.tagGrid}>
                {allTags.map((tag) => {
                  const selected = formSelectedTagChips.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[styles.tagChip, selected && styles.tagChipActive]}
                      onPress={() => {
                        setFormSelectedTagChips((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                        );
                      }}>
                      <Text style={[styles.tagChipText, selected && styles.tagChipTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.label}>Thêm tag mới (cách nhau bằng dấu phẩy)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tag mới..."
                placeholderTextColor="#94a3b8"
                value={formNewTags}
                onChangeText={setFormNewTags}
              />

              {previewChapters.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewTitle}>
                    Xem trước {previewChapters.length} tập · Nhấn để đổi trạng thái
                  </Text>
                  <View style={styles.previewGrid}>
                    {previewChapters.map((ch) => (
                      <ChapterCell
                        key={ch.number}
                        chapter={ch}
                        onPress={() => handleTogglePreviewChapter(ch.number)}
                      />
                    ))}
                  </View>
                </View>
              )}

              <Pressable style={styles.saveButton} onPress={handleSaveSeries}>
                <Ionicons name="save-outline" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Lưu bộ truyện</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal lọc */}
      <Modal visible={showFilterModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.fullscreenModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bộ lọc</Text>
            <Pressable
              onPress={() => setShowFilterModal(false)}
              accessibilityLabel="Đóng bộ lọc"
              style={{ minWidth: 48, minHeight: 48, padding: 10, alignItems: 'center', justifyContent: 'center' }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={28} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.fullscreenModalContent}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <Pressable
                style={[styles.filterOption, showMissingPanel && styles.filterOptionActive, { flex: 1, marginRight: 8 }]}
                onPress={() => setShowMissingPanel((s) => !s)}>
                <Text
                  style={[styles.filterOptionText, showMissingPanel && styles.filterOptionTextActive]}>
                  Còn thiếu
                </Text>
              </Pressable>

              <Pressable
                style={[styles.filterOption, filterMatchMode === 'any' && styles.filterOptionActive, { paddingHorizontal: 12, width: 72, alignItems: 'center' }]}
                onPress={() => setFilterMatchMode('any')}>
                <Text style={[styles.filterOptionText, filterMatchMode === 'any' && styles.filterOptionTextActive]}>OR</Text>
              </Pressable>

              <Pressable
                style={[styles.filterOption, filterMatchMode === 'all' && styles.filterOptionActive, { paddingHorizontal: 12, width: 72, alignItems: 'center' }]}
                onPress={() => setFilterMatchMode('all')}>
                <Text style={[styles.filterOptionText, filterMatchMode === 'all' && styles.filterOptionTextActive]}>AND</Text>
              </Pressable>

              <Pressable
                style={[styles.filterOption, { width: 44, paddingHorizontal: 0, alignItems: 'center', justifyContent: 'center' }]}
                accessibilityLabel="Đặt lại bộ lọc"
                onPress={() => {
                  setSelectedFilterTags([]);
                  setTagFilter('all');
                  setShowMissingPanel(true);
                  setFilterMatchMode('all');
                }}>
                <Ionicons name="refresh" size={18} color="#64748b" />
              </Pressable>
            </View>

            {/* Render Attribute Groups Buttons / Expanded Boxes */}
            <View style={styles.attributeGroupsFilterSection}>
              {attributeGroups.map((group) => {
                const isExpanded = expandedGroupIds.includes(group.id);
                const selectedCount = group.tags.filter((t) => selectedFilterTags.includes(t)).length;
                const hasSelected = selectedCount > 0;

                if (!isExpanded) {
                  // Collapsed state: Button [Tên nhóm +]
                  return (
                    <Pressable
                      key={group.id}
                      style={[
                        styles.filterGroupButton,
                        hasSelected ? styles.filterGroupButtonSelected : styles.filterGroupButtonDefault,
                      ]}
                      onPress={() => setExpandedGroupIds((prev) => [...prev, group.id])}>
                      <Text
                        style={[
                          styles.filterGroupButtonText,
                          hasSelected
                            ? styles.filterGroupButtonTextSelected
                            : styles.filterGroupButtonTextDefault,
                        ]}>
                        {group.name} +
                      </Text>
                    </Pressable>
                  );
                } else {
                  // Expanded state: Expanded Box
                  return (
                    <View
                      key={group.id}
                      style={[
                        styles.filterGroupExpandedBox,
                        hasSelected
                          ? styles.filterGroupExpandedBoxSelected
                          : styles.filterGroupExpandedBoxDefault,
                      ]}>
                      <View style={styles.filterGroupHeader}>
                        <Text style={styles.filterGroupName}>{group.name}</Text>
                        <View style={styles.filterGroupActions}>
                          <Pressable
                            style={styles.filterGroupCollapseBtn}
                            onPress={() =>
                              setExpandedGroupIds((prev) => prev.filter((id) => id !== group.id))
                            }>
                            <Ionicons name="chevron-up-outline" size={14} color="#0284c7" />
                            <Text style={styles.filterGroupCollapseText}>Thu gọn</Text>
                          </Pressable>
                          <Pressable
                            style={styles.filterGroupClearBtn}
                            onPress={() => {
                              // Uncheck all tags in this group
                              setSelectedFilterTags((prev) => prev.filter((t) => !group.tags.includes(t)));
                              // Close box
                              setExpandedGroupIds((prev) => prev.filter((id) => id !== group.id));
                            }}>
                            <Ionicons name="trash-outline" size={14} color="#ef4444" />
                            <Text style={styles.filterGroupClearText}>Xóa</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.tagGrid}>
                        {group.tags.length === 0 && (
                          <Text style={styles.filterOptionText}>Chưa có tag trong nhóm này</Text>
                        )}
                        {group.tags.map((tag) => {
                          const selected = selectedFilterTags.includes(tag);
                          return (
                            <Pressable
                              key={tag}
                              style={[styles.tagChip, selected && styles.tagChipActive]}
                              onPress={() => {
                                setSelectedFilterTags((prev) =>
                                  prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                                );
                              }}>
                              <Text style={[styles.tagChipText, selected && styles.tagChipTextActive]}>
                                {tag}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                }
              })}
            </View>

            {/* Ungrouped tags section */}
            {(() => {
              const groupedTagSet = new Set(
                attributeGroups.flatMap((g) => g.tags.map((t) => t.toLowerCase())),
              );
              const ungroupedTags = allTags.filter((t) => !groupedTagSet.has(t.toLowerCase()));
              if (ungroupedTags.length === 0) return null;

              return (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.ungroupedTagsTitle}>Thẻ khác</Text>
                  <View style={styles.tagGrid}>
                    {ungroupedTags.map((tag) => {
                      const selected = selectedFilterTags.includes(tag);
                      const isDimmed = dimmedUngroupedTags.has(tag);
                      return (
                        <Pressable
                          key={tag}
                          style={[
                            styles.tagChip,
                            selected && styles.tagChipActive,
                            isDimmed && { opacity: 0.4 },
                          ]}
                          onPress={() => {
                            if (isDimmed) {
                              setSelectedFilterTags([tag]);
                            } else {
                              setSelectedFilterTags((prev) =>
                                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                              );
                            }
                          }}>
                          <Text style={[styles.tagChipText, selected && styles.tagChipTextActive]}>
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {showMissingPanel ? (
              <View style={{ marginTop: 12 }}>
                <View style={{ marginTop: 8 }}>
                  {(() => {
                    const rows: React.ReactElement[] = [];
                    seriesList.forEach((series) => {
                      const missing = series.chapters.filter((c) => c.status === 'missing');
                      if (missing.length === 0) return;
                      let includeSeries = true;
                      if (selectedFilterTags.length > 0) {
                        const seriesTagsMatch = tagsMatch(series.tags, selectedFilterTags, filterMatchMode);
                        const chapterTagsMatch = missing.some((ch) => tagsMatch(ch.tags, selectedFilterTags, filterMatchMode));
                        includeSeries = seriesTagsMatch || chapterTagsMatch;
                      }
                      if (!includeSeries) return;

                      const displayedMissing = selectedFilterTags.length > 0
                        ? (tagsMatch(series.tags, selectedFilterTags, filterMatchMode) ? missing : missing.filter((ch) => tagsMatch(ch.tags, selectedFilterTags, filterMatchMode)))
                        : missing;
                      if (displayedMissing.length === 0) return;

                      rows.push(
                        <View key={series.id} style={styles.filterCard}>
                          <Pressable style={styles.filterCardTitleContainer} onPress={() => { setSelectedId(series.id); setScreen('detail'); setShowFilterModal(false); }}>
                            <Text style={[styles.filterCardTitle, { fontSize: baseFontSize }]} numberOfLines={1}>{series.name}</Text>
                          </Pressable>
                          <View style={styles.filterCardChapters}>
                            {displayedMissing.map((c) => (
                              <ChapterCell
                                key={c.number}
                                chapter={c}
                                size={28}
                                fontSize={11}
                                onPress={() => {
                                  setSelectedId(series.id);
                                  setScreen('detail');
                                  setShowFilterModal(false);
                                }}
                              />
                            ))}
                          </View>
                        </View>
                      );
                    });
                    if (rows.length === 0) return <Text style={styles.emptySubtitle}>Không có bộ truyện thiếu theo bộ lọc</Text>;
                    return rows;
                  })()}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <View style={{ marginTop: 8 }}>
                  {(() => {
                    const rows: React.ReactElement[] = [];
                    seriesList.forEach((series) => {
                      const chaptersToShow = selectedFilterTags.length > 0
                        ? (tagsMatch(series.tags, selectedFilterTags, filterMatchMode) ? series.chapters : series.chapters.filter((ch) => tagsMatch(ch.tags, selectedFilterTags, filterMatchMode)))
                        : series.chapters;
                      if (chaptersToShow.length === 0) return;
                      rows.push(
                        <View key={series.id} style={styles.filterCard}>
                          <Pressable style={styles.filterCardTitleContainer} onPress={() => { setSelectedId(series.id); setScreen('detail'); setShowFilterModal(false); }}>
                            <Text style={[styles.filterCardTitle, { fontSize: baseFontSize }]} numberOfLines={1}>{series.name}</Text>
                          </Pressable>
                          <View style={styles.filterCardChapters}>
                            {chaptersToShow.map((c) => (
                              <ChapterCell
                                key={c.number}
                                chapter={c}
                                size={28}
                                fontSize={11}
                                onPress={() => {
                                  setSelectedId(series.id);
                                  setScreen('detail');
                                  setShowFilterModal(false);
                                }}
                              />
                            ))}
                          </View>
                        </View>
                      );
                    });
                    if (rows.length === 0) return <Text style={styles.emptySubtitle}>Không có chương theo bộ lọc</Text>;
                    return rows;
                  })()}
                </View>
              </View>
            )}

            <View style={{ height: 28 }} />
          </ScrollView>

        </SafeAreaView>
      </Modal>

      <Modal visible={showSpecialChapterModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <TouchableWithoutFeedback style={{ flex: 1 }} onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Thêm tập đặc biệt</Text>
                  <Pressable onPress={() => { setShowSpecialChapterModal(false); setSpecialChapterNames(''); }}>
                    <Ionicons name="close" size={26} color="#64748b" />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }}>
                  <Text style={styles.label}>Tên tập</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder={'Mỗi dòng một tập, ví dụ:\nNgoại truyện 1\nTừ điển Pokemon\nDoremon movie'}
                    placeholderTextColor="#94a3b8"
                    value={specialChapterNames}
                    onChangeText={setSpecialChapterNames}
                    multiline
                    textAlignVertical="top"
                  />
                  <Pressable style={styles.saveButton} onPress={handleAddSpecialChapters}>
                    <Ionicons name="add-circle-outline" size={22} color="#fff" />
                    <Text style={styles.saveButtonText}>Thêm tập</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal ảnh */}
      <Modal visible={showGalleryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ảnh bộ truyện</Text>
              <Pressable onPress={() => setShowGalleryModal(false)}>
                <Ionicons name="close" size={26} color="#64748b" />
              </Pressable>
            </View>

            {selectedImageUri ? (
              <Image source={{ uri: selectedImageUri }} style={styles.largePreviewImage} />
            ) : (
              <View style={styles.emptyImagePreview}>
                <Ionicons name="image-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptySubtitle}>Chưa có ảnh</Text>
              </View>
            )}

            <Text style={styles.label}>Ảnh chính (tối đa 1)</Text>
            <View style={styles.imageActionsRow}>
              <Pressable style={styles.imageActionButton} onPress={() => pickSeriesImage('cover')}>
                <Ionicons name="image-outline" size={18} color="#fff" />
                <Text style={styles.imageActionText}>{selectedSeries?.coverImageUri ? 'Thay ảnh' : 'Thêm ảnh'}</Text>
              </Pressable>
              {selectedSeries?.coverImageUri && (
                <Pressable style={styles.imageRemoveButton} onPress={() => removeSeriesImage('cover')}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.imageRemoveText}>Xóa</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.galleryTitleRow}>
              <Text style={styles.label}>Ảnh phụ ({selectedSeries?.galleryImageUris?.length || 0}/4)</Text>
              <Pressable
                style={[
                  styles.imageActionButton,
                  (selectedSeries?.galleryImageUris?.length || 0) >= 4 && styles.imageActionButtonDisabled,
                ]}
                disabled={(selectedSeries?.galleryImageUris?.length || 0) >= 4}
                onPress={() => pickSeriesImage('gallery')}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.imageActionText}>Thêm ảnh phụ</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
              {(selectedSeries?.galleryImageUris || []).map((uri) => (
                <Pressable key={uri} onPress={() => setSelectedImageUri(uri)} style={styles.galleryImageWrap}>
                  <Image source={{ uri }} style={styles.galleryImage} />
                  <Pressable style={styles.galleryRemoveButton} onPress={() => removeSeriesImage('gallery', uri)}>
                    <Ionicons name="close-circle" size={20} color="#dc2626" />
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.backupHint}>Ảnh được lưu cục bộ trên thiết bị và không gửi lên Google Sheets.</Text>
          </View>
        </View>
      </Modal>



      {/* Modal chỉnh tags cho tập */}
      <Modal visible={showEditChapterModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <TouchableWithoutFeedback style={{ flex: 1 }} onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chỉnh tags tập {editingChapter?.number}</Text>
                  <Pressable onPress={() => setShowEditChapterModal(false)}>
                    <Ionicons name="close" size={26} color="#64748b" />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }}>
                  <Text style={styles.label}>Tags (cách nhau bằng dấu phẩy)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ví dụ: Fanmade, Translated..."
                    placeholderTextColor="#94a3b8"
                    value={editingChapterTags}
                    onChangeText={setEditingChapterTags}
                  />

                  <Pressable
                    style={styles.saveButton}
                    onPress={() => {
                      if (!editingChapter) return;
                      // save chapter tags into series
                      setSeriesList((prev) =>
                        prev.map((series) => {
                          if (series.id !== selectedId) return series;
                          return {
                            ...series,
                            chapters: series.chapters.map((ch) =>
                              ch.number === editingChapter.number
                                ? { ...ch, tags: editingChapterTags.split(',').map((t) => t.trim()).filter(Boolean) }
                                : ch,
                            ),
                          };
                        }),
                      );
                      addHistory('Edited chapter tags', `Chỉnh tags tập ${editingChapter.number}`, selectedSeries ?? undefined);
                      setShowEditChapterModal(false);
                      setEditingChapter(null);
                      setEditingChapterTags('');
                    }}>
                    <Ionicons name="save-outline" size={22} color="#fff" />
                    <Text style={styles.saveButtonText}>Lưu tags</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal điều chỉnh số lượng tập */}
      <Modal visible={showQuantityModal} animationType="slide" transparent onRequestClose={() => setShowQuantityModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <TouchableWithoutFeedback style={{ flex: 1 }} onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }}>
                  {/* Dòng 1: Tên bộ truyện + gạch ngang + "tập" + số tập */}
                  <View style={styles.quantityModalHeader}>
                    <Text style={styles.quantityModalTitle}>{getModalTitleText()}</Text>
                  </View>

                  {/* Dòng 2: Ô hiển thị số lượng tập ở giữa, bên trái là dấu trừ, bên phải là dấu cộng (0-99) */}
                  <View style={styles.quantityControlRow}>
                    <Pressable
                      style={[styles.quantityStepBtn, quantityValue <= 0 && styles.quantityStepBtnDisabled]}
                      onPress={() => setQuantityValue((prev) => Math.max(0, prev - 1))}
                      disabled={quantityValue <= 0}>
                      <Ionicons name="remove" size={24} color={quantityValue <= 0 ? '#cbd5e1' : '#4338ca'} />
                    </Pressable>

                    <View style={styles.quantityDisplayBox}>
                      <TextInput
                        style={styles.quantityDisplayText}
                        keyboardType="number-pad"
                        value={String(quantityValue)}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/[^0-9]/g, '');
                          if (cleaned === '') {
                            setQuantityValue(0);
                          } else {
                            const num = parseInt(cleaned, 10);
                            setQuantityValue(Math.max(0, Math.min(99, num)));
                          }
                        }}
                        maxLength={2}
                        selectTextOnFocus
                      />
                    </View>

                    <Pressable
                      style={[styles.quantityStepBtn, quantityValue >= 99 && styles.quantityStepBtnDisabled]}
                      onPress={() => setQuantityValue((prev) => Math.min(99, prev + 1))}
                      disabled={quantityValue >= 99}>
                      <Ionicons name="add" size={24} color={quantityValue >= 99 ? '#cbd5e1' : '#4338ca'} />
                    </Pressable>
                  </View>

                  {/* Dòng 3: Hủy và Xác nhận */}
                  <View style={styles.quantityActionRow}>
                    <Pressable style={styles.quantityCancelBtn} onPress={() => setShowQuantityModal(false)}>
                      <Text style={styles.quantityCancelBtnText}>Hủy</Text>
                    </Pressable>
                    <Pressable style={styles.quantityConfirmBtn} onPress={handleConfirmQuantityModal}>
                      <Text style={styles.quantityConfirmBtnText}>Xác nhận</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  body: {
    flex: 1,
    position: 'relative',
  },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  headerTitlePressable: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  headerAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    paddingVertical: 0,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    color: '#4338ca',
    fontWeight: '600',
  },
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
  seriesCoverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  seriesStatusBar: {
    height: 6,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  createModalContent: {
    // Khoảng trắng dưới cùng để nút "Lưu bộ truyện" không bị thanh điều hướng che khuất.
    // SafeAreaView (edges bottom) sẽ cộng thêm inset bottom của hệ thống vào giá trị này.
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1e293b',
  },
  multilineInput: {
    minHeight: 100,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  tagChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  tagChipTextActive: {
    color: '#4338ca',
  },
  previewSection: {
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  fullscreenModalContent: {
    padding: GRID_PADDING,
  },
  filterOption: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  filterOptionActive: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  filterOptionTextActive: {
    color: '#4338ca',
  },
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: 'relative',
  },
  filterCardTitleContainer: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    zIndex: 10,
    maxWidth: '85%',
  },
  filterCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  filterCardChapters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  largePreviewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  emptyImagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  imageActionButtonDisabled: {
    opacity: 0.5,
  },
  imageActionText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  imageRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  imageRemoveText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  galleryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  galleryRow: {
    gap: 8,
    paddingVertical: 8,
  },
  galleryImageWrap: {
    position: 'relative',
  },
  galleryImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  galleryRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: '#fca5a5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  backupHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 8,
  },
  historyRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  backupStatus: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
    marginTop: 8,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  exportButtonText: {
    fontSize: 13,
    color: '#4338ca',
    fontWeight: '600',
  },
  searchResultsContent: {
    padding: GRID_PADDING,
    paddingBottom: 100,
  },
  searchSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    marginTop: 8,
  },
  searchSeriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: 16,
  },
  searchSeriesCard: {
    width: CELL_SIZE,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchSeriesIconWrap: {
    width: SERIES_COVER_SIZE,
    height: SERIES_COVER_SIZE,
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  searchSeriesName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    minHeight: 34,
  },
  searchSeriesMeta: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 8,
  },
  searchChapterList: {
    gap: 8,
  },
  searchChapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchChapterRowOwned: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  searchChapterName: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '700',
  },
  searchChapterSeries: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sizeSliderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  sizeOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sizeOptionActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  sizeOptionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  sizeOptionTextActive: {
    color: '#4338ca',
  },
  sizePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 20,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  sizePreviewItem: {
    alignItems: 'center',
    gap: 8,
  },
  sizePreviewBox: {
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sizePreviewLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  quantityModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  quantityModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  quantityControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 16,
  },
  quantityStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  quantityStepBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  quantityDisplayBox: {
    width: 90,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityDisplayText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    width: '100%',
    paddingVertical: 0,
  },
  quantityActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  quantityCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  quantityConfirmBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityConfirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  attributeGroupsSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  groupInputContainer: {
    marginBottom: 10,
  },
  groupInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  groupInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupDropdownButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338ca',
  },
  groupDropdownMenu: {
    marginTop: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupDropdownScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  groupDropdownChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupDropdownChipSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  groupDropdownChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  groupDropdownChipTextSelected: {
    color: '#4338ca',
  },
  attributeGroupsFilterSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterGroupButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGroupButtonDefault: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  filterGroupButtonSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  filterGroupButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterGroupButtonTextDefault: {
    color: '#1d4ed8',
  },
  filterGroupButtonTextSelected: {
    color: '#15803d',
  },
  filterGroupExpandedBox: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  filterGroupExpandedBoxDefault: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  filterGroupExpandedBoxSelected: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  filterGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  filterGroupName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  filterGroupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterGroupCollapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
  },
  filterGroupCollapseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  filterGroupClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
  },
  filterGroupClearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  ungroupedTagsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  addGroupRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addGroupBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  groupList: {
    gap: 10,
    marginBottom: 12,
  },
  groupCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  groupCardDeleteBtn: {
    padding: 4,
  },
  groupTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  groupTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groupTagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
  },
  addTagToGroupRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  addTagToGroupBtn: {
    backgroundColor: '#4338ca',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  addTagToGroupBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  accountSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  accountCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    marginTop: 8,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  accountEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
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
    fontWeight: '600',
  },
  syncStatusText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    marginTop: 8,
  },
  accountActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  syncUserBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4338ca',
    borderRadius: 8,
    paddingVertical: 8,
  },
  syncUserBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  signOutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  signOutBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  loginCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 8,
  },
  clientIdContainer: {
    marginTop: 8,
  },
  saveClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 6,
  },
  saveClientBtnText: {
    fontSize: 12,
    color: '#4338ca',
    fontWeight: '700',
  },
});
