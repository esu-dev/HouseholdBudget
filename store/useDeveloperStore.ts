import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
}

interface DeveloperState {
  isDeveloperMode: boolean;
  logs: LogEntry[];
  setDeveloperMode: (enabled: boolean) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
}

export const useDeveloperStore = create<DeveloperState>()(
  persist(
    (set) => ({
      isDeveloperMode: false,
      logs: [],
      setDeveloperMode: (enabled) => set({ isDeveloperMode: enabled }),
      addLog: (level, message) => set((state) => ({
        logs: [
          {
            timestamp: new Date().toISOString(),
            level,
            message,
          },
          ...state.logs.slice(0, 499), // Keep last 500 logs
        ]
      })),
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: 'developer-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ isDeveloperMode: state.isDeveloperMode }), // Don't persist logs across restarts for memory
    }
  )
);
