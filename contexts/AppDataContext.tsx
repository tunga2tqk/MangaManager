import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useAuth } from '@/contexts/AuthContext';
import { useMangaData, type ChangeHistoryEntry } from '@/hooks/useMangaData';
import { loadDataFromFile } from '@/hooks/use-auto-save';
import { DEFAULT_BACKUP_ENDPOINT } from '@/services/authService';
import type { AttributeGroup, MangaSeries } from '@/types';

const BACKUP_SETTINGS_FILE =
  FileSystem.documentDirectory + 'mangamanager-backup-settings.json';
const SETTINGS_FILE = FileSystem.documentDirectory + 'mangamanager-settings.json';

interface AppDataContextValue {
  seriesList: MangaSeries[];
  setSeriesList: React.Dispatch<React.SetStateAction<MangaSeries[]>>;
  changeHistory: ChangeHistoryEntry[];
  setChangeHistory: React.Dispatch<React.SetStateAction<ChangeHistoryEntry[]>>;
  attributeGroups: AttributeGroup[];
  setAttributeGroups: React.Dispatch<React.SetStateAction<AttributeGroup[]>>;
  dataLoaded: boolean;
  saveError: string | null;
  addHistory: (action: string, details?: string, series?: MangaSeries) => void;
  resetToSeed: () => void;
  sizeMultiplier: number;
  handleSizeChange: (value: number) => void;
  backupEndpoint: string;
  setBackupEndpoint: React.Dispatch<React.SetStateAction<string>>;
  lastBackupDate: string | null;
  backupStatus: string | null;
  restoreStatus: string | null;
  restoreLoading: boolean;
  saveBackupSettings: (endpoint: string, date: string | null) => Promise<void>;
  backupToGoogleSheets: (automatic?: boolean) => Promise<void>;
  restoreFromGoogleSheets: () => Promise<void>;
  shareExportFile: (format: 'json' | 'csv') => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const {
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
  } = useMangaData();

  const { user, syncUserToGoogleSheets } = useAuth();

  const [sizeMultiplier, setSizeMultiplier] = useState(5);
  const [backupEndpoint, setBackupEndpoint] = useState(DEFAULT_BACKUP_ENDPOINT);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const backupSettings = await loadDataFromFile<{
          endpoint?: string;
          lastBackupDate?: string;
        }>(BACKUP_SETTINGS_FILE);
        setBackupEndpoint(backupSettings?.endpoint ?? DEFAULT_BACKUP_ENDPOINT);
        setLastBackupDate(backupSettings?.lastBackupDate ?? null);

        const appSettings = await loadDataFromFile<{ sizeMultiplier?: number }>(
          SETTINGS_FILE,
        );
        setSizeMultiplier(appSettings?.sizeMultiplier ?? 5);
      } catch (e) {
        console.log('Failed to load settings', e);
      }
    })();
  }, []);

  const saveBackupSettings = async (endpoint: string, date: string | null) => {
    await FileSystem.writeAsStringAsync(
      BACKUP_SETTINGS_FILE,
      JSON.stringify({ endpoint: endpoint.trim(), lastBackupDate: date }),
    );
  };

  const saveSizeSettings = async (multiplier: number) => {
    await FileSystem.writeAsStringAsync(
      SETTINGS_FILE,
      JSON.stringify({ sizeMultiplier: multiplier }),
    );
  };

  const handleSizeChange = (value: number) => {
    const clamped = Math.min(10, Math.max(1, value));
    setSizeMultiplier(clamped);
    saveSizeSettings(clamped);
  };

  const seriesWithoutImages = (series: MangaSeries) => {
    const { coverImageUri, galleryImageUris, ...withoutImages } = series;
    return withoutImages;
  };

  const createCsv = () => {
    const escape = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const rows: Array<Array<string | number>> = [
      ['Bộ truyện', 'Loại', 'Tập', 'Trạng thái', 'Tags'],
    ];
    seriesList.forEach((series) => {
      series.chapters.forEach((chapter) =>
        rows.push([
          series.name,
          'Tập thường',
          chapter.number,
          chapter.status === 'owned' ? 'Đã có' : 'Chưa có',
          (chapter.tags || []).join(', '),
        ]),
      );
      (series.specialChapters || []).forEach((chapter) =>
        rows.push([
          series.name,
          'Tập đặc biệt',
          chapter.name,
          chapter.status === 'owned' ? 'Đã có' : 'Chưa có',
          (chapter.tags || []).join(', '),
        ]),
      );
    });
    return rows.map((row) => row.map(escape).join(',')).join('\n');
  };

  const shareExportFile = async (format: 'json' | 'csv') => {
    try {
      const filePath = `${FileSystem.cacheDirectory}mangamanager-export.${format}`;
      const content =
        format === 'json'
          ? JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                seriesList,
                history: changeHistory,
                attributeGroups,
              },
              null,
              2,
            )
          : createCsv();
      await FileSystem.writeAsStringAsync(filePath, content);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Không thể chia sẻ', 'Thiết bị này không hỗ trợ chia sẻ file.');
        return;
      }
      await Sharing.shareAsync(filePath, {
        mimeType: format === 'json' ? 'application/json' : 'text/csv',
        dialogTitle: 'Chia sẻ dữ liệu MangaManager',
      });
    } catch (error) {
      Alert.alert(
        'Lỗi xuất file',
        error instanceof Error ? error.message : 'Không thể tạo file.',
      );
    }
  };

  const backupToGoogleSheets = async (automatic = false) => {
    const endpoint = backupEndpoint.trim();
    if (!endpoint) {
      if (!automatic) {
        Alert.alert('Thiếu URL', 'Vui lòng nhập URL Google Apps Script.');
      }
      return;
    }
    try {
      setBackupStatus('Đang sao lưu...');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportedAt: new Date().toISOString(),
          seriesList: seriesList.map(seriesWithoutImages),
          history: changeHistory,
          attributeGroups,
          user: user
            ? {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
              }
            : null,
        }),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            'HTTP 401/403 - Google Apps Script yêu cầu đăng nhập. Hãy triển khai Web App với quyền "Anyone" (Bất kỳ ai).',
          );
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const date = new Date().toISOString().slice(0, 10);
      setLastBackupDate(date);
      await saveBackupSettings(endpoint, date);
      setBackupStatus('Đã sao lưu Google Sheets');

      if (user) {
        syncUserToGoogleSheets(user, endpoint);
      }
    } catch (error) {
      setBackupStatus('Sao lưu thất bại');
      if (!automatic) {
        Alert.alert(
          'Lỗi sao lưu',
          error instanceof Error ? error.message : 'Không thể kết nối Google Sheets.',
        );
      }
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (dataLoaded && backupEndpoint && lastBackupDate !== today) {
      backupToGoogleSheets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded, backupEndpoint, lastBackupDate]);

  const restoreFromGoogleSheets = async () => {
    const endpoint = backupEndpoint.trim();
    if (!endpoint) {
      setRestoreStatus('Vui lòng nhập URL Google Apps Script.');
      return;
    }
    setRestoreLoading(true);
    setRestoreStatus('Đang đọc dữ liệu đã sao lưu...');
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            'HTTP 401/403 - Google Apps Script yêu cầu đăng nhập. Hãy triển khai Web App với quyền "Anyone" (Bất kỳ ai).',
          );
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      // Nếu phản hồi là HTML (bắt đầu bằng <) thay vì JSON, nghĩa là Apps Script trả về trang đăng nhập
      if (text.trim().startsWith('<')) {
        throw new Error(
          'Phản hồi không phải JSON (trang HTML). Google Apps Script chưa được triển khai đúng hoặc yêu cầu đăng nhập. Hãy triển khai Web App với quyền "Anyone" và dùng đúng URL /exec.',
        );
      }
      const data = JSON.parse(text);
      // Hỗ trợ nhiều định dạng trả về từ Google Apps Script
      const payload = data?.data ?? data?.payload ?? data;
      const restoredSeries: MangaSeries[] = payload?.seriesList ?? [];
      const restoredHistory = payload?.history ?? [];
      const restoredGroups: AttributeGroup[] = payload?.attributeGroups ?? [];

      if (!Array.isArray(restoredSeries) || restoredSeries.length === 0) {
        setRestoreStatus('Không tìm thấy bản ghi nào trong backup.');
        return;
      }

      Alert.alert(
        'Xác nhận khôi phục',
        `Tìm thấy ${restoredSeries.length} bộ truyện trong backup. Bạn có muốn thay thế toàn bộ dữ liệu hiện tại không?`,
        [
          { text: 'Hủy', style: 'cancel', onPress: () => setRestoreStatus('Đã hủy khôi phục.') },
          {
            text: 'Khôi phục',
            style: 'destructive',
            onPress: () => {
              setSeriesList(restoredSeries);
              setChangeHistory(Array.isArray(restoredHistory) ? restoredHistory : []);
              if (Array.isArray(restoredGroups) && restoredGroups.length > 0) {
                setAttributeGroups(restoredGroups);
              }
              addHistory('Restored from backup', `Khôi phục ${restoredSeries.length} bộ truyện từ Google Sheets`);
              setRestoreStatus(`Đã khôi phục ${restoredSeries.length} bộ truyện từ backup.`);
            },
          },
        ],
      );
    } catch (error) {
      setRestoreStatus('Đọc backup thất bại');
      Alert.alert(
        'Lỗi đọc backup',
        error instanceof Error ? error.message : 'Không thể kết nối Google Sheets.',
      );
    } finally {
      setRestoreLoading(false);
    }
  };

  const value: AppDataContextValue = {
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
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used within AppDataProvider');
  return context;
}



