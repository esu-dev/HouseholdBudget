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
    const { transactions, fetchData } = useTransactionStore();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timeScale, setTimeScale] = useState<TimeScale>('day');

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
        setSelectedDate(next);
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date);
            if (timeScale === 'day') {
                return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
            } else if (timeScale === 'month') {
                return d.getFullYear() === selectedDate.getFullYear();
            }
            return true; // Year view uses all
        });
    }, [transactions, selectedDate, timeScale]);

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
            onPress={() => setTimeScale(value)}
            className={`flex-1 py-2 rounded-xl items-center ${
                timeScale === value ? 'bg-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800'
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
                        <TouchableOpacity onPress={() => changeDate(-1)} className="p-2">
                            <ChevronLeft size={24} color="#6366f1" />
                        </TouchableOpacity>

                        <Text className="text-lg font-bold text-slate-900 dark:text-white">
                            {dateLabel}
                        </Text>

                        <TouchableOpacity onPress={() => changeDate(1)} className="p-2">
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
                </View>

                <View className="mb-8">
                    <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">収支推移</Text>
                    <DailyTrendBarChart transactions={filteredTransactions} timeScale={timeScale} />
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">資産成長トレンド</Text>
                  <NetWorthTrendChart 
                    transactions={filteredTransactions} 
                    allTransactions={transactions} 
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
