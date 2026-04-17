import { useFont } from '@shopify/react-native-skia';
import React from 'react';
import { Text, View } from 'react-native';
import { Area, CartesianChart, Line } from 'victory-native';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { TimeScale, useTransactionAnalysis } from '../hooks/useTransactionAnalysis';
import { Transaction } from '../types/transaction';

interface NetWorthTrendChartProps {
  transactions: Transaction[];
  allTransactions: Transaction[];
  targetDate: Date;
  timeScale: TimeScale;
}

export const NetWorthTrendChart = ({ transactions, allTransactions, targetDate, timeScale }: NetWorthTrendChartProps) => {
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  const { netWorthTrendData } = useTransactionAnalysis(transactions, allTransactions, targetDate, timeScale);

  // 追加された Roboto フォントを読み込む
  const font = useFont(require('../assets/fonts/Roboto.ttf'), 12);

  if (netWorthTrendData.length === 0) {
    return (
      <View className="p-8 items-center justify-center bg-white dark:bg-slate-800 rounded-3xl mb-6 shadow-sm">
        <Text className="text-slate-400">データが不足しています。</Text>
      </View>
    );
  }

  // データの統計情報を計算（ラベルが表示されない時の補助用）
  const stats = React.useMemo(() => {
    const amounts = netWorthTrendData.map(d => d.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const start = amounts[0];
    const end = amounts[amounts.length - 1];

    const startDateRaw = netWorthTrendData[0].date;
    const endDateRaw = netWorthTrendData[netWorthTrendData.length - 1].date;

    // 期間の表示フォーマット
    let periodLabel = "";
    if (timeScale === "day") {
      periodLabel = `${startDateRaw.replace(/-/g, '/')} 〜 ${endDateRaw.split('-').pop()}日`;
    } else if (timeScale === "month") {
      periodLabel = `${startDateRaw.replace(/-/g, '/')}月 〜 ${endDateRaw.split('-').pop()}月`;
    } else {
      periodLabel = `${startDateRaw}年 〜 ${endDateRaw}年`;
    }

    return { min, max, start, end, periodLabel };
  }, [netWorthTrendData, timeScale]);

  const formatXLabel = (value: any) => {
    const label = String(value);
    if (!label || label === "undefined") return '';

    if (timeScale === 'day') {
      const parts = label.split('-');
      return parts.length > 2 ? `${parts[2]}` : label;
    } else if (timeScale === 'month') {
      const parts = label.split('-');
      return parts.length > 1 ? `${parseInt(parts[1])}` : label;
    } else {
      return `${label}`;
    }
  };

  const formatAmount = (val: number) => `¥${val.toLocaleString()}`;

  return (
    <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6 border-l-4 border-emerald-500">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-lg font-bold text-slate-900 dark:text-white">純資産推移</Text>
          <Text className="text-xs text-slate-400 font-medium">通算資産額の推移</Text>
        </View>
        <View className="bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full">
          <Text className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
            {timeScale === 'day' ? '日次推移' : timeScale === 'month' ? '月次推移' : '年次推移'}
          </Text>
        </View>
      </View>

      <View style={{ height: 250, width: '100%' }}>
        <CartesianChart
          data={netWorthTrendData}
          xKey="date"
          yKeys={["amount"]}
          domainPadding={{ right: 15 }}
          axisOptions={{
            font: font ?? undefined,
            tickCount: timeScale === 'day' ? 8 : timeScale === 'month' ? 12 : Math.min(netWorthTrendData.length, 5),
            labelColor: "#94a3b8",
            lineColor: "#e2e8f0",
            labelOffset: 8,
            formatXLabel: formatXLabel,
            formatYLabel: (value) => {
              if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
              if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return `¥${value}`;
            }
          }}
        >
          {({ points, chartBounds }) => (
            <>
              <Area
                points={points.amount}
                y0={chartBounds.bottom}
                color="#10b98120"
                animate={{ type: "timing", duration: 700 }}
              />
              <Line
                points={points.amount}
                color="#10b981"
                strokeWidth={3}
                animate={{ type: "timing", duration: 700 }}
              />
            </>
          )}
        </CartesianChart>
      </View>

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
