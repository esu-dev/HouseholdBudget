import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Calendar, ChevronLeft, ChevronRight, CircleEllipsis, Store } from 'lucide-react-native';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CategoryDonutChart } from '../../components/CategoryDonutChart';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useTransactionStore } from '../../store/useTransactionStore';

// 履歴画面のヘッダー：支出分析（ドーナツチャート）のみを残す
const DashboardHeader = React.memo(({ 
    filteredTransactions 
}: any) => {
    return (
        <View className="p-4">
            <CategoryDonutChart transactions={filteredTransactions} />
            
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2 mt-2">
                履歴
            </Text>
        </View>
    );
});

export default function HomeScreen() {
    const router = useRouter();
    const { transactions, accounts, fetchData, setEditingTransaction, majorCategories } = useTransactionStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    useEffect(() => {
        fetchData();
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date);
            return (
                d.getMonth() === selectedMonth.getMonth() &&
                d.getFullYear() === selectedMonth.getFullYear()
            );
        });
    }, [transactions, selectedMonth]);

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
    };

    const renderItem = useCallback(({ item }: { item: any }) => {
        if (item.type === 'header') {
            return (
                <View className="px-6 py-2 mt-2 flex-row items-center">
                    <Calendar size={12} color="#94a3b8" />
                    <Text className="text-[12px] font-bold text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest">
                        {item.date}
                    </Text>
                </View>
            );
        }

        let minorCategory = null;
        let majorCategory = null;

        for (const maj of majorCategories) {
            const min = maj.subCategories.find(s => s.id === item.category_id);
            if (min) {
                minorCategory = min;
                majorCategory = maj;
                break;
            }
        }
        
        const account = accounts.find(a => a.id === item.account_id);
        const label = minorCategory?.label || '不明';
        const color = majorCategory?.color || '#64748b';
        const IconComp = CATEGORY_ICONS[majorCategory?.icon || 'others'] || CircleEllipsis;

        return (
            <TouchableOpacity
                onPress={() => {
                    setEditingTransaction(item);
                    router.push('/input');
                }}
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
                        <View>
                            <Text className="text-base font-bold text-slate-900 dark:text-white">
                                {label}
                            </Text>
                            <Text className="text-[10px] text-slate-400">
                                {majorCategory?.label}
                            </Text>
                        </View>
                        <Text className={`text-lg font-bold ${item.amount > 0 ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>
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
                </View>

                <View className="ml-2">
                    <ChevronRight size={20} color="#94a3b8" />
                </View>
            </TouchableOpacity>
        );
    }, [majorCategories, accounts]);

    const monthLabel = `${selectedMonth.getFullYear()}年 ${selectedMonth.getMonth() + 1}月`;

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-900">
            <View className="bg-white dark:bg-slate-800 px-4 py-4 flex-row justify-between items-center shadow-sm z-10">
                <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
                    <ChevronLeft size={24} color="#6366f1" />
                </TouchableOpacity>

                <Text className="text-lg font-bold text-slate-900 dark:text-white">
                    {monthLabel}
                </Text>

                <TouchableOpacity onPress={() => changeMonth(1)} className="p-2">
                    <ChevronRight size={24} color="#6366f1" />
                </TouchableOpacity>
            </View>

            <FlashList
                data={sectionedTransactions}
                keyExtractor={(item, index) => item.type === 'header' ? `header-${item.date}-${index}` : item.id?.toString() || `${index}`}
                renderItem={renderItem}
                getItemType={(item) => item.type}
                estimatedItemSize={80}
                ListHeaderComponent={
                    <DashboardHeader 
                        filteredTransactions={filteredTransactions}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
