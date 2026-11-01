import MangaCard, { getOwnedCount, getSeriesStatus, getTrackedCount } from '@/components/MangaCard';
import MangaDetailModal, { ChapterCell, STATUS_COLORS, type ChapterFilter } from '@/components/MangaDetailModal';
import {
  CELL_SIZE,
  GRID_GAP,
  GRID_PADDING,
  SERIES_COVER_MAX_SIZE,
  SERIES_COVER_SIZE,
  getCellWidth,
  getFontSizeForLevel,
  getGridColumns,
  getInfoLevel,
} from '@/constants/layout';
import { useAppData } from '@/contexts/AppDataContext';
import type { AttributeGroup, Chapter, ChapterStatus, MangaSeries } from '@/types';
import { filterChaptersByTags, tagsMatch } from '@/utils/tags';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '@/styles/homeStyles';

type Screen = 'main' | 'detail';

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

  // LÆ°u vá»‹ trÃ­ cuá»™n cá»§a danh sÃ¡ch lÆ°á»›i chÃ­nh Ä‘á»ƒ phá»¥c há»“i khi Ä‘Ã³ng mÃ n hÃ¬nh chi tiáº¿t
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

  // KÃ­ch thÆ°á»›c icon Ä‘á»™ng dá»±a trÃªn sizeMultiplier (1-10)
  // sizeMultiplier = 5 lÃ  kÃ­ch thÆ°á»›c máº·c Ä‘á»‹nh (100%)
  const sizeScale = sizeMultiplier / 5;
  const dynamicSeriesCoverSize = Math.min(SERIES_COVER_SIZE * sizeScale, SERIES_COVER_MAX_SIZE);
  const cardWidth = getCellWidth(getGridColumns(sizeMultiplier));
  const cardPadding = Math.max(6, Math.round(cardWidth * 0.1));
  const seriesCoverSize = Math.max(24, cardWidth - cardPadding * 2 - 2);
  const infoLevel = getInfoLevel(sizeMultiplier);
  const baseFontSize = getFontSizeForLevel(sizeMultiplier);
  const nameFontSize = baseFontSize + 5;
  const chapterFontSize = baseFontSize;

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
      Alert.alert('Cáº§n quyá»n truy cáº­p áº£nh', 'HÃ£y cho phÃ©p á»©ng dá»¥ng truy cáº­p thÆ° viá»‡n áº£nh Ä‘á»ƒ chá»n áº£nh.');
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
        Alert.alert('ÄÃ£ Ä‘á»§ áº£nh phá»¥', 'Má»—i bá»™ truyá»‡n chá»‰ Ä‘Æ°á»£c cÃ³ tá»‘i Ä‘a 4 áº£nh phá»¥.');
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
      'XÃ¡c nháº­n xÃ³a',
      `Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a bá»™ truyá»‡n "${series.name}"? HÃ nh Ä‘á»™ng nÃ y khÃ´ng thá»ƒ hoÃ n tÃ¡c.`,
      [
        { text: 'Huá»·', style: 'cancel' },
        {
          text: 'XÃ³a',
          style: 'destructive',
          onPress: () => {
            setSeriesList((prev) => prev.filter((s) => s.id !== id));
            addHistory('Deleted series', `XÃ³a bá»™ truyá»‡n "${series.name}"`, series);
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
    // Phá»¥c há»“i vá»‹ trÃ­ cuá»™n sau khi overlay chi tiáº¿t Ä‘Æ°á»£c thÃ¡o khá»i giao diá»‡n
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
      Alert.alert('Thiáº¿u thÃ´ng tin', 'Vui lÃ²ng nháº­p tÃªn truyá»‡n.');
      return;
    }
    if (isNaN(total) || total <= 0) {
      Alert.alert('Thiáº¿u thÃ´ng tin', 'Vui lÃ²ng nháº­p tá»•ng sá»‘ táº­p há»£p lá»‡.');
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
          addHistory('Edited series', `Chá»‰nh sá»­a bá»™ truyá»‡n "${name}"`, updated);
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
      addHistory('Created series', `Táº¡o bá»™ truyá»‡n "${name}"`, newSeries);
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

  // Má»Ÿ modal Ä‘iá»u chá»‰nh sá»‘ lÆ°á»£ng táº­p (thÆ°á»ng)
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

  // Má»Ÿ modal Ä‘iá»u chá»‰nh sá»‘ lÆ°á»£ng táº­p Ä‘áº·c biá»‡t
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

  // TiÃªu Ä‘á» modal: tÃªn bá»™ truyá»‡n + gáº¡ch ngang + "táº­p" + sá»‘ táº­p
  const getModalTitleText = () => {
    if (!selectedSeries) return '';
    let chapterIdentifier = '';
    if (quantityTargetType === 'regular' && quantityChapterNumber !== null) {
      chapterIdentifier = `táº­p ${quantityChapterNumber}`;
    } else if (quantityTargetType === 'special' && quantitySpecialId !== null) {
      const sp = (selectedSeries.specialChapters || []).find((c) => c.id === quantitySpecialId);
      chapterIdentifier = `táº­p ${sp?.name || ''}`;
    }
    return `${selectedSeries.name} - ${chapterIdentifier}`;
  };

  // XÃ¡c nháº­n thay Ä‘á»•i sá»‘ lÆ°á»£ng tá»« modal
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
      addHistory('Updated chapter quantity', `Äá»•i sá»‘ lÆ°á»£ng táº­p ${quantityChapterNumber} thÃ nh ${newCount}`, selectedSeries ?? undefined);
    } else if (quantityTargetType === 'special' && quantitySpecialId !== null) {
      const sp = (selectedSeries.specialChapters || []).find((c) => c.id === quantitySpecialId);
      const spName = sp?.name || 'táº­p Ä‘áº·c biá»‡t';
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
      addHistory('Updated special chapter quantity', `Äá»•i sá»‘ lÆ°á»£ng ${spName} thÃ nh ${newCount}`, selectedSeries ?? undefined);
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
    addHistory('Toggled chapter', `Äá»•i tráº¡ng thÃ¡i táº­p ${chapterNumber}`, selectedSeries ?? undefined);
  };

  // Nháº¥n giá»¯ Ä‘á»ƒ thÃªm báº£n trÃ¹ng (tÄƒng sá»‘ lÆ°á»£ng báº£n Ä‘Ã£ cÃ³)
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
    addHistory('Added duplicate chapter', `ThÃªm báº£n trÃ¹ng táº­p ${chapterNumber}`, selectedSeries ?? undefined);
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
    addHistory('Toggled special chapter', 'Äá»•i tráº¡ng thÃ¡i táº­p Ä‘áº·c biá»‡t', selectedSeries ?? undefined);
  };

  // Nháº¥n giá»¯ Ä‘á»ƒ thÃªm báº£n trÃ¹ng cho táº­p Ä‘áº·c biá»‡t
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
    addHistory('Added duplicate special chapter', 'ThÃªm báº£n trÃ¹ng táº­p Ä‘áº·c biá»‡t', selectedSeries ?? undefined);
  };

  const handleAddSpecialChapters = () => {
    if (!selectedId) return;
    const names = specialChapterNames
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) {
      Alert.alert('Thiáº¿u thÃ´ng tin', 'Vui lÃ²ng nháº­p Ã­t nháº¥t má»™t tÃªn táº­p Ä‘áº·c biá»‡t.');
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
    addHistory('Added special chapters', `ThÃªm ${names.length} táº­p Ä‘áº·c biá»‡t`, selectedSeries ?? undefined);
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
    addHistory('Deleted special chapter', 'XÃ³a táº­p Ä‘áº·c biá»‡t', selectedSeries ?? undefined);
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
          <Text style={styles.emptyTitle}>KhÃ´ng tÃ¬m tháº¥y káº¿t quáº£</Text>
          <Text style={styles.emptySubtitle}>
            KhÃ´ng cÃ³ bá»™ truyá»‡n hoáº·c táº­p nÃ o khá»›p vá»›i â€œ{searchQuery}â€
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
            <Text style={styles.searchSectionTitle}>Bá»™ truyá»‡n ({matchingSeries.length})</Text>
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
                    <Text style={styles.searchSeriesMeta}>{owned}/{total} táº­p</Text>
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
            <Text style={styles.searchSectionTitle}>Táº­p Ä‘áº·c biá»‡t ({matchingSpecialChapters.length})</Text>
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
            placeholder="TÃ¬m kiáº¿m tÃªn truyá»‡n, táº­p Ä‘áº·c biá»‡t..."
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
          <Text style={styles.emptyTitle}>ChÆ°a cÃ³ bá»™ truyá»‡n nÃ o</Text>
          <Text style={styles.emptySubtitle}>
            Nháº¥n â€œThÃªm má»›iâ€ Ä‘á»ƒ báº¯t Ä‘áº§u quáº£n lÃ½ truyá»‡n tranh
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
          <Text style={styles.headerTitle}>Quáº£n lÃ½ Truyá»‡n Tranh</Text>
        ) : (
          <Pressable
            style={styles.headerTitlePressable}
            onPress={() => {
              if (selectedSeries) {
                openEditSeriesModal(selectedSeries);
              }
            }}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {selectedSeries?.name ?? 'Chi tiáº¿t'}
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
            <Text style={styles.errorText}>Lá»—i lÆ°u!</Text>
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

      {/* Modal táº¡o bá»™ truyá»‡n */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <TouchableWithoutFeedback style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['bottom']} style={[styles.modalContent, styles.createModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingSeriesId ? 'Chá»‰nh sá»­a bá»™ truyá»‡n' : 'Táº¡o bá»™ truyá»‡n má»›i'}</Text>
              <Pressable onPress={() => { setShowCreateModal(false); resetCreateForm(); }}>
                <Ionicons name="close" size={26} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}>
              <Text style={styles.label}>TÃªn truyá»‡n</Text>
              <TextInput
                style={styles.input}
                placeholder="Nháº­p tÃªn truyá»‡n..."
                placeholderTextColor="#94a3b8"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Tá»•ng sá»‘ táº­p</Text>
              <TextInput
                style={styles.input}
                placeholder="Chá»‰ nháº­p sá»‘, vÃ­ dá»¥: 12"
                placeholderTextColor="#94a3b8"
                value={formTotal}
                onChangeText={(text) => setFormTotal(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />

              {attributeGroups.length > 0 && (
                <View style={styles.attributeGroupsSection}>
                  <Text style={[styles.label, { marginTop: 12 }]}>NhÃ³m Ä‘áº·c Ä‘iá»ƒm</Text>
                  {attributeGroups.map((group) => {
                    const isDropdownOpen = openGroupDropdownId === group.id;
                    const currentValue = formGroupValues[group.id] || '';

                    return (
                      <View key={group.id} style={styles.groupInputContainer}>
                        <Text style={styles.groupInputLabel}>{group.name}</Text>
                        <View style={styles.groupInputRow}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder={`Nháº­p ${group.name.toLowerCase()} (vd: ${group.tags[0] || 'má»›i'})...`}
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
                              <Text style={styles.groupDropdownButtonText}>Chá»n nhanh</Text>
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

              <Text style={styles.label}>Chá»n Tháº» (chá»n sáºµn hoáº·c thÃªm má»›i)</Text>
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
              <Text style={styles.label}>ThÃªm tag má»›i (cÃ¡ch nhau báº±ng dáº¥u pháº©y)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nháº­p tag má»›i..."
                placeholderTextColor="#94a3b8"
                value={formNewTags}
                onChangeText={setFormNewTags}
              />

              {previewChapters.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewTitle}>
                    Xem trÆ°á»›c {previewChapters.length} táº­p Â· Nháº¥n Ä‘á»ƒ Ä‘á»•i tráº¡ng thÃ¡i
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
                <Text style={styles.saveButtonText}>LÆ°u bá»™ truyá»‡n</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal lá»c */}
      <Modal visible={showFilterModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.fullscreenModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bá»™ lá»c</Text>
            <Pressable
              onPress={() => setShowFilterModal(false)}
              accessibilityLabel="ÄÃ³ng bá»™ lá»c"
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
                  CÃ²n thiáº¿u
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
                accessibilityLabel="Äáº·t láº¡i bá»™ lá»c"
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
                  // Collapsed state: Button [TÃªn nhÃ³m +]
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
                            <Text style={styles.filterGroupCollapseText}>Thu gá»n</Text>
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
                            <Text style={styles.filterGroupClearText}>XÃ³a</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.tagGrid}>
                        {group.tags.length === 0 && (
                          <Text style={styles.filterOptionText}>ChÆ°a cÃ³ tag trong nhÃ³m nÃ y</Text>
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
                  <Text style={styles.ungroupedTagsTitle}>Tháº» khÃ¡c</Text>
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
                    if (rows.length === 0) return <Text style={styles.emptySubtitle}>KhÃ´ng cÃ³ bá»™ truyá»‡n thiáº¿u theo bá»™ lá»c</Text>;
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
                    if (rows.length === 0) return <Text style={styles.emptySubtitle}>KhÃ´ng cÃ³ chÆ°Æ¡ng theo bá»™ lá»c</Text>;
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
                  <Text style={styles.modalTitle}>ThÃªm táº­p Ä‘áº·c biá»‡t</Text>
                  <Pressable onPress={() => { setShowSpecialChapterModal(false); setSpecialChapterNames(''); }}>
                    <Ionicons name="close" size={26} color="#64748b" />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }}>
                  <Text style={styles.label}>TÃªn táº­p</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder={'Má»—i dÃ²ng má»™t táº­p, vÃ­ dá»¥:\nNgoáº¡i truyá»‡n 1\nTá»« Ä‘iá»ƒn Pokemon\nDoremon movie'}
                    placeholderTextColor="#94a3b8"
                    value={specialChapterNames}
                    onChangeText={setSpecialChapterNames}
                    multiline
                    textAlignVertical="top"
                  />
                  <Pressable style={styles.saveButton} onPress={handleAddSpecialChapters}>
                    <Ionicons name="add-circle-outline" size={22} color="#fff" />
                    <Text style={styles.saveButtonText}>ThÃªm táº­p</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal áº£nh */}
      <Modal visible={showGalleryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>áº¢nh bá»™ truyá»‡n</Text>
              <Pressable onPress={() => setShowGalleryModal(false)}>
                <Ionicons name="close" size={26} color="#64748b" />
              </Pressable>
            </View>

            {selectedImageUri ? (
              <Image source={{ uri: selectedImageUri }} style={styles.largePreviewImage} />
            ) : (
              <View style={styles.emptyImagePreview}>
                <Ionicons name="image-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptySubtitle}>ChÆ°a cÃ³ áº£nh</Text>
              </View>
            )}

            <Text style={styles.label}>áº¢nh chÃ­nh (tá»‘i Ä‘a 1)</Text>
            <View style={styles.imageActionsRow}>
              <Pressable style={styles.imageActionButton} onPress={() => pickSeriesImage('cover')}>
                <Ionicons name="image-outline" size={18} color="#fff" />
                <Text style={styles.imageActionText}>{selectedSeries?.coverImageUri ? 'Thay áº£nh' : 'ThÃªm áº£nh'}</Text>
              </Pressable>
              {selectedSeries?.coverImageUri && (
                <Pressable style={styles.imageRemoveButton} onPress={() => removeSeriesImage('cover')}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.imageRemoveText}>XÃ³a</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.galleryTitleRow}>
              <Text style={styles.label}>áº¢nh phá»¥ ({selectedSeries?.galleryImageUris?.length || 0}/4)</Text>
              <Pressable
                style={[
                  styles.imageActionButton,
                  (selectedSeries?.galleryImageUris?.length || 0) >= 4 && styles.imageActionButtonDisabled,
                ]}
                disabled={(selectedSeries?.galleryImageUris?.length || 0) >= 4}
                onPress={() => pickSeriesImage('gallery')}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.imageActionText}>ThÃªm áº£nh phá»¥</Text>
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
            <Text style={styles.backupHint}>áº¢nh Ä‘Æ°á»£c lÆ°u cá»¥c bá»™ trÃªn thiáº¿t bá»‹ vÃ  khÃ´ng gá»­i lÃªn Google Sheets.</Text>
          </View>
        </View>
      </Modal>



      {/* Modal chá»‰nh tags cho táº­p */}
      <Modal visible={showEditChapterModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <TouchableWithoutFeedback style={{ flex: 1 }} onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chá»‰nh tags táº­p {editingChapter?.number}</Text>
                  <Pressable onPress={() => setShowEditChapterModal(false)}>
                    <Ionicons name="close" size={26} color="#64748b" />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }}>
                  <Text style={styles.label}>Tags (cÃ¡ch nhau báº±ng dáº¥u pháº©y)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="VÃ­ dá»¥: Fanmade, Translated..."
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
                      addHistory('Edited chapter tags', `Chá»‰nh tags táº­p ${editingChapter.number}`, selectedSeries ?? undefined);
                      setShowEditChapterModal(false);
                      setEditingChapter(null);
                      setEditingChapterTags('');
                    }}>
                    <Ionicons name="save-outline" size={22} color="#fff" />
                    <Text style={styles.saveButtonText}>LÆ°u tags</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Ä‘iá»u chá»‰nh sá»‘ lÆ°á»£ng táº­p */}
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
                  {/* DÃ²ng 1: TÃªn bá»™ truyá»‡n + gáº¡ch ngang + "táº­p" + sá»‘ táº­p */}
                  <View style={styles.quantityModalHeader}>
                    <Text style={styles.quantityModalTitle}>{getModalTitleText()}</Text>
                  </View>

                  {/* DÃ²ng 2: Ã” hiá»ƒn thá»‹ sá»‘ lÆ°á»£ng táº­p á»Ÿ giá»¯a, bÃªn trÃ¡i lÃ  dáº¥u trá»«, bÃªn pháº£i lÃ  dáº¥u cá»™ng (0-99) */}
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

                  {/* DÃ²ng 3: Há»§y vÃ  XÃ¡c nháº­n */}
                  <View style={styles.quantityActionRow}>
                    <Pressable style={styles.quantityCancelBtn} onPress={() => setShowQuantityModal(false)}>
                      <Text style={styles.quantityCancelBtnText}>Há»§y</Text>
                    </Pressable>
                    <Pressable style={styles.quantityConfirmBtn} onPress={handleConfirmQuantityModal}>
                      <Text style={styles.quantityConfirmBtnText}>XÃ¡c nháº­n</Text>
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
