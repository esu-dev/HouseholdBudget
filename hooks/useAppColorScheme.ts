import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';

export function useAppColorScheme() {
  const systemColorScheme = useSystemColorScheme();
  const { themeMode } = useThemeStore();

  const isDark = themeMode === 'system'
    ? systemColorScheme === 'dark'
    : themeMode === 'dark';

  return isDark ? 'dark' : 'light';
}
