import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import 'react-native-reanimated';
import "../global.css";

import { useEffect } from 'react';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { initDatabase } from '../services/database';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useAppColorScheme();
  const { setColorScheme } = useNativewindColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    setColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    initDatabase().catch(err => {
      console.error('Database initialization failed:', err);
    });
  }, []);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
