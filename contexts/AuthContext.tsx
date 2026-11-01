import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { UserProfile, AuthContextType } from '@/types/auth';
import {
  STORAGE_KEY_USER,
  STORAGE_KEY_WEB_CLIENT_ID,
  STORAGE_KEY_ANDROID_CLIENT_ID,
  DEFAULT_WEB_CLIENT_ID,
  configureGoogleSignin,
  syncUserToGoogleSheets as syncUserApi,
} from '@/services/authService';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [webClientId, setWebClientId] = useState<string>(DEFAULT_WEB_CLIENT_ID);
  const [androidClientId, setAndroidClientId] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: androidClientId || webClientId,
    webClientId: webClientId,
    clientId: webClientId || androidClientId,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const storedWebId = await AsyncStorage.getItem(STORAGE_KEY_WEB_CLIENT_ID);
        const storedAndroidId = await AsyncStorage.getItem(STORAGE_KEY_ANDROID_CLIENT_ID);
        if (storedWebId) setWebClientId(storedWebId);
        if (storedAndroidId) setAndroidClientId(storedAndroidId);
        configureGoogleSignin(storedWebId || DEFAULT_WEB_CLIENT_ID);

        const storedUserJson = await AsyncStorage.getItem(STORAGE_KEY_USER);
        if (storedUserJson) {
          const parsedUser: UserProfile = JSON.parse(storedUserJson);
          setUser(parsedUser);
          try {
            syncUserToGoogleSheets(parsedUser);
          } catch {
            // retain cached user session
          }
        }
      } catch (e) {
        console.error('Init auth error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateClientIds = async (webId: string, androidId: string) => {
    setWebClientId(webId);
    setAndroidClientId(androidId);
    await AsyncStorage.setItem(STORAGE_KEY_WEB_CLIENT_ID, webId);
    await AsyncStorage.setItem(STORAGE_KEY_ANDROID_CLIENT_ID, androidId);
    configureGoogleSignin(webId);
  };

  const syncUserToGoogleSheets = async (userToSync: UserProfile, customEndpoint?: string) => {
    setSyncStatus('Đang đồng bộ người dùng với Google Sheet...');
    const result = await syncUserApi(userToSync, customEndpoint);
    setSyncStatus(result.message);
    return result.success;
  };

  const signInWithGoogle = async (): Promise<UserProfile | null> => {
    try {
      setLoading(true);
      
      const result = await promptAsync();
      
      if (result.type === 'success') {
        const { authentication } = result;
        const accessToken = authentication?.accessToken;
        
        if (accessToken) {
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          
          if (!userResponse.ok) {
            throw new Error(`Không thể lấy thông tin người dùng từ Google (HTTP ${userResponse.status})`);
          }
          
          const googleUser = await userResponse.json();
          
          if (googleUser && googleUser.email) {
            const profile: UserProfile = {
              id: googleUser.sub,
              email: googleUser.email,
              displayName: googleUser.name || googleUser.given_name || googleUser.email.split('@')[0],
              photoURL: googleUser.picture,
              idToken: authentication?.idToken || accessToken,
              lastLogin: new Date().toISOString(),
            };
            setUser(profile);
            await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
            await syncUserToGoogleSheets(profile);
            return profile;
          }
        }
      } else if (result.type === 'cancel') {
        console.log('User cancelled login');
      } else if (result.type === 'error') {
        Alert.alert('Lỗi đăng nhập Google', result.error?.description || 'Đã xảy ra lỗi khi đăng nhập.');
      }
      return null;
    } catch (error: any) {
      console.error('Lỗi đăng nhập:', error);
      Alert.alert('Lỗi đăng nhập', error?.message || 'Không thể đăng nhập bằng Google.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setUser(null);
      setSyncStatus(null);
      await AsyncStorage.removeItem(STORAGE_KEY_USER);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        webClientId,
        androidClientId,
        syncStatus,
        signInWithGoogle,
        signOut,
        updateClientIds,
        syncUserToGoogleSheets,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
