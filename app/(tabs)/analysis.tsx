import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CategoryDonutChart } from '../../components/CategoryDonutChart';
import { DailyTrendBarChart } from '../../components/DailyTrendBarChart';
import { NetWorthTrendChart } from '../../components/NetWorthTrendChart';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { TimeScale } from '../../hooks/useTransactionAnalysis';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function AnalysisScreen() {
    const colorScheme = useAppColorScheme();
    const { transactions, fetchData, accounts } = useTransactionStore();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timeScale, setTimeScale] = useState<TimeScale>('day');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const changeDate = (offset: number) => {
        const next = new Date(selectedDate);
        if (timeScale === 'day') {
            next.setMonth(next.getMonth() + offset);
        } else if (timeScale === 'month') {
            next.setFullYear(next.getFullYear() + offset);
        }
        setExpandedCategory(null);
        setSelectedDate(next);
    };

    const filteredTransactions = useMemo(() => {
        const excludedAccountIds = new Set(accounts.filter(a => a.excludeFromNetWorth).map(a => a.id));
        const activeTransactions = transactions.filter(t => !excludedAccountIds.has(t.account_id));

        return activeTransactions.filter(t => {
            const d = new Date(t.date);
            if (timeScale === 'day') {
                return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
            } else if (timeScale === 'month') {
                return d.getFullYear() === selectedDate.getFullYear();
            }
            return true; // Year view uses all
        });
    }, [transactions, selectedDate, timeScale, accounts]);

    const groupedTransactions = useMemo(() => {
        const groups: Record<string, typeof transactions> = {};
        const expenses = filteredTransactions.filter(t => t.amount < 0 && t.category_id !== 'transfer');

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
        if (timeScale === 'day') {
            return `${selectedDate.getFullYear()}年 ${selectedDate.getMonth() + 1}月`;
        } else if (timeScale === 'month') {
            return `${selectedDate.getFullYear()}年`;
        }
        return '全期間';
    }, [selectedDate, timeScale]);

    const ScaleButton = ({ label, value }: { label: string, value: TimeScale }) => (
        <TouchableOpacity
            onPress={() => {
                setTimeScale(value);
                setExpandedCategory(null);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
            className={`flex-1 py-2 rounded-xl items-center ${timeScale === value ? 'bg-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800'
                }`}
        >
            <Text className={`font-bold text-xs ${timeScale === value ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-900">
            <View className="bg-white dark:bg-slate-800 px-4 pt-[30px] pb-4 flex-row justify-between items-center shadow-sm z-10">
                {timeScale !== 'year' ? (
                    <>
                        <TouchableOpacity onPress={() => changeDate(-1)} className="p-2" hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}>
                            <ChevronLeft size={24} color="#6366f1" />
                        </TouchableOpacity>

                        <Text className="text-lg font-bold text-slate-900 dark:text-white">
                            {dateLabel}
                        </Text>

                        <TouchableOpacity onPress={() => changeDate(1)} className="p-2" hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}>
                            <ChevronRight size={24} color="#6366f1" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text className="text-lg font-bold text-slate-900 dark:text-white flex-1 text-center py-2">
                        {dateLabel}
                    </Text>
                )}
            </View>

            <View className="flex-row p-4 gap-2">
                <ScaleButton label="月" value="day" />
                <ScaleButton label="年" value="month" />
                <ScaleButton label="全期間" value="year" />
            </View>

            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-6">家計分析</Text>

                <View className="mb-8">
                    <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">カテゴリ別支出</Text>
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
                                                const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
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
                    <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">収支推移</Text>
                    <DailyTrendBarChart transactions={filteredTransactions} timeScale={timeScale} />
                </View>

                <View className="mb-4">
                    <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">資産成長トレンド</Text>
                    <NetWorthTrendChart
                        transactions={filteredTransactions}
                        allTransactions={transactions.filter(t => {
                            const excludedAccountIds = new Set(accounts.filter(a => a.excludeFromNetWorth).map(a => a.id));
                            return !excludedAccountIds.has(t.account_id);
                        })}
                        targetDate={selectedDate}
                        timeScale={timeScale}
                    />
                </View>

                <View className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm mb-6">
                    <Text className="text-lg font-bold text-slate-900 dark:text-white mb-2">表示モードのヒント</Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-sm leading-6">
                        ・<Text className="font-bold">日表示</Text>: 月間の細かいお金の動き。{"\n"}
                        ・<Text className="font-bold">月表示</Text>: 年間を通じた資産の積み上がり。{"\n"}
                        ・<Text className="font-bold">年表示</Text>: 長期的な資産形成の歩み。
                    </Text>
                </View>

                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
