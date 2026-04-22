import { Tabs } from 'expo-router';
import { BarChart2, Home, PlusCircle, Settings, Wallet } from 'lucide-react-native';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function TabLayout() {
  const colorScheme = useAppColorScheme();
  const setEditingTransaction = useTransactionStore((state) => state.setEditingTransaction);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: (props) => (
          <HapticTab
            {...props}
            // ここでタップ判定を上下左右に広げる（単位はポイント）
            hitSlop={{ top: 20, bottom: 0, left: 10, right: 10 }}
          />
        ),
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="balance"
        options={{
          title: '残高',
          tabBarIcon: ({ color }) => <Wallet size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="input"
        options={{
          title: '入力',
          tabBarIcon: ({ color }) => <PlusCircle size={24} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            // タブボタンから直接遷移した場合は、編集状態を解除して新規入力にする
            setEditingTransaction(null);
          },
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: '分析',
          tabBarIcon: ({ color }) => <BarChart2 size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
