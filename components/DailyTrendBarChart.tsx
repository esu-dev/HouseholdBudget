import { useFont } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { TimeScale, useTransactionAnalysis } from '../hooks/useTransactionAnalysis';
import { Transaction } from '../types/transaction';

interface DailyTrendBarChartProps {
  transactions: Transaction[];
  timeScale: TimeScale;
}

export const DailyTrendBarChart = ({ transactions, timeScale }: DailyTrendBarChartProps) => {
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  const { trendData } = useTransactionAnalysis(transactions, undefined, undefined, timeScale);

  // Roboto フォントを読み込む
  const font = useFont(require('../assets/fonts/Roboto.ttf'), 12);

  const title = useMemo(() => {
    if (timeScale === 'day') return '日別収支推移';
    if (timeScale === 'month') return '月別収支推移';
    return '年別収支推移';
  }, [timeScale]);

  const xLabelMode = useMemo(() => {
    if (timeScale === 'day') return '日';
    if (timeScale === 'month') return '月';
    return '年';
  }, [timeScale]);

  if (trendData.length === 0) {
    return (
      <View className="p-8 items-center justify-center bg-white dark:bg-slate-800 rounded-3xl mb-6 shadow-sm">
        <Text className="text-slate-400">データがありません。</Text>
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6">
      <Text className="text-lg font-bold text-slate-900 dark:text-white mb-4">{title}</Text>
      <View style={{ height: 250, width: '100%' }}>
        <CartesianChart
          data={trendData}
          xKey="label"
          yKeys={["amount"]}
          axisOptions={{
            font: font ?? undefined,
            tickCount: 5,
            labelColor: "#94a3b8",
            lineColor: "#e2e8f0",
            formatXLabel: (value) => {
              return String(value);
            },
            formatYLabel: (value) => {
              if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return value.toString();
            }
          }}
        >
          {({ points }) => (
            <Line
              points={points.amount}
              color="#6366f1"
              strokeWidth={3}
              animate={{ type: "timing", duration: 500 }}
            />
          )}
        </CartesianChart>
      </View>


      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-[10px] text-slate-400">横軸: {xLabelMode}</Text>
        <Text className="text-[10px] text-slate-400 text-right">縦軸: 金額(¥)</Text>
      </View>
    </View>
  );
};
