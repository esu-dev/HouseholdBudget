import { ChevronLeft, ChevronRight, Tag } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CategoryDonutChart } from '../../components/CategoryDonutChart';
import { DailyTrendBarChart } from '../../components/DailyTrendBarChart';
import { IncomeDonutChart } from '../../components/IncomeDonutChart';
import { NetWorthTrendChart } from '../../components/NetWorthTrendChart';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import {
    AnalysisPeriod,
    ChartGranularity,
    getAvailableGranularities,
    getDefaultGranularity,
} from '../../hooks/useTransactionAnalysis';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function AnalysisScreen() {
    const colorScheme = useAppColorScheme();
    const { transactions, fetchData, accounts } = useTransactionStore();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [period, setPeriod] = useState<AnalysisPeriod>('month');
    const [trendGranularity, setTrendGranularity] = useState<ChartGranularity>('day');
    const [netWorthGranularity, setNetWorthGranularity] = useState<ChartGranularity>('day');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const handlePeriodChange = (newPeriod: AnalysisPeriod) => {
        setPeriod(newPeriod);
        setExpandedCategory(null);

        // 期間変更時に、その期間で利用可能な目盛り粒度をチェックし、非対応ならデフォルトにリセット
        const available = getAvailableGranularities(newPeriod);
        if (!available.includes(trendGranularity)) {
            setTrendGranularity(getDefaultGranularity(newPeriod));
        }
        if (!available.includes(netWorthGranularity)) {
            setNetWorthGranularity(getDefaultGranularity(newPeriod));
        }
    };

    const availableTags = useMemo(() => {
        const tagSet = new Set<string>();
        transactions.forEach(t => {
            if (t.tags && Array.isArray(t.tags)) {
                t.tags.forEach(tag => tagSet.add(tag));
            }
        });
        return Array.from(tagSet);
    }, [transactions]);

    const changeDate = (offset: number) => {
        const next = new Date(selectedDate);
        if (period === 'month') {
            next.setMonth(next.getMonth() + offset);
        } else if (period === 'year') {
            next.setFullYear(next.getFullYear() + offset);
        }
        setExpandedCategory(null);
        setSelectedDate(next);
    };

    const filteredTransactions = useMemo(() => {
        const excludedAccountIds = new Set(accounts.filter(a => a.excludeFromNetWorth).map(a => a.id));
        const activeTransactions = transactions.filter(t => !excludedAccountIds.has(t.account_id));

        return activeTransactions.filter(t => {
            if (selectedTag && (!t.tags || !t.tags.includes(selectedTag))) {
                return false;
            }

            const d = new Date(t.date);
            if (period === 'month') {
                return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
            } else if (period === 'year') {
                return d.getFullYear() === selectedDate.getFullYear();
            }
            return true; // all (全期間)
        });
    }, [transactions, selectedDate, period, accounts, selectedTag]);

    const groupedTransactions = useMemo(() => {
        const groups: Record<string, typeof transactions> = {};
        const expenses = filteredTransactions.filter(t => t.amount < 0 && t.category_id !== 'transfer' && !t.exclude_from_balance);

        expenses.forEach(t => {
            const major = useTransactionStore.getState().majorCategories.find(maj =>
                maj.subCategories.some(min => min.id === t.category_id)
            );
            const majorId = major?.id || 'others';
            if (!groups[majorId]) groups[majorId] = [];
            groups[majorId].push(t);
        });

        // Sort categories by total amount
        return Object.entries(groups)
            .sort(([, a], [, b]) => {
                const sumA = a.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                const sumB = b.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                return sumB - sumA;
            })
            .reduce((acc, [key, val]) => {
                acc[key] = val.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                return acc;
            }, {} as Record<string, typeof transactions>);
    }, [filteredTransactions]);

    const dateLabel = useMemo(() => {
        if (period === 'month') {
            return `${selectedDate.getFullYear()}年 ${selectedDate.getMonth() + 1}月`;
        } else if (period === 'year') {
            return `${selectedDate.getFullYear()}年`;
        }
        return '全期間';
    }, [selectedDate, period]);

    const PeriodButton = ({ label, value }: { label: string, value: AnalysisPeriod }) => {
        const isSelected = period === value;
        return (
            <TouchableOpacity
                onPress={() => handlePeriodChange(value)}
                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                className={`flex-1 py-2.5 rounded-xl items-center ${isSelected ? 'bg-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800'}`}
            >
                <Text className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-900">
            <View className="bg-white dark:bg-slate-800 px-4 pt-[30px] pb-4 flex-row justify-between items-center shadow-sm z-10">
                {period !== 'all' ? (
                    <>
                        <TouchableOpacity
                            onPress={() => changeDate(-1)}
                            accessibilityRole="button"
                            accessibilityLabel={period === 'month' ? '前の月' : '前年'}
                            activeOpacity={0.7}
                            style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colorScheme === 'dark' ? '#312e81' : '#eef2ff' }}
                        >
                            <ChevronLeft size={24} color="#6366f1" />
                        </TouchableOpacity>

                        <Text className="text-lg font-bold text-slate-900 dark:text-white">
                            {dateLabel}
                        </Text>

                        <TouchableOpacity
                            onPress={() => changeDate(1)}
                            accessibilityRole="button"
                            accessibilityLabel={period === 'month' ? '次の月' : '翌年'}
                            activeOpacity={0.7}
                            style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colorScheme === 'dark' ? '#312e81' : '#eef2ff' }}
                        >
                            <ChevronRight size={24} color="#6366f1" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text className="text-lg font-bold text-slate-900 dark:text-white flex-1 text-center py-2">
                        {dateLabel}
                    </Text>
                )}
            </View>

            {/* 全体の期間選択 */}
            <View className="px-4 pt-3 pb-2">
                <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">
                    集計期間
                </Text>
                <View className="flex-row gap-2">
                    <PeriodButton label="月間" value="month" />
                    <PeriodButton label="年間" value="year" />
                    <PeriodButton label="全期間" value="all" />
                </View>
            </View>

            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-6">家計分析</Text>

                <View className="mb-8">
                    <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">カテゴリ別支出</Text>

                    {/* タグ選択フィルター */}
                    {availableTags.length > 0 && (
                        <View className="mb-4">
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                            >
                                <TouchableOpacity
                                    onPress={() => setSelectedTag(null)}
                                    className={`flex-row items-center px-3 py-1.5 rounded-full border ${selectedTag === null ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                                >
                                    <Tag size={12} color={selectedTag === null ? 'white' : '#64748b'} />
                                    <Text className={`text-xs font-bold ml-1.5 ${selectedTag === null ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                        すべてのタグ
                                    </Text>
                                </TouchableOpacity>
                                {availableTags.map(tag => (
                                    <TouchableOpacity
                                        key={tag}
                                        onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                        className={`flex-row items-center px-3 py-1.5 rounded-full border ${selectedTag === tag ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <Text className={`text-xs font-bold ${selectedTag === tag ? 'text-white' : 'text-indigo-500'}`}>
                                            #{tag}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <CategoryDonutChart transactions={filteredTransactions} />

                    {/* カテゴリ別取引一覧（アコーディオン） */}
                    <View className="gap-2">
                        {Object.entries(groupedTransactions).map(([majorId, txs]) => {
                            const major = useTransactionStore.getState().majorCategories.find(m => m.id === majorId);
                            const label = major?.label || 'その他';
                            const color = major?.color || '#94a3b8';
                            const total = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                            const isExpanded = expandedCategory === majorId;

                            return (
                                <View key={majorId} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    <TouchableOpacity
                                        onPress={() => setExpandedCategory(isExpanded ? null : majorId)}
                                        className="flex-row items-center justify-between p-4"
                                    >
                                        <View className="flex-row items-center flex-1">
                                            <View className="w-2 h-8 rounded-full" style={{ backgroundColor: color }} />
                                            <View className="ml-3">
                                                <Text className="text-sm font-bold text-slate-900 dark:text-white">{label}</Text>
                                                <Text className="text-[10px] text-slate-400">{txs.length}件の取引</Text>
                                            </View>
                                        </View>
                                        <View className="flex-row items-center">
                                            <Text className="text-sm font-black text-slate-900 dark:text-white mr-3">
                                                ¥{total.toLocaleString()}
                                            </Text>
                                            {isExpanded ? <ChevronRight size={16} color="#94a3b8" style={{ transform: [{ rotate: '90deg' }] }} /> : <ChevronRight size={16} color="#94a3b8" />}
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View className="border-t border-slate-50 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/10 p-2">
                                            {txs.map((t, idx) => {
                                                const d = new Date(t.date);
                                                const dateStr = period === 'month'
                                                    ? `${d.getMonth() + 1}/${d.getDate()}`
                                                    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                                                const minorCat = major?.subCategories.find(s => s.id === t.category_id);

                                                return (
                                                    <View key={t.id || idx} className="flex-row items-center justify-between p-3 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                                        <View className="flex-1 mr-4">
                                                            <View className="flex-row items-center mb-1">
                                                                <Text className="text-[10px] font-bold text-slate-400 mr-2">{dateStr}</Text>
                                                                <Text className="text-xs font-bold text-slate-700 dark:text-slate-300" numberOfLines={1}>
                                                                    {minorCat?.label || '不明'}
                                                                </Text>
                                                            </View>
                                                            <Text className="text-[10px] text-slate-400" numberOfLines={1}>
                                                                {t.payee || (t.memo ? `メモ: ${t.memo}` : '項目名なし')}
                                                            </Text>
                                                        </View>
                                                        <Text className="text-sm font-bold text-slate-900 dark:text-white">
                                                            ¥{Math.abs(t.amount).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>

                <View className="mb-8">
                    <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">カテゴリ別収入</Text>
                    <IncomeDonutChart transactions={filteredTransactions} />
                </View>

                {/* 収支推移グラフ */}
                <View className="mb-8">
                    <DailyTrendBarChart
                        transactions={filteredTransactions}
                        period={period}
                        granularity={trendGranularity}
                        onGranularityChange={setTrendGranularity}
                        targetDate={selectedDate}
                    />
                </View>

                {/* 資産成長トレンドグラフ */}
                <View className="mb-4">
                    <NetWorthTrendChart
                        transactions={filteredTransactions}
                        allTransactions={transactions.filter(t => {
                            const excludedAccountIds = new Set(accounts.filter(a => a.excludeFromNetWorth).map(a => a.id));
                            return !excludedAccountIds.has(t.account_id);
                        })}
                        targetDate={selectedDate}
                        period={period}
                        granularity={netWorthGranularity}
                        onGranularityChange={setNetWorthGranularity}
                    />
                </View>

                <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6">
                    <Text className="text-lg font-bold text-slate-900 dark:text-white mb-2">表示モードのヒント</Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-sm leading-6">
                        ・<Text className="font-bold">集計期間</Text>: 上部で月間・年間・全期間を切り替えて対象データを絞り込みます。{"\n"}
                        ・<Text className="font-bold">グラフの目盛り</Text>: 各推移グラフの右上ボタン（日・週・月・年）で、グラフの細かさを個別に変更できます。
                    </Text>
                </View>

                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
