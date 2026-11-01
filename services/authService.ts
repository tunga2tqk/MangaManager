import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/types/auth';

export const STORAGE_KEY_USER = '@manga_user_session';
export const STORAGE_KEY_WEB_CLIENT_ID = '@manga_google_web_client_id';
export const STORAGE_KEY_ANDROID_CLIENT_ID = '@manga_google_android_client_id';
export const DEFAULT_BACKUP_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzqr0ZNgFstU00LqAanL1KxdE5qoH0q9kmiABPnN7t46phLUCJfm6TVk-KEKWL7Eh1Wfw/exec';

export const DEFAULT_WEB_CLIENT_ID =
  '978670606921-n6857n4gpml3u39nt265uiiffdsif2kf.apps.googleusercontent.com';

export function configureGoogleSignin(webClientId?: string) {
  // Empty stub to maintain compatibility without native RNGoogleSignin module
}

export async function syncUserToGoogleSheets(userToSync: UserProfile, customEndpoint?: string): Promise<{ success: boolean; message: string }> {
  try {
    const endpointToUse = customEndpoint || DEFAULT_BACKUP_ENDPOINT;
    const response = await fetch(endpointToUse, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'user_login',
        type: 'user_login',
        user: {
          id: userToSync.id,
          email: userToSync.email,
          displayName: userToSync.displayName,
          photoURL: userToSync.photoURL,
          lastLogin: new Date().toISOString(),
          status: 'active',
        },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { success: true, message: 'Đồng bộ người dùng thành công!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi kết nối';
    return { success: false, message: `Đồng bộ thất bại: ${msg}` };
  }
}
