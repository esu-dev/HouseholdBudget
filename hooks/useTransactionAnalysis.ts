import { useMemo } from 'react';
import { useTransactionStore } from '../store/useTransactionStore';
import { Transaction } from '../types/transaction';

export type CategoryChartData = {
  label: string;
  value: number;
  color: string;
};

export type DailyTrendData = {
  date: string;
  amount: number;
};

export type TimeScale = 'day' | 'month' | 'year';

export const useTransactionAnalysis = (
  transactions: Transaction[],
  allTransactions?: Transaction[],
  targetDate?: Date,
  timeScale: TimeScale = 'day'
) => {
  const { majorCategories } = useTransactionStore();

  // カテゴリ別の支出集計 (円グラフ用)
  // 大カテゴリ単位で集計することで、グラフの視認性を高める
  const categoryData = useMemo(() => {
    // 振替は集計から除外
    const expenses = transactions.filter(t => t.amount < 0 && t.category_id !== 'transfer');
    const majorTotals: Record<string, number> = {};

    expenses.forEach(t => {
      // transaction.category_id は小カテゴリのIDなので、親の大カテゴリを特定する
      const major = majorCategories.find(maj =>
        maj.subCategories.some(min => min.id === t.category_id)
      );

      const majorId = major?.id || 'others';
      majorTotals[majorId] = (majorTotals[majorId] || 0) + Math.abs(t.amount);
    });

    return Object.entries(majorTotals).map(([id, amount]) => {
      const major = majorCategories.find(c => c.id === id);
      return {
        label: major?.label || 'その他',
        value: amount,
        color: major?.color || '#94a3b8',
      };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, majorCategories]);

  // 期間別の収支推移 (棒グラフ用)
  const trendData = useMemo(() => {
    if (timeScale === 'day') {
      const daily: Record<string, number> = {};
      
      transactions.forEach(t => {
        if (t.category_id === 'transfer') return;
        const dateKey = t.date.split('T')[0];
        daily[dateKey] = (daily[dateKey] || 0) + t.amount;
      });

      return Object.entries(daily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({
          label: date.split('-')[2], // 日
          amount,
        }));
    } else if (timeScale === 'month') {
      const monthly: Record<string, number> = {};
      
      transactions.forEach(t => {
        if (t.category_id === 'transfer') return;
        const date = new Date(t.date);
        const monthKey = `${date.getMonth() + 1}`;
        monthly[monthKey] = (monthly[monthKey] || 0) + t.amount;
      });

      return Array.from({ length: 12 }, (_, i) => {
        const monthLabel = `${i + 1}`;
        return {
          label: monthLabel,
          amount: monthly[monthLabel] || 0,
        };
      });
    } else {
      const yearly: Record<string, number> = {};
      let minYear = new Date().getFullYear();
      let maxYear = minYear;

      transactions.forEach(t => {
        if (t.category_id === 'transfer') return;
        const year = new Date(t.date).getFullYear();
        yearly[year] = (yearly[year] || 0) + t.amount;
        if (year < minYear) minYear = year;
        if (year > maxYear) maxYear = year;
      });

      const results = [];
      for (let y = minYear; y <= maxYear; y++) {
        results.push({
          label: `${y}`,
          amount: yearly[y] || 0,
        });
      }
      return results;
    }
  }, [transactions, timeScale]);

  // 純資産推移 (エリア/折れ線グラフ用)
  const netWorthTrendData = useMemo(() => {
    if (!allTransactions || !targetDate) return [];

    if (timeScale === 'day') {
      const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      let runningTotal = 0;
      allTransactions.forEach(t => {
        if (new Date(t.date) < firstDayOfMonth) runningTotal += t.amount;
      });

      const dailyChanges: Record<string, number> = {};
      transactions.forEach(t => {
        const dateKey = t.date.split('T')[0];
        dailyChanges[dateKey] = (dailyChanges[dateKey] || 0) + t.amount;
      });

      const results: DailyTrendData[] = [];
      const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();

      for (let day = 1; day <= lastDayOfMonth; day++) {
        const date = new Date(targetDate.getFullYear(), targetDate.getMonth(), day);
        const dateKey = date.toISOString().split('T')[0];
        runningTotal += dailyChanges[dateKey] || 0;
        results.push({ date: dateKey, amount: runningTotal });
      }
      return results;

    } else if (timeScale === 'month') {
      const results: DailyTrendData[] = [];
      let runningTotal = 0;
      const targetYear = targetDate.getFullYear();

      allTransactions.forEach(t => {
        if (new Date(t.date).getFullYear() < targetYear) runningTotal += t.amount;
      });

      const monthlyChanges: number[] = new Array(12).fill(0);
      allTransactions.forEach(t => {
        const d = new Date(t.date);
        if (d.getFullYear() === targetYear) {
          monthlyChanges[d.getMonth()] += t.amount;
        }
      });

      for (let m = 0; m < 12; m++) {
        runningTotal += monthlyChanges[m];
        results.push({
          date: `${targetYear}-${String(m + 1).padStart(2, '0')}`,
          amount: runningTotal
        });
      }
      return results;

    } else {
      const yearlyChanges: Record<string, number> = {};
      let minYear = new Date().getFullYear();
      let maxYear = minYear;

      allTransactions.forEach(t => {
        const year = new Date(t.date).getFullYear();
        yearlyChanges[year] = (yearlyChanges[year] || 0) + t.amount;
        if (year < minYear) minYear = year;
        if (year > maxYear) maxYear = year;
      });

      const results: DailyTrendData[] = [];
      let runningTotal = 0;
      for (let y = minYear; y <= maxYear; y++) {
        runningTotal += yearlyChanges[y] || 0;
        results.push({ date: String(y), amount: runningTotal });
      }
      return results;
    }
  }, [allTransactions, transactions, targetDate, timeScale]);

  return { categoryData, trendData, netWorthTrendData };
};
