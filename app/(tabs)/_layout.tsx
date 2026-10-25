import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Barcode,
  Box,
  FileText,
  LayoutGrid,
  Settings
} from 'lucide-react-native';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }: any) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const activeRouteName = state.routes[state.index]?.name;
  const isDashboard = activeRouteName === 'index';

  const content = (
    <>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;

        const onPress = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let Icon: any = LayoutGrid;
        let label = 'DASHBOARD';


        if (route.name === 'index') {
          Icon = LayoutGrid;
          label = t('dashboard', 'DASHBOARD').toUpperCase();
        } else if (route.name === 'inventory') {
          Icon = Box;
          label = t('inventory', 'INVENTORY').toUpperCase();
        } else if (route.name === 'scan') {
          Icon = Barcode;
          label = t('scan', 'SCAN').toUpperCase();
        } else if (route.name === 'adjustment') {
          Icon = FileText;
          label = t('adjustment', 'ADJUSTMENT').toUpperCase();
        } else if (route.name === 'settings') {
          Icon = Settings;
          label = t('settings', 'SETTINGS').toUpperCase();
        }
        if (route.name !== 'index' && route.name !== 'inventory' && route.name !== 'scan' && route.name !== 'adjustment' && route.name !== 'settings') return null;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={[
              styles.tabItem,
              isFocused && styles.tabItemFocused
            ]}
          >
            <View style={styles.tabIconWrapper}>
              <Icon
                size={18}
                color={isFocused ? '#fff' : '#94a3b8'}
              />
              {isFocused && (
                <Text style={styles.tabText}>
                  {label}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* <TouchableOpacity style={styles.tabItem}>
          <Columns2 size={18} color="#94a3b8" />
        </TouchableOpacity> */}
      {/* <TouchableOpacity style={styles.tabItem}>
          <Barcode size={18} color="#94a3b8" />
        </TouchableOpacity> */}
      {/* <TouchableOpacity style={styles.tabItem}>
          <FileText size={18} color="#94a3b8" />
        </TouchableOpacity> */}
    </>
  );

  return (
    <Animated.View entering={FadeInUp.delay(800).duration(1000)} style={[styles.floatingContainer, { bottom: Math.max(insets.bottom, 15) }]} pointerEvents="box-none">
      <LinearGradient
        colors={['#4c4a75', '#1e1b4b']}
        style={styles.tabBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="auto"
      >
        {content}
      </LinearGradient>
    </Animated.View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
        }}
      />
      <Tabs.Screen
        name='scan'
        options={{
          title: 'Scan'
        }}
      />
      <Tabs.Screen
        name='adjustment'
        options={{
          title: 'adjustment'
        }} />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 25,
    left: 15,
    right: 15,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 25,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e1b4b',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 15,
    elevation: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemFocused: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  tabIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
    fontFamily: Fonts.sans,
  },
});
