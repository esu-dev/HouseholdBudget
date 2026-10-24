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

export type AnalysisPeriod = 'month' | 'year' | 'all';
// 既存コードとの後方互換用
export type TimeScale = AnalysisPeriod | 'day';
export type ChartGranularity = 'day' | 'week' | 'month' | 'year';

// 期間に応じた利用可能な目盛り粒度を取得するユーティリティ
export const getAvailableGranularities = (period: AnalysisPeriod): ChartGranularity[] => {
  switch (period) {
    case 'month':
      return ['day', 'week'];
    case 'year':
      return ['day', 'week', 'month'];
    case 'all':
      return ['month', 'year'];
    default:
      return ['day', 'month'];
  }
};

export const getDefaultGranularity = (period: AnalysisPeriod): ChartGranularity => {
  switch (period) {
    case 'month':
      return 'day';
    case 'year':
      return 'month';
    case 'all':
      return 'year';
    default:
      return 'day';
  }
};

export const useTransactionAnalysis = (
  transactions: Transaction[],
  allTransactions?: Transaction[],
  targetDate: Date = new Date(),
  periodOrTimeScale: TimeScale = 'month',
  granularity?: ChartGranularity
) => {
  const { majorCategories } = useTransactionStore();

  // 互換性のため 'day' は 'month' (月間表示) として正規化
  const period: AnalysisPeriod = periodOrTimeScale === 'day' ? 'month' : periodOrTimeScale;
  const effectiveGranularity: ChartGranularity = granularity || getDefaultGranularity(period);

  // カテゴリ別の支出集計 (円グラフ用)
  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.amount < 0 && t.category_id !== 'transfer' && !t.exclude_from_balance);
    const majorTotals: Record<string, number> = {};

    expenses.forEach(t => {
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

  // カテゴリ別の収入集計 (円グラフ用)
  const incomeCategoryData = useMemo(() => {
    const incomes = transactions.filter(t => t.amount > 0 && t.category_id !== 'transfer' && !t.exclude_from_balance);
    const majorTotals: Record<string, number> = {};

    incomes.forEach(t => {
      const major = majorCategories.find(maj =>
        maj.subCategories.some(min => min.id === t.category_id)
      );

      const majorId = major?.id || 'others';
      majorTotals[majorId] = (majorTotals[majorId] || 0) + t.amount;
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

  // 収支推移 (グラフ用)
  const trendData = useMemo(() => {
    const activeTransactions = transactions.filter(
      t => t.category_id !== 'transfer' && !t.exclude_from_balance
    );

    if (effectiveGranularity === 'day') {
      if (period === 'month') {
        // 月の全日（1日〜末日）
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daily: Record<string, number> = {};

        activeTransactions.forEach(t => {
          const dateKey = t.date.split('T')[0];
          daily[dateKey] = (daily[dateKey] || 0) + t.amount;
        });

        const results = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = String(d).padStart(2, '0');
          const monthStr = String(month + 1).padStart(2, '0');
          const dateKey = `${year}-${monthStr}-${dayStr}`;
          results.push({
            label: `${d}`,
            amount: daily[dateKey] || 0,
          });
        }
        return results;
      } else {
        // 年または全期間の日別：取引があった日を中心に時系列順に並べる
        const daily: Record<string, number> = {};
        activeTransactions.forEach(t => {
          const dateKey = t.date.split('T')[0];
          daily[dateKey] = (daily[dateKey] || 0) + t.amount;
        });

        return Object.entries(daily)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, amount]) => {
            const parts = date.split('-');
            const label = period === 'year' ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : date;
            return { label, amount };
          });
      }
    } else if (effectiveGranularity === 'week') {
      if (period === 'month') {
        // 月内の週集計（第1週: 1〜7日, 第2週: 8〜14日, 第3週: 15〜21日, 第4週: 22〜28日, 第5週: 29日〜末日）
        const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
        const weekCount = daysInMonth > 28 ? 5 : 4;
        const weeklyAmounts = new Array(weekCount).fill(0);

        activeTransactions.forEach(t => {
          const day = new Date(t.date).getDate();
          const weekIdx = Math.min(Math.floor((day - 1) / 7), weekCount - 1);
          weeklyAmounts[weekIdx] += t.amount;
        });

        return weeklyAmounts.map((amount, idx) => ({
          label: `第${idx + 1}週`,
          amount,
        }));
      } else {
        // 年（または全期間）の週集計：ISOカレンダー週または週初め日付で集計
        const weekly: Record<string, number> = {};
        activeTransactions.forEach(t => {
          const d = new Date(t.date);
          // その週の月曜日の日付を取得
          const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1; // 月曜=0, 日曜=6
          const monday = new Date(d);
          monday.setDate(d.getDate() - dayOfWeek);
          const weekKey = `${monday.getMonth() + 1}/${monday.getDate()}~`;
          weekly[weekKey] = (weekly[weekKey] || 0) + t.amount;
        });

        return Object.entries(weekly)
          .sort(([a], [b]) => {
            // 月/日~ の比較
            const [am, ad] = a.replace('~', '').split('/').map(Number);
            const [bm, bd] = b.replace('~', '').split('/').map(Number);
            return am !== bm ? am - bm : ad - bd;
          })
          .map(([label, amount]) => ({ label, amount }));
      }
    } else if (effectiveGranularity === 'month') {
      if (period === 'year') {
        const targetYear = targetDate.getFullYear();
        const monthly = new Array(12).fill(0);

        activeTransactions.forEach(t => {
          const d = new Date(t.date);
          if (d.getFullYear() === targetYear) {
            monthly[d.getMonth()] += t.amount;
          }
        });

        return monthly.map((amount, i) => ({
          label: `${i + 1}月`,
          amount,
        }));
      } else {
        // 全期間の月集計
        const monthly: Record<string, number> = {};
        activeTransactions.forEach(t => {
          const d = new Date(t.date);
          const mKey = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthly[mKey] = (monthly[mKey] || 0) + t.amount;
        });

        return Object.entries(monthly)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, amount]) => {
            const parts = key.split('/');
            return {
              label: `${parts[0].slice(-2)}/${parseInt(parts[1])}`,
              amount,
            };
          });
      }
    } else {
      // effectiveGranularity === 'year'
      const yearly: Record<string, number> = {};
      let minYear = new Date().getFullYear();
      let maxYear = minYear;

      activeTransactions.forEach(t => {
        const year = new Date(t.date).getFullYear();
        yearly[year] = (yearly[year] || 0) + t.amount;
        if (year < minYear) minYear = year;
        if (year > maxYear) maxYear = year;
      });

      const results = [];
      for (let y = minYear; y <= maxYear; y++) {
        results.push({
          label: `${y}年`,
          amount: yearly[y] || 0,
        });
      }
      return results;
    }
  }, [transactions, period, effectiveGranularity, targetDate]);

  // 純資産推移 (エリア/折れ線グラフ用)
  const netWorthTrendData = useMemo(() => {
    if (!allTransactions || !targetDate) return [];

    const validAllTransactions = allTransactions.filter(t => !t.exclude_from_balance);

    if (effectiveGranularity === 'day') {
      if (period === 'month') {
        const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        let runningTotal = 0;
        validAllTransactions.forEach(t => {
          if (new Date(t.date) < firstDayOfMonth) runningTotal += t.amount;
        });

        const dailyChanges: Record<string, number> = {};
        transactions.forEach(t => {
          if (t.exclude_from_balance) return;
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
      } else {
        // 年または全期間の日別推移
        const targetYear = targetDate.getFullYear();
        const startOfYear = new Date(targetYear, 0, 1);
        let runningTotal = 0;
        validAllTransactions.forEach(t => {
          if (new Date(t.date) < startOfYear) runningTotal += t.amount;
        });

        const dailyChanges: Record<string, number> = {};
        transactions.forEach(t => {
          if (t.exclude_from_balance) return;
          const dateKey = t.date.split('T')[0];
          dailyChanges[dateKey] = (dailyChanges[dateKey] || 0) + t.amount;
        });

        const sortedDates = Object.keys(dailyChanges).sort();
        if (sortedDates.length === 0) return [];

        const results: DailyTrendData[] = [];
        sortedDates.forEach(dateKey => {
          runningTotal += dailyChanges[dateKey];
          results.push({ date: dateKey, amount: runningTotal });
        });
        return results;
      }
    } else if (effectiveGranularity === 'week') {
      if (period === 'month') {
        // 月内の各週末時点の残高
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1);

        let runningTotal = 0;
        validAllTransactions.forEach(t => {
          if (new Date(t.date) < firstDayOfMonth) runningTotal += t.amount;
        });

        const weekCount = daysInMonth > 28 ? 5 : 4;
        const weeklyChanges = new Array(weekCount).fill(0);

        transactions.forEach(t => {
          if (t.exclude_from_balance) return;
          const day = new Date(t.date).getDate();
          const weekIdx = Math.min(Math.floor((day - 1) / 7), weekCount - 1);
          weeklyChanges[weekIdx] += t.amount;
        });

        const results: DailyTrendData[] = [];
        for (let i = 0; i < weekCount; i++) {
          runningTotal += weeklyChanges[i];
          results.push({
            date: `第${i + 1}週`,
            amount: runningTotal,
          });
        }
        return results;
      } else {
        // 年（または全期間）の週集計
        const targetYear = targetDate.getFullYear();
        const startOfYear = new Date(targetYear, 0, 1);
        let runningTotal = 0;
        validAllTransactions.forEach(t => {
          if (new Date(t.date) < startOfYear) runningTotal += t.amount;
        });

        const weeklyChanges: Record<string, { order: number; amount: number; label: string }> = {};
        transactions.forEach(t => {
          if (t.exclude_from_balance) return;
          const d = new Date(t.date);
          const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
          const monday = new Date(d);
          monday.setDate(d.getDate() - dayOfWeek);
          const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
          const label = `${monday.getMonth() + 1}/${monday.getDate()}~`;

          if (!weeklyChanges[key]) {
            weeklyChanges[key] = { order: monday.getTime(), amount: 0, label };
          }
          weeklyChanges[key].amount += t.amount;
        });

        const sortedKeys = Object.keys(weeklyChanges).sort();
        const results: DailyTrendData[] = [];
        sortedKeys.forEach(k => {
          runningTotal += weeklyChanges[k].amount;
          results.push({
            date: weeklyChanges[k].label,
            amount: runningTotal,
          });
        });
        return results;
      }
    } else if (effectiveGranularity === 'month') {
      if (period === 'year') {
        const results: DailyTrendData[] = [];
        let runningTotal = 0;
        const targetYear = targetDate.getFullYear();

        validAllTransactions.forEach(t => {
          if (new Date(t.date).getFullYear() < targetYear) runningTotal += t.amount;
        });

        const monthlyChanges: number[] = new Array(12).fill(0);
        transactions.forEach(t => {
          if (t.exclude_from_balance) return;
          const d = new Date(t.date);
          if (d.getFullYear() === targetYear) {
            monthlyChanges[d.getMonth()] += t.amount;
          }
        });

        for (let m = 0; m < 12; m++) {
          runningTotal += monthlyChanges[m];
          results.push({
            date: `${targetYear}-${String(m + 1).padStart(2, '0')}`,
            amount: runningTotal,
          });
        }
        return results;
      } else {
        // 全期間の月次推移
        let minDate = new Date();
        validAllTransactions.forEach(t => {
          const d = new Date(t.date);
          if (d < minDate) minDate = d;
        });

        const minYear = minDate.getFullYear();
        const minMonth = minDate.getMonth();
        const now = new Date();
        const maxYear = now.getFullYear();
        const maxMonth = now.getMonth();

        const monthlyChanges: Record<string, number> = {};
        validAllTransactions.forEach(t => {
          const d = new Date(t.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthlyChanges[key] = (monthlyChanges[key] || 0) + t.amount;
        });

        const results: DailyTrendData[] = [];
        let runningTotal = 0;
        let curY = minYear;
        let curM = minMonth;

        while (curY < maxYear || (curY === maxYear && curM <= maxMonth)) {
          const key = `${curY}-${String(curM + 1).padStart(2, '0')}`;
          runningTotal += monthlyChanges[key] || 0;
          results.push({
            date: key,
            amount: runningTotal,
          });

          curM++;
          if (curM > 11) {
            curM = 0;
            curY++;
          }
        }
        return results;
      }
    } else {
      // effectiveGranularity === 'year'
      const yearlyChanges: Record<string, number> = {};
      let minYear = new Date().getFullYear();
      let maxYear = minYear;

      validAllTransactions.forEach(t => {
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
  }, [allTransactions, transactions, targetDate, period, effectiveGranularity]);

  return { categoryData, incomeCategoryData, trendData, netWorthTrendData };
};
