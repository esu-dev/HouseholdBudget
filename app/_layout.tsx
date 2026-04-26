import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import 'react-native-reanimated';
import "../global.css";

import { useEffect } from 'react';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { initDatabase } from '../services/database';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

// ... (inside RootLayout)
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (url: string) => {
      // 共有されたCSVファイルなどのURIを検知
      if (url && (url.endsWith('.csv') || url.includes('.csv') || url.startsWith('content://') || url.startsWith('file://'))) {
        // しばらく待ってから遷移（初期化待ち）
        setTimeout(() => {
          router.push({
            pathname: '/import-shared',
            params: { uri: url }
          });
        }, 500);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useAppColorScheme();
  const { setColorScheme } = useNativewindColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    initDatabase().catch(err => {
      console.error('Database initialization failed:', err);
    });
  }, []);

  useEffect(() => {
    const handleUrl = (url: string) => {
      // 共有されたCSVファイルなどのURIを検知
      if (url && (url.endsWith('.csv') || url.includes('.csv') || url.startsWith('content://') || url.startsWith('file://'))) {
        // しばらく待ってから遷移（初期化待ち）
        setTimeout(() => {
          router.push({
            pathname: '/import-shared',
            params: { uri: url }
          });
        }, 500);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="import-shared" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
