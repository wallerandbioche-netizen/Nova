import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenStore } from './client';

/**
 * Token storage.
 *
 * Tokens live in the device keychain / keystore through expo-secure-store. On web, where
 * SecureStore is unavailable, they fall back to AsyncStorage — which is why the web build is
 * meant for development and demos, not for production use with real accounts.
 */
const ACCESS_KEY = 'nova.accessToken';
const REFRESH_KEY = 'nova.refreshToken';

const isSecureAvailable = Platform.OS !== 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isSecureAvailable) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isSecureAvailable) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

async function removeItem(key: string): Promise<void> {
  if (isSecureAvailable) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export const secureTokenStore: TokenStore = {
  getAccessToken: () => getItem(ACCESS_KEY),
  getRefreshToken: () => getItem(REFRESH_KEY),
  async setTokens({ accessToken, refreshToken }) {
    await Promise.all([setItem(ACCESS_KEY, accessToken), setItem(REFRESH_KEY, refreshToken)]);
  },
  async clear() {
    await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
  },
};
