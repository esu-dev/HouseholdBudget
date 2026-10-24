import { useFont } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import {
  AnalysisPeriod,
  ChartGranularity,
  getAvailableGranularities,
  getDefaultGranularity,
  TimeScale,
  useTransactionAnalysis,
} from '../hooks/useTransactionAnalysis';
import { Transaction } from '../types/transaction';

interface DailyTrendBarChartProps {
  transactions: Transaction[];
  period?: AnalysisPeriod;
  granularity?: ChartGranularity;
  onGranularityChange?: (granularity: ChartGranularity) => void;
  availableGranularities?: ChartGranularity[];
  targetDate?: Date;
  /** 後方互換用プロパティ */
  timeScale?: TimeScale;
}

const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  day: '日',
  week: '週',
  month: '月',
  year: '年',
};

export const DailyTrendBarChart = ({
  transactions,
  period: propsPeriod,
  granularity: propsGranularity,
  onGranularityChange,
  availableGranularities: propsAvailableGranularities,
  targetDate,
  timeScale,
}: DailyTrendBarChartProps) => {
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  // 互換性考慮
  const period: AnalysisPeriod = propsPeriod || (timeScale === 'year' ? 'all' : timeScale === 'month' ? 'year' : 'month');
  const availableGranularities = propsAvailableGranularities || getAvailableGranularities(period);
  const granularity: ChartGranularity =
    propsGranularity && availableGranularities.includes(propsGranularity)
      ? propsGranularity
      : getDefaultGranularity(period);

  const { trendData } = useTransactionAnalysis(
    transactions,
    undefined,
    targetDate || new Date(),
    period,
    granularity
  );

  // Roboto フォントを読み込む
  const font = useFont(require('../assets/fonts/Roboto.ttf'), 12);

  const title = useMemo(() => {
    switch (granularity) {
      case 'day':
        return '日別収支推移';
      case 'week':
        return '週別収支推移';
      case 'month':
        return '月別収支推移';
      case 'year':
        return '年別収支推移';
      default:
        return '収支推移';
    }
  }, [granularity]);

  const xLabelMode = useMemo(() => {
    switch (granularity) {
      case 'day':
        return '日';
      case 'week':
        return '週';
      case 'month':
        return '月';
      case 'year':
        return '年';
      default:
        return '日付';
    }
  }, [granularity]);

  return (
    <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-lg font-bold text-slate-900 dark:text-white">{title}</Text>
          <Text className="text-xs text-slate-400 font-medium">収支の推移・傾向</Text>
        </View>

        {/* グラフ目盛り切り替えボタン */}
        {availableGranularities.length > 1 && (
          <View className="flex-row bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
            {availableGranularities.map(g => {
              const isSelected = granularity === g;
              return (
                <TouchableOpacity
                  key={g}
                  onPress={() => onGranularityChange?.(g)}
                  className={`px-3 py-1 rounded-lg ${
                    isSelected ? 'bg-indigo-600 shadow-sm' : ''
                  }`}
                  hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {GRANULARITY_LABELS[g]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {trendData.length === 0 ? (
        <View className="py-12 items-center justify-center">
          <Text className="text-slate-400">データがありません。</Text>
        </View>
      ) : (
        <>
          <View style={{ height: 250, width: '100%' }}>
            <CartesianChart
              data={trendData}
              xKey="label"
              yKeys={['amount']}
              axisOptions={{
                font: font ?? undefined,
                tickCount: Math.min(trendData.length, 6),
                labelColor: '#94a3b8',
                lineColor: '#e2e8f0',
                formatXLabel: value => String(value),
                formatYLabel: value => {
                  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value.toString();
                },
              }}
            >
              {({ points }) => (
                <Line
                  points={points.amount}
                  color="#6366f1"
                  strokeWidth={3}
                  animate={{ type: 'timing', duration: 500 }}
                />
              )}
            </CartesianChart>
          </View>

          <View className="flex-row justify-between items-center mt-2">
            <Text className="text-[10px] text-slate-400">横軸: {xLabelMode}</Text>
            <Text className="text-[10px] text-slate-400 text-right">縦軸: 金額(¥)</Text>
          </View>
        </>
      )}
    </View>
  );
};
