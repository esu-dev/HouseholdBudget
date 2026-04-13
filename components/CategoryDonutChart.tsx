import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { PolarChart, Pie } from 'victory-native';
import { useTransactionAnalysis } from '../hooks/useTransactionAnalysis';
import { Transaction } from '../types/transaction';

interface CategoryDonutChartProps {
  transactions: Transaction[];
}

export const CategoryDonutChart = ({ transactions }: CategoryDonutChartProps) => {
  const { categoryData } = useTransactionAnalysis(transactions);
  const { width } = useWindowDimensions();
  const chartWidth = width - 80;

  if (categoryData.length === 0) {
    return (
      <View className="p-8 items-center justify-center bg-white dark:bg-slate-800 rounded-3xl mb-6 shadow-sm">
        <Text className="text-slate-400">支出データがありません。</Text>
      </View>
    );
  }

  return (
    <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6">
      <Text className="text-lg font-bold text-slate-900 dark:text-white mb-4">カテゴリ別支出</Text>
      <View style={{ height: 250, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <PolarChart
          data={categoryData}
          colorKey="color"
          valueKey="value"
          labelKey="label"
          containerStyle={{ width: chartWidth, height: 250 }}
        >
          <Pie.Chart radius={80} innerRadius={50}>
            {({ slice }) => (
              <Pie.Slice
                {...slice}
                animate={{ type: "timing", duration: 500 }}
              />
            )}
          </Pie.Chart>
        </PolarChart>
      </View>
      <View className="flex-row flex-wrap justify-center mt-4">
        {categoryData.slice(0, 4).map((item, index) => (
          <View key={index} className="flex-row items-center mr-4 mb-2">
            <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <Text className="ml-2 text-xs text-slate-600 dark:text-slate-400">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
