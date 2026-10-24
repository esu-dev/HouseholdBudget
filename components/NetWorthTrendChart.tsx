import { useFont } from '@shopify/react-native-skia';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Area, CartesianChart, Line, useChartPressState } from 'victory-native';
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

interface NetWorthTrendChartProps {
  transactions: Transaction[];
  allTransactions: Transaction[];
  targetDate: Date;
  period?: AnalysisPeriod;
  granularity?: ChartGranularity;
  onGranularityChange?: (granularity: ChartGranularity) => void;
  availableGranularities?: ChartGranularity[];
  /** 後方互換用プロパティ */
  timeScale?: TimeScale;
}

const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  day: '日',
  week: '週',
  month: '月',
  year: '年',
};

export const NetWorthTrendChart = ({
  transactions,
  allTransactions,
  targetDate,
  period: propsPeriod,
  granularity: propsGranularity,
  onGranularityChange,
  availableGranularities: propsAvailableGranularities,
  timeScale,
}: NetWorthTrendChartProps) => {
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  // 互換性考慮
  const period: AnalysisPeriod = propsPeriod || (timeScale === 'year' ? 'all' : timeScale === 'month' ? 'year' : 'month');
  const availableGranularities = propsAvailableGranularities || getAvailableGranularities(period);
  const granularity: ChartGranularity =
    propsGranularity && availableGranularities.includes(propsGranularity)
      ? propsGranularity
      : getDefaultGranularity(period);

  const { netWorthTrendData } = useTransactionAnalysis(
    transactions,
    allTransactions,
    targetDate,
    period,
    granularity
  );

  // 追加された Roboto フォントを読み込む
  const font = useFont(require('../assets/fonts/Roboto.ttf'), 12);
  const { state: chartPressState, isActive: isChartPressed } = useChartPressState({
    x: '',
    y: { amount: 0 },
  });

  // データの統計情報を計算
  const stats = React.useMemo(() => {
    if (netWorthTrendData.length === 0) {
      return { min: 0, max: 0, start: 0, end: 0, periodLabel: '' };
    }

    const amounts = netWorthTrendData.map(d => d.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const start = amounts[0];
    const end = amounts[amounts.length - 1];

    const startDateRaw = netWorthTrendData[0].date;
    const endDateRaw = netWorthTrendData[netWorthTrendData.length - 1].date;

    // 期間の表示フォーマット
    let periodLabel = '';
    if (granularity === 'day') {
      periodLabel = `${startDateRaw.replace(/-/g, '/')} 〜 ${endDateRaw.replace(/-/g, '/')}`;
    } else if (granularity === 'week') {
      periodLabel = `${startDateRaw} 〜 ${endDateRaw}`;
    } else if (granularity === 'month') {
      periodLabel = `${startDateRaw.replace(/-/g, '/')}月 〜 ${endDateRaw.replace(/-/g, '/')}月`;
    } else {
      periodLabel = `${startDateRaw}年 〜 ${endDateRaw}年`;
    }

    return { min, max, start, end, periodLabel };
  }, [netWorthTrendData, granularity]);

  if (netWorthTrendData.length === 0) {
    return (
      <View className="p-8 items-center justify-center bg-white dark:bg-slate-800 rounded-3xl mb-6 shadow-sm">
        <Text className="text-slate-400">データが不足しています。</Text>
      </View>
    );
  }

  const formatXLabel = (value: any) => {
    const label = String(value);
    if (!label || label === 'undefined') return '';

    if (granularity === 'day') {
      const parts = label.split('-');
      return parts.length > 2 ? `${parseInt(parts[2])}` : label;
    } else if (granularity === 'week') {
      return label;
    } else if (granularity === 'month') {
      const parts = label.split('-');
      return parts.length > 1 ? `${parseInt(parts[1])}月` : label;
    } else {
      return `${label}`;
    }
  };

  const formatAmount = (val: number) => `¥${val.toLocaleString()}`;
  const selectedPoint =
    isChartPressed && chartPressState.matchedIndex.value >= 0
      ? netWorthTrendData[chartPressState.matchedIndex.value]
      : null;

  const granularityBadgeText = {
    day: '日次推移',
    week: '週次推移',
    month: '月次推移',
    year: '年次推移',
  }[granularity];

  return (
    <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6 border-l-4 border-emerald-500">
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-bold text-slate-900 dark:text-white">資産成長トレンド</Text>
            <View className="bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full">
              <Text className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                {granularityBadgeText}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-slate-400 font-medium mt-0.5">通算資産額の推移</Text>
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
                    isSelected ? 'bg-emerald-600 shadow-sm' : ''
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

      <View style={{ height: 250, width: '100%' }}>
        <CartesianChart
          data={netWorthTrendData}
          xKey="date"
          yKeys={['amount']}
          chartPressState={chartPressState}
          domainPadding={{ right: 15 }}
          axisOptions={{
            font: font ?? undefined,
            tickCount: Math.min(netWorthTrendData.length, granularity === 'day' ? 7 : 6),
            labelColor: '#94a3b8',
            lineColor: '#e2e8f0',
            labelOffset: 8,
            formatXLabel: formatXLabel,
            formatYLabel: value => {
              if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
              if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return `¥${value}`;
            },
          }}
        >
          {({ points, chartBounds }) => (
            <>
              <Area
                points={points.amount}
                y0={chartBounds.bottom}
                color="#10b98120"
                animate={{ type: 'timing', duration: 700 }}
              />
              <Line
                points={points.amount}
                color="#10b981"
                strokeWidth={3}
                animate={{ type: 'timing', duration: 700 }}
              />
            </>
          )}
        </CartesianChart>
      </View>

      {selectedPoint && (
        <View className="mt-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
          <Text className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">選択した時点</Text>
          <View className="flex-row justify-between items-center mt-1">
            <Text className="text-xs text-slate-600 dark:text-slate-300">{selectedPoint.date}</Text>
            <Text className="text-base font-bold text-emerald-700 dark:text-emerald-300">
              {formatAmount(selectedPoint.amount)}
            </Text>
          </View>
        </View>
      )}

      <View className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl">
        <View className="mb-3 items-center">
          <Text className="text-[10px] text-slate-400 uppercase tracking-widest">分析期間</Text>
          <Text className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">{stats.periodLabel}</Text>
        </View>

        <View className="flex-row justify-between mb-2 pt-2 border-t border-slate-200 dark:border-slate-600">
          <View>
            <Text className="text-[10px] text-slate-400">期間開始</Text>
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatAmount(stats.start)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-[10px] text-slate-400">現在（末次）</Text>
            <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatAmount(stats.end)}</Text>
          </View>
        </View>

        <View className="flex-row justify-between pt-2 border-t border-slate-100 dark:border-slate-600/50">
          <View>
            <Text className="text-[10px] text-slate-400">期間内最小</Text>
            <Text className="text-xs font-medium text-slate-600 dark:text-slate-400">{formatAmount(stats.min)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-[10px] text-slate-400">期間内最大</Text>
            <Text className="text-xs font-medium text-slate-600 dark:text-slate-400">{formatAmount(stats.max)}</Text>
          </View>
        </View>
      </View>

      {!font && (
        <View className="mt-2 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
          <Text className="text-[10px] text-amber-600 dark:text-amber-400 text-center font-medium">
            ※フォント読み込み中のため、一時的に目盛りラベルが表示されない場合があります。
          </Text>
        </View>
      )}
    </View>
  );
};
