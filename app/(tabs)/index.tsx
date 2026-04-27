import { CategoryDonutChart } from '@/components/CategoryDonutChart';
import { useRouter } from 'expo-router';
import { CalendarIcon, ChevronLeft, ChevronRight, CircleEllipsis, List, MessageSquare, Store, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

// カレンダーの日本語設定
LocaleConfig.locales['ja'] = {
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
    dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
};
LocaleConfig.defaultLocale = 'ja';

const TransactionItem = React.memo(({
    item,
    majorCategories,
    accounts,
    onPress
}: any) => {
    let minorCategory = null;
    let majorCategory = null;

    for (const maj of majorCategories) {
        const min = maj.subCategories.find((s: any) => s.id === item.category_id);
        if (min) {
            minorCategory = min;
            majorCategory = maj;
            break;
        }
    }

    const account = accounts.find((a: any) => a.id === item.account_id);
    const toAccount = item.to_account_id ? accounts.find((a: any) => a.id === item.to_account_id) : null;
    const label = minorCategory?.label || '不明';
    const color = majorCategory?.color || '#64748b';
    const IconComp = CATEGORY_ICONS[majorCategory?.icon || 'others'] || CircleEllipsis;

    return (
        <TouchableOpacity
            onPress={() => onPress(item)}
            className="bg-white dark:bg-slate-800 p-4 rounded-2xl mb-2 shadow-sm flex-row items-center mx-4"
        >
            <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: color + '20' }}
            >
                <IconComp size={24} color={color} />
            </View>

            <View className="flex-1 ml-4">
                <View className="flex-row justify-between items-center">
                    <View className="flex-1 mr-2">
                        <Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                            {item.category_id === 'transfer' && toAccount
                                ? `${item.amount > 0 ? '←' : '→'} ${toAccount.name}`
                                : label}
                        </Text>
                        <Text className="text-[10px] text-slate-400" numberOfLines={1}>
                            {majorCategory?.label}
                        </Text>
                    </View>
                    <Text className={`text-lg font-bold ${item.amount > 0 ? 'text-green-500' : 'text-slate-900 dark:text-white'}`} style={{ minWidth: 80, textAlign: 'right' }}>
                        {item.amount > 0 ? '+' : ''}¥{item.amount.toLocaleString()}
                    </Text>
                </View>

                <View className="flex-row justify-between items-center mt-1">
                    <View className="flex-row items-center flex-1">
                        <Text className="text-xs text-slate-400 dark:text-slate-500">
                            {account?.name || '不明'}
                        </Text>
                        {item.payee ? (
                            <>
                                <Text className="text-slate-300 mx-1">|</Text>
                                <View className="flex-row items-center">
                                    <Store size={10} color="#94a3b8" />
                                    <Text className="text-xs text-slate-500 dark:text-slate-400 ml-1 font-medium" numberOfLines={1}>
                                        {item.payee}
                                    </Text>
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>

                {item.memo ? (
                    <View className="flex-row items-center mt-0.5">
                        <MessageSquare size={10} color="#94a3b8" />
                        <Text className="text-[10px] text-slate-400 dark:text-slate-500 ml-1" numberOfLines={1}>
                            {item.memo}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View className="ml-2">
                <ChevronRight size={20} color="#94a3b8" />
            </View>
        </TouchableOpacity>
    );
});

const HeaderContent = React.memo(({
    totalBudget,
    totals,
    monthTransactions,
    selectedMajorId,
    setSelectedMajorId,
    selectedMinorId,
    setSelectedMinorId,
    availableMajors,
    availableMinors,
    setIsBudgetModalVisible
}: any) => {
    const remainingBudget = totalBudget - totals.expense;
    const progress = totalBudget > 0 ? Math.min(totals.expense / totalBudget, 1) : 0;
    const progressColor = progress > 0.9 ? 'bg-rose-500' : progress > 0.7 ? 'bg-amber-500' : 'bg-indigo-500';

    return (
        <View className="p-4">
            {/* 予算サマリーカード */}
            {totalBudget > 0 && (
                <TouchableOpacity
                    onPress={() => setIsBudgetModalVisible(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="bg-white dark:bg-slate-800 p-6 rounded-[32px] shadow-sm mb-6"
                >
                    <View className="flex-row justify-between items-center mb-4">
                        <View>
                            <Text className="text-slate-400 text-xs font-bold mb-1">残り予算</Text>
                            <Text className={`text-2xl font-black ${remainingBudget < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                                ¥{remainingBudget.toLocaleString()}
                            </Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-slate-400 text-xs font-bold mb-1">予算合計</Text>
                            <Text className="text-slate-600 dark:text-slate-300 font-bold">
                                ¥{totalBudget.toLocaleString()}
                            </Text>
                        </View>
                    </View>

                    {/* プログレスバー */}
                    <View className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <View
                            className={`h-full ${progressColor}`}
                            style={{ width: `${progress * 100}%` }}
                        />
                    </View>
                    <View className="flex-row justify-between mt-2">
                        <Text className="text-[10px] text-slate-400 font-medium">支出: ¥{totals.expense.toLocaleString()}</Text>
                        <Text className="text-[10px] text-slate-400 font-medium">{Math.round(progress * 100)}%</Text>
                    </View>

                    <View className="flex-row items-center justify-center mt-4">
                        <Text className="text-[10px] text-indigo-500 font-bold mr-1">カテゴリ別の詳細を表示</Text>
                        <ChevronRight size={10} color="#6366f1" />
                    </View>
                </TouchableOpacity>
            )}

            {/* 収支サマリーカード */}
            <View className="bg-white dark:bg-slate-800 p-6 rounded-[32px] shadow-sm mb-6">
                <View className="flex-row justify-between mb-4">
                    <View>
                        <View className="flex-row items-center mb-1">
                            <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                            <Text className="text-slate-400 text-xs font-bold">収入</Text>
                        </View>
                        <Text className="text-green-500 text-xl font-black">
                            ¥{totals.income.toLocaleString()}
                        </Text>
                    </View>
                    <View className="items-end">
                        <View className="flex-row items-center mb-1">
                            <Text className="text-slate-400 text-xs font-bold mr-2">支出</Text>
                            <View className="w-2 h-2 rounded-full bg-rose-500" />
                        </View>
                        <Text className="text-rose-500 text-xl font-black">
                            ¥{totals.expense.toLocaleString()}
                        </Text>
                    </View>
                </View>

                <View className="h-[1px] bg-slate-100 dark:bg-slate-700 w-full mb-4" />

                <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 dark:text-slate-400 font-bold">今月の収支</Text>
                    <Text className={`text-2xl font-black ${totals.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                        {totals.balance >= 0 ? '+' : ''}¥{totals.balance.toLocaleString()}
                    </Text>
                </View>
            </View>

            <CategoryDonutChart transactions={monthTransactions} />

            <View className="flex-row justify-between items-end mt-4 mb-2 ml-2">
                <Text className="text-xl font-bold text-slate-900 dark:text-white">
                    最近の履歴
                </Text>
            </View>

            {/* カテゴリフィルタリング（大カテゴリ） */}
            {availableMajors.length > 0 && (
                <View className="mb-2">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 8, gap: 8, paddingBottom: 4 }}
                    >
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedMajorId(null);
                                setSelectedMinorId(null);
                            }}
                            className={`px-4 py-2 rounded-full border ${selectedMajorId === null ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                        >
                            <Text className={`text-xs font-bold ${selectedMajorId === null ? 'text-white' : 'text-slate-400'}`}>
                                すべて
                            </Text>
                        </TouchableOpacity>
                        {availableMajors
                            .map((maj: any) => (
                                <TouchableOpacity
                                    key={maj.id}
                                    onPress={() => {
                                        setSelectedMajorId(maj.id);
                                        setSelectedMinorId(null);
                                    }}
                                    className={`px-4 py-2 rounded-full border ${selectedMajorId === maj.id ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                                >
                                    <Text className={`text-xs font-bold ${selectedMajorId === maj.id ? 'text-white' : 'text-slate-400'}`}>
                                        {maj.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                    </ScrollView>

                    {/* カテゴリフィルタリング（小カテゴリ） */}
                    {availableMinors.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 8, gap: 8, paddingTop: 4, paddingBottom: 8 }}
                        >
                            <TouchableOpacity
                                onPress={() => setSelectedMinorId(null)}
                                className={`px-3 py-1.5 rounded-2xl border ${selectedMinorId === null ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                            >
                                <Text className={`text-[11px] ${selectedMinorId === null ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'}`}>
                                    すべて
                                </Text>
                            </TouchableOpacity>
                            {availableMinors.map((min: any) => (
                                <TouchableOpacity
                                    key={min.id}
                                    onPress={() => setSelectedMinorId(min.id)}
                                    className={`px-3 py-1.5 rounded-2xl border ${selectedMinorId === min.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                                >
                                    <Text className={`text-[11px] ${selectedMinorId === min.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'}`}>
                                        {min.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}
        </View>
    );
});

export default function HomeScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { transactions, accounts, fetchData, fetchBudgets, budgets, setEditingTransaction, majorCategories } = useTransactionStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
    const [selectedDay, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
    const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null);
    const [selectedMinorId, setSelectedMinorId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const year = selectedMonth.getFullYear();
        const month = String(selectedMonth.getMonth() + 1).padStart(2, '0');
        fetchBudgets(`${year}-${month}`);
    }, [selectedMonth]);

    const monthTransactions = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date);
            return (
                d.getMonth() === selectedMonth.getMonth() &&
                d.getFullYear() === selectedMonth.getFullYear()
            );
        });
    }, [transactions, selectedMonth]);

    const availableMajors = useMemo(() => {
        const catIds = new Set(monthTransactions.map(t => t.category_id));
        const hasTransfer = catIds.has('transfer');

        const majors = majorCategories.filter(maj =>
            maj.subCategories.some(min => catIds.has(min.id))
        ).map(maj => ({
            id: maj.id,
            label: maj.label,
            color: maj.color,
            type: maj.type
        }));

        if (hasTransfer) {
            majors.push({ id: 'transfer', label: '振替', color: '#6366f1', type: 'all' as any });
        }

        return majors;
    }, [monthTransactions, majorCategories]);

    const availableMinors = useMemo(() => {
        if (!selectedMajorId || selectedMajorId === 'transfer') return [];
        const catIds = new Set(monthTransactions.map(t => t.category_id));
        const major = majorCategories.find(m => m.id === selectedMajorId);
        if (!major) return [];
        return major.subCategories.filter(min => catIds.has(min.id));
    }, [monthTransactions, majorCategories, selectedMajorId]);

    const filteredTransactions = useMemo(() => {
        return monthTransactions.filter(t => {
            // Category filter
            if (selectedMajorId === 'transfer') {
                if (t.category_id !== 'transfer') return false;
            } else if (selectedMajorId) {
                if (selectedMinorId) {
                    if (t.category_id !== selectedMinorId) return false;
                } else {
                    const major = majorCategories.find(m => m.id === selectedMajorId);
                    if (!major?.subCategories.some(min => min.id === t.category_id)) return false;
                }
            }

            return true;
        });
    }, [monthTransactions, selectedMajorId, selectedMinorId, majorCategories]);

    const dayTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesDay = t.date.split('T')[0] === selectedDay;
            if (!matchesDay) return false;

            // Category filter
            if (selectedMajorId === 'transfer') {
                if (t.category_id !== 'transfer') return false;
            } else if (selectedMajorId) {
                if (selectedMinorId) {
                    if (t.category_id !== selectedMinorId) return false;
                } else {
                    const major = majorCategories.find(m => m.id === selectedMajorId);
                    if (!major?.subCategories.some(min => min.id === t.category_id)) return false;
                }
            }

            return true;
        });
    }, [transactions, selectedDay, selectedMajorId, selectedMinorId, majorCategories]);

    const markedDates = useMemo(() => {
        const marks: any = {};
        transactions.forEach(t => {
            const dateStr = t.date.split('T')[0];
            if (!marks[dateStr]) {
                marks[dateStr] = { marked: true, dots: [] };
            }
            // 支出か収入かでドットの色を変える（簡易版）
            const dotColor = t.amount > 0 ? '#22c55e' : '#ef4444';
            if (marks[dateStr].dots.length < 3) {
                marks[dateStr].dots.push({ color: dotColor });
            }
        });

        if (selectedDay) {
            marks[selectedDay] = {
                ...marks[selectedDay],
                selected: true,
                selectedColor: '#6366f1'
            };
        }
        return marks;
    }, [transactions, selectedDay]);

    const totals = useMemo(() => {
        let income = 0;
        let expense = 0;
        monthTransactions.forEach(t => {
            if (t.category_id === 'transfer' || t.category_id === 'adjustment') return; // 振替・調整は収支に計上しない
            if (t.amount > 0) {
                income += t.amount;
            } else {
                expense += Math.abs(t.amount);
            }
        });
        return { income, expense, balance: income - expense };
    }, [monthTransactions]);

    const totalBudget = useMemo(() => {
        return budgets.reduce((sum, b) => sum + b.amount, 0);
    }, [budgets]);

    // カテゴリ別の予算と実績の計算
    const budgetBreakdown = useMemo(() => {
        // 全大カテゴリに対する初期化
        const breakdown: Record<string, {
            id: string,
            label: string,
            icon: string,
            color: string,
            budget: number,
            spent: number
        }> = {};

        // 予算があるカテゴリ、または支出があるカテゴリをリストアップ
        majorCategories.forEach(maj => {
            if (maj.type === 'expense') {
                breakdown[maj.id] = {
                    id: maj.id,
                    label: maj.label,
                    icon: maj.icon,
                    color: maj.color,
                    budget: budgets.find(b => b.category_id === maj.id)?.amount || 0,
                    spent: 0
                };
            }
        });

        // 実際の支出を合算
        monthTransactions.forEach(t => {
            if (t.amount < 0 && t.category_id !== 'transfer' && t.category_id !== 'adjustment') {
                // 小カテゴリから親の大カテゴリを探す
                let parentMajId = null;
                for (const maj of majorCategories) {
                    if (maj.subCategories.find((s: any) => s.id === t.category_id)) {
                        parentMajId = maj.id;
                        break;
                    }
                }

                if (parentMajId && breakdown[parentMajId]) {
                    breakdown[parentMajId].spent += Math.abs(t.amount);
                }
            }
        });

        // 予算が設定されているか、支出があるものだけを返す
        return Object.values(breakdown)
            .filter(b => b.budget > 0 || b.spent > 0)
            .sort((a, b) => b.budget - a.budget);
    }, [majorCategories, budgets, monthTransactions]);



    const sectionedTransactions = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const sorted = [...filteredTransactions].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        sorted.forEach(t => {
            const dateObj = new Date(t.date);
            const dateStr = dateObj.toLocaleDateString('ja-JP', {
                month: 'long',
                day: 'numeric',
                weekday: 'short'
            });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });

        const flatList: any[] = [];
        Object.entries(groups).forEach(([date, items]) => {
            flatList.push({ type: 'header', date });
            items.forEach(item => flatList.push({ type: 'item', ...item }));
        });

        return flatList;
    }, [filteredTransactions]);

    const changeMonth = (offset: number) => {
        const next = new Date(selectedMonth);
        next.setMonth(next.getMonth() + offset);
        setSelectedMonth(next);

        // カレンダーの日付選択も切り替え後の月の1日に合わせる
        const year = next.getFullYear();
        const month = String(next.getMonth() + 1).padStart(2, '0');
        setSelectedDate(`${year}-${month}-01`);
    };

    const handleTransactionPress = useCallback((item: any) => {
        setEditingTransaction(item);
        router.push('/edit-transaction');
    }, [setEditingTransaction, router]);

    const renderItem = useCallback(({ item }: { item: any }) => {
        if (item.type === 'header') {
            return (
                <View style={{ paddingHorizontal: 24, paddingVertical: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <CalendarIcon size={12} color="#94a3b8" />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginLeft: 8, textTransform: 'uppercase' }}>
                        {item.date}
                    </Text>
                </View>
            );
        }

        return (
            <TransactionItem
                item={item}
                majorCategories={majorCategories}
                accounts={accounts}
                onPress={handleTransactionPress}
            />
        );
    }, [majorCategories, accounts, handleTransactionPress]);

    const monthLabel = `${selectedMonth.getFullYear()}年 ${selectedMonth.getMonth() + 1}月`;

    const calendarTheme = useMemo(() => ({
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        calendarBackground: isDark ? '#1e293b' : 'white',
        textSectionTitleColor: isDark ? '#94a3b8' : '#64748b',
        selectedDayBackgroundColor: '#6366f1',
        selectedDayTextColor: '#ffffff',
        todayTextColor: '#6366f1',
        dayTextColor: isDark ? '#f1f5f9' : '#0f172a',
        textDisabledColor: isDark ? '#334155' : '#e2e8f0',
        dotColor: '#6366f1',
        selectedDotColor: '#ffffff',
        arrowColor: '#6366f1',
        monthTextColor: isDark ? '#f1f5f9' : '#0f172a',
        indicatorColor: '#6366f1',
        textDayFontWeight: '500',
        textMonthFontWeight: 'bold',
        textDayHeaderFontWeight: 'bold',
        textDayFontSize: 14,
        textMonthFontSize: 16,
        textDayHeaderFontSize: 12
    }), [isDark]);

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-900">
            <View className="bg-white dark:bg-slate-800 px-4 pt-[30px] pb-4 flex-row justify-between items-center shadow-sm z-10">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2" hitSlop={{ top: 60, bottom: 60, left: 60, right: 60 }}>
                        <ChevronLeft size={24} color="#6366f1" />
                    </TouchableOpacity>

                    <Text className="text-lg font-bold text-slate-900 dark:text-white min-w-[100px] text-center">
                        {monthLabel}
                    </Text>

                    <TouchableOpacity onPress={() => changeMonth(1)} className="p-2" hitSlop={{ top: 60, bottom: 60, left: 60, right: 60 }}>
                        <ChevronRight size={24} color="#6366f1" />
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: 12, padding: 4 }}>
                    <TouchableOpacity
                        onPress={() => setViewMode('list')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: viewMode === 'list' ? (isDark ? '#475569' : 'white') : 'transparent',
                            shadowColor: viewMode === 'list' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: viewMode === 'list' ? 0.1 : 0,
                            shadowRadius: 2,
                            elevation: viewMode === 'list' ? 2 : 0
                        }}
                    >
                        <List size={20} color={viewMode === 'list' ? '#6366f1' : '#94a3b8'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode('calendar')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: viewMode === 'calendar' ? (isDark ? '#475569' : 'white') : 'transparent',
                            shadowColor: viewMode === 'calendar' ? '#000' : 'transparent',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: viewMode === 'calendar' ? 0.1 : 0,
                            shadowRadius: 2,
                            elevation: viewMode === 'calendar' ? 2 : 0
                        }}
                    >
                        <CalendarIcon size={20} color={viewMode === 'calendar' ? '#6366f1' : '#94a3b8'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                <HeaderContent
                    totalBudget={totalBudget}
                    totals={totals}
                    monthTransactions={monthTransactions}
                    selectedMajorId={selectedMajorId}
                    setSelectedMajorId={setSelectedMajorId}
                    selectedMinorId={selectedMinorId}
                    setSelectedMinorId={setSelectedMinorId}
                    availableMajors={availableMajors}
                    availableMinors={availableMinors}
                    setIsBudgetModalVisible={setIsBudgetModalVisible}
                />

                {viewMode === 'list' ? (
                    <View style={{ paddingBottom: 40 }}>
                        {sectionedTransactions.map((item, index) => (
                            <View key={item.type === 'header' ? `header-${item.date}-${index}` : item.id?.toString() || `item-${index}`}>
                                {renderItem({ item })}
                            </View>
                        ))}
                    </View>
                ) : (
                    <>
                        <View className="mx-4 mb-6 rounded-3xl overflow-hidden shadow-sm">
                            <Calendar
                                key={selectedMonth.getFullYear() + '-' + selectedMonth.getMonth()}
                                current={selectedMonth.toISOString().split('T')[0]}
                                onDayPress={day => setSelectedDate(day.dateString)}
                                markedDates={markedDates}
                                theme={calendarTheme}
                                markingType={'multi-dot'}
                                hideArrows={true}
                                enableSwipeMonths={false}
                            />
                        </View>

                        <View className="mb-10">
                            <Text className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-4 ml-6 uppercase tracking-widest">
                                {selectedDay.replace(/-/g, '/')} の履歴
                            </Text>
                            {dayTransactions.length > 0 ? (
                                dayTransactions.map(t => (
                                    <TransactionItem
                                        key={t.id}
                                        item={t}
                                        majorCategories={majorCategories}
                                        accounts={accounts}
                                        onPress={handleTransactionPress}
                                    />
                                ))
                            ) : (
                                <View className="bg-white dark:bg-slate-800 p-8 rounded-2xl mx-4 items-center">
                                    <Text className="text-slate-400">この日の取引はありません</Text>
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            {/* 予算内訳モーダル */}
            <Modal
                visible={isBudgetModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsBudgetModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-slate-50 dark:bg-slate-900 rounded-t-[40px] h-[85%] p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-black text-slate-900 dark:text-white">予算の内訳</Text>
                            <TouchableOpacity
                                onPress={() => setIsBudgetModalVisible(false)}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                className="bg-slate-200 dark:bg-slate-700 p-2 rounded-full"
                            >
                                <X size={20} color={isDark ? '#f1f5f9' : '#0f172a'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {budgetBreakdown.map((item) => {
                                const remaining = item.budget - item.spent;
                                const progress = item.budget > 0 ? Math.min(item.spent / item.budget, 1) : 0;
                                const progressColor = progress > 0.9 ? 'bg-rose-500' : progress > 0.7 ? 'bg-amber-500' : 'bg-indigo-500';
                                const IconComp = CATEGORY_ICONS[item.icon] || CircleEllipsis;

                                return (
                                    <View key={item.id} className="bg-white dark:bg-slate-800 p-5 rounded-3xl mb-4 shadow-sm">
                                        <View className="flex-row items-center mb-4">
                                            <View
                                                className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                                                style={{ backgroundColor: item.color + '20' }}
                                            >
                                                <IconComp size={20} color={item.color} />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-base font-bold text-slate-900 dark:text-white">{item.label}</Text>
                                                <Text className={`text-xs font-bold ${remaining < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {remaining < 0 ? '超過: ' : '残り: '}¥{Math.abs(remaining).toLocaleString()}
                                                </Text>
                                            </View>
                                            <View className="items-end">
                                                <Text className="text-xs text-slate-400 font-medium">予算: ¥{item.budget.toLocaleString()}</Text>
                                                <Text className="text-sm font-black text-slate-900 dark:text-white">¥{item.spent.toLocaleString()}</Text>
                                            </View>
                                        </View>

                                        {/* プログレスバー */}
                                        <View className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <View
                                                className={`h-full ${progressColor}`}
                                                style={{ width: `${progress * 100}%` }}
                                            />
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
