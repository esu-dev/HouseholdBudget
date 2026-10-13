import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { Pie, PolarChart } from 'victory-native';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { useTransactionAnalysis } from '../hooks/useTransactionAnalysis';
import { Transaction } from '../types/transaction';

interface IncomeDonutChartProps {
  transactions: Transaction[];
}

export const IncomeDonutChart = ({ transactions }: IncomeDonutChartProps) => {
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  const { incomeCategoryData } = useTransactionAnalysis(transactions);
  const { width } = useWindowDimensions();
  const chartWidth = width - 80;

  const totalIncome = incomeCategoryData.reduce((acc, item) => acc + item.value, 0);

  if (incomeCategoryData.length === 0) {
    return (
      <View className="p-8 items-center justify-center bg-white dark:bg-slate-800 rounded-3xl mb-6 shadow-sm">
        <Text className="text-slate-400">収入データがありません。</Text>
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6">
      <Text className="text-lg font-bold text-slate-900 dark:text-white mb-4">カテゴリ別収入</Text>
      <View style={{ height: 250, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <PolarChart
          data={incomeCategoryData}
          colorKey="color"
          valueKey="value"
          labelKey="label"
          containerStyle={{ width: chartWidth, height: 250 }}
        >
          <Pie.Chart radius={80} innerRadius={50} startAngle={-90}>
            {({ slice }) => (
              <Pie.Slice
                {...slice}
                animate={{ type: "timing", duration: 500 }}
              />
            )}
          </Pie.Chart>
        </PolarChart>
      </View>
      <View className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-4">
        {incomeCategoryData.map((item, index) => {
          const percentage = totalIncome > 0 ? ((item.value / totalIncome) * 100).toFixed(1) : '0.0';
          return (
            <View key={index} className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center flex-1">
                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <Text className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-sm font-bold text-slate-900 dark:text-white mr-3">
                  ¥{item.value.toLocaleString()}
                </Text>
                <View className="w-12 items-end">
                  <Text className="text-xs text-slate-400 dark:text-slate-500">{percentage}%</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};
