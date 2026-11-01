import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

interface UseAutoSaveOptions {
  delay?: number; // Debounce delay in ms
  enabled?: boolean; // Chỉ tự động lưu khi dữ liệu đã sẵn sàng
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useAutoSave<T>(
  data: T,
  filePath: string,
  options: UseAutoSaveOptions = {},
) {
  const { delay = 1000, enabled = true, onError, onSuccess } = options;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Không lưu khi dữ liệu chưa sẵn sàng (tránh ghi đè dữ liệu mẫu bằng mảng rỗng)
    if (!enabled) {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for saving
    timeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        const jsonData = JSON.stringify(data);
        await FileSystem.writeAsStringAsync(filePath, jsonData);
        setLastSavedTime(Date.now());
        onSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save data:', err);
        onError?.(err);
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, filePath, delay, enabled, onError, onSuccess]);

  return { isSaving, lastSavedTime };
}

export async function loadDataFromFile<T>(filePath: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      const text = await FileSystem.readAsStringAsync(filePath);
      return JSON.parse(text || '{}') as T;
    }
    return null;
  } catch (error) {
    console.error('Failed to load data from file:', error);
    return null;
  }
}
