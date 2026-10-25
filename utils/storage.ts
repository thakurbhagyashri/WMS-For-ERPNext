import * as SecureStore from 'expo-secure-store';
import { Platform, DeviceEventEmitter } from 'react-native';

// In-memory cache
let cachedConfig: Record<string, string | null> = {};

export const storage = {
    getItem: async (
        key: string
    ): Promise<string | null> => {
        try {
            //  Check memory cache first
            if (cachedConfig[key] !== undefined) {
                return cachedConfig[key];
            }

            let value: string | null = null;

            if (Platform.OS === 'web') {
                value = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
            } else {
                value = await SecureStore.getItemAsync(key);
            }

            // Update cache
            cachedConfig[key] = value;

            return value;
        } catch (e) {
            console.error(
                `Error reading ${key} from storage`,
                e
            );
            return null;
        }
    },

    setItem: async (
        key: string,
        value: string
    ): Promise<void> => {
        try {
            // Update memory immediately
            cachedConfig[key] = value;

            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.setItem(key, value);
                    DeviceEventEmitter.emit('storage_changed', key);
                }
                return;
            }

            await SecureStore.setItemAsync(
                key,
                value
            );
            DeviceEventEmitter.emit('storage_changed', key);
        } catch (e) {
            console.error(
                `Error saving ${key} to storage`,
                e
            );
        }
    },

    removeItem: async (
        key: string
    ): Promise<void> => {
        try {
            // IMPORTANT FIX:
            // set null instead of delete
            // to prevent stale reads
            cachedConfig[key] = null;

            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.removeItem(key);
                }
                return;
            }

            await SecureStore.deleteItemAsync(
                key
            );
        } catch (e) {
            console.error(
                `Error removing ${key} from storage`,
                e
            );
        }
    },

    clear: async (): Promise<void> => {
        try {
            const keys = [
                'auth_token',
                'dynamic_base_url',
                'dynamic_api_key',
                'dynamic_api_secret',
                'dynamic_company',
                'frappe_user_email',
                'user_info',
                'user_role',
                'user_permissions',
                'user_available_sites',
            ];

            // Clear memory cache properly
            for (const key of keys) {
                cachedConfig[key] = null;
            }

            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.clear();
                    DeviceEventEmitter.emit('storage_cleared');
                }
                return;
            }

            await Promise.all(
                keys.map((key) =>
                    SecureStore.deleteItemAsync(key)
                )
            );
            DeviceEventEmitter.emit('storage_cleared');
        } catch (e) {
            console.error(
                'Error clearing storage',
                e
            );
        }
    },
};

export const initStorageCache =
    async (keys: string[]) => {
        for (const key of keys) {
            cachedConfig[key] =
                await storage.getItem(key);
        }
    };

// Safe getter
export const getCachedItem = (
    key: string
): string | null => {
    return cachedConfig[key] ?? null;
};

//  helper for debugging
export const clearCache = () => {
    cachedConfig = {};
};