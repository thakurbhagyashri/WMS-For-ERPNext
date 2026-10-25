import '@/utils/i18n';
import { initStorageCache } from '@/utils/storage';
import { Stack } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View, StatusBar as RNStatusBar } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { ToastProvider } from '@/hooks/use-toast';
import * as SplashScreen from 'expo-splash-screen';

import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import { CompanyProvider } from '@/context/CompanyContext';
import { WarehouseProvider } from '@/context/WarehouseContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [splashAnimationFinished, setSplashAnimationFinished] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await initStorageCache([
          'dynamic_base_url',
          'dynamic_api_key',
          'dynamic_api_secret',
          'frappe_user_email',
          'dynamic_company',
          'user_info',
          'user_role',
          'user_permissions'
        ]);
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }
    prepare();
  }, []);

  return (
    <ToastProvider>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{
          __html: `
          * {
            font-family: ui-sans-serif, system-ui, sans-serif !important;
          }
        `}} />
      )}
      <View style={{ flex: 1 }}>
        {isReady && (
          <CompanyProvider>
            <WarehouseProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="notifications" options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
              </Stack>
            </WarehouseProvider>
          </CompanyProvider>
        )}

        {!splashAnimationFinished && (
          <AnimatedSplashScreen onAnimationComplete={() => setSplashAnimationFinished(true)} />
        )}
      </View>
      <ExpoStatusBar style="light" />
      <RNStatusBar barStyle="light-content" translucent backgroundColor="transparent" />
    </ToastProvider>
  );
}
