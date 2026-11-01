import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { INITIAL_ATTRIBUTE_GROUPS, INITIAL_SERIES } from '@/constants/seedData';
import { HEXMAN_9X_SPECIAL_CHAPTER_NAMES } from '@/data/hexman-9x';
import { loadDataFromFile, useAutoSave } from '@/hooks/use-auto-save';
import type { AttributeGroup, ChapterStatus, MangaSeries } from '@/types';

export interface ChangeHistoryEntry {
  timestamp: string;
  seriesId?: string;
  seriesName?: string;
  action: string;
  details?: string;
}

const DATA_FILE = FileSystem.documentDirectory + 'mangamanager-data.json';

// Tạo bộ truyện Hexman 9x với danh sách tập đặc biệt
function buildHexmanSeries(): MangaSeries {
  return {
    id: 'hexman-9x',
    name: 'Hexman 9x',
    totalChapters: 0,
    chapters: [],
    specialChapters: HEXMAN_9X_SPECIAL_CHAPTER_NAMES.map((name, index) => ({
      id: `hexman-9x-special-${index + 1}`,
      name,
      status: 'missing' as ChapterStatus,
      tags: [],
    })),
  };
}

/**
 * Custom hook quản lý toàn bộ dữ liệu truyện (seriesList, changeHistory, attributeGroups):
 * - Load dữ liệu từ file khi mount.
 * - Tự động lưu (debounce) mỗi khi dữ liệu thay đổi.
 */
export function useMangaData() {
  const [seriesList, setSeriesList] = useState<MangaSeries[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryEntry[]>([]);
  const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load dữ liệu đã lưu khi mount
  useEffect(() => {
    (async () => {
      try {
        const fileData = await loadDataFromFile<{
          seriesList?: MangaSeries[];
          history?: ChangeHistoryEntry[];
          attributeGroups?: AttributeGroup[];
        }>(DATA_FILE);

        if (fileData?.seriesList && Array.isArray(fileData.seriesList) && fileData.seriesList.length > 0) {
          setSeriesList(fileData.seriesList);
          setChangeHistory(fileData.history || []);
        } else {
          setSeriesList([buildHexmanSeries(), ...INITIAL_SERIES]);
          setChangeHistory([]);
        }

        if (fileData?.attributeGroups && Array.isArray(fileData.attributeGroups) && fileData.attributeGroups.length > 0) {
          setAttributeGroups(fileData.attributeGroups);
        } else {
          setAttributeGroups(INITIAL_ATTRIBUTE_GROUPS);
        }
      } catch (e) {
        console.log('Failed to load data', e);
      } finally {
        setDataLoaded(true);
      }
    })();
  }, []);

  // Tự động lưu (debounce 1 giây)
  useAutoSave(
    { seriesList, history: changeHistory, attributeGroups },
    DATA_FILE,
    {
      delay: 1000,
      enabled: dataLoaded,
      onError: (error) => {
        setSaveError(error.message);
        setTimeout(() => setSaveError(null), 3000);
      },
      onSuccess: () => {
        setSaveError(null);
      },
    },
  );

  const addHistory = useCallback((action: string, details?: string, series?: MangaSeries) => {
    const entry: ChangeHistoryEntry = {
      timestamp: new Date().toISOString(),
      seriesId: series?.id,
      seriesName: series?.name,
      action,
      details,
    };
    setChangeHistory((prev) => [entry, ...prev]);
  }, []);

  const resetToSeed = useCallback(() => {
    setSeriesList([buildHexmanSeries(), ...INITIAL_SERIES]);
    setChangeHistory([]);
    setAttributeGroups(INITIAL_ATTRIBUTE_GROUPS);
  }, []);

  return {
    seriesList,
    setSeriesList,
    changeHistory,
    setChangeHistory,
    attributeGroups,
    setAttributeGroups,
    dataLoaded,
    saveError,
    addHistory,
    resetToSeed,
  };
}
