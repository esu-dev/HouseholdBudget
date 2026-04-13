import { useFont } from '@shopify/react-native-skia';
import React from 'react';
import { Text, View } from 'react-native';
import { Bar, CartesianChart } from 'victory-native';
import { useTransactionAnalysis } from '../hooks/useTransactionAnalysis';
import { Transaction } from '../types/transaction';

interface DailyTrendBarChartProps {
  transactions: Transaction[];
}

export const DailyTrendBarChart = ({ transactions }: DailyTrendBarChartProps) => {
  const { dailyTrendData } = useTransactionAnalysis(transactions);
  
  // Roboto フォントを読み込む
  const font = useFont(require('../assets/fonts/Roboto.ttf'), 10);

  if (dailyTrendData.length === 0) {
    return (
      <View className="p-8 items-center justify-center bg-white dark:bg-slate-800 rounded-3xl mb-6 shadow-sm">
        <Text className="text-slate-400">データがありません。</Text>
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6">
      <Text className="text-lg font-bold text-slate-900 dark:text-white mb-4">日別収支推移</Text>
      <View style={{ height: 250, width: '100%' }}>
        <CartesianChart
          data={dailyTrendData}
          xKey="date"
          yKeys={["amount"]}
          axisOptions={{
            font: font ?? undefined,
            tickCount: 5,
            labelColor: "#94a3b8",
            lineColor: "#e2e8f0",
            formatXLabel: (value) => {
              const label = String(value);
              return label?.split?.('-')[2] ?? '';
            },
            formatYLabel: (value) => {
              if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
              return value.toString();
            }
          }}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.amount}
              chartBounds={chartBounds}
              color="#6366f1"
              roundedCorners={{ topLeft: 4, topRight: 4 }}
              animate={{ type: "timing", duration: 500 }}
            />
          )}
        </CartesianChart>
      </View>
      <View className="flex-row justify-between items-center mt-4">
        <Text className="text-[10px] text-slate-400">横軸: 日</Text>
        <Text className="text-[10px] text-slate-400 text-right">縦軸: 金額(¥)</Text>
      </View>
    </View>
  );
};
