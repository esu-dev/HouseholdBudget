import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, CircleEllipsis, Store, Wallet } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function AccountHistoryScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { transactions, accounts, accountBalances, setEditingTransaction, majorCategories } = useTransactionStore();

    const account = accounts.find(a => a.id === id);
    const balance = accountBalances[id as string] ?? 0;

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => t.account_id === id);
    }, [transactions, id]);

    const sectionedTransactions = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const sorted = [...filteredTransactions].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        sorted.forEach(t => {
            const dateObj = new Date(t.date);
            const dateStr = dateObj.toLocaleDateString('ja-JP', {
                year: 'numeric',
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

    const renderItem = ({ item }: { item: any }) => {
        if (item.type === 'header') {
            return (
                <View style={{ paddingHorizontal: 24, paddingVertical: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={12} color={colors.textMuted} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textMuted, marginLeft: 8 }}>
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

        const label = minorCategory?.label || '不明';
        const toAccount = item.to_account_id ? accounts.find(a => a.id === item.to_account_id) : null;
        const color = majorCategory?.color || '#64748b';
        const IconComp = CATEGORY_ICONS[majorCategory?.icon || 'others'] || CircleEllipsis;
        const amount = item.amount ?? 0;

        return (
            <TouchableOpacity
                onPress={() => {
                    setEditingTransaction(item);
                    router.replace('/input');
                }}
                style={{
                    backgroundColor: colors.card,
                    padding: 16,
                    borderRadius: 20,
                    marginBottom: 8,
                    marginHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1
                }}
            >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <IconComp size={22} color={color} />
                </View>

                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                                {item.category_id === 'transfer' && toAccount 
                                    ? `${item.amount > 0 ? '←' : '→'} ${toAccount.name}` 
                                    : label}
                            </Text>
                            {item.payee && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                    <Store size={10} color={colors.textMuted} />
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 4 }}>{item.payee}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: amount > 0 ? '#22c55e' : colors.text }}>
                            {amount > 0 ? '+' : ''}¥{amount.toLocaleString()}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header Area */}
            <View style={{ backgroundColor: colors.indigo, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 32, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Wallet size={20} color="rgba(255,255,255,0.7)" />
                    <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8, fontSize: 14 }}>{account?.name || 'アカウント'}</Text>
                </View>
                <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>¥{balance.toLocaleString()}</Text>
            </View>

            <FlashList
                data={sectionedTransactions}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.type === 'header' ? `header-${item.date}-${index}` : `item-${item.id}-${index}`}
                //estimatedItemSize={80}
                ListHeaderComponent={() => (
                    <View style={{ padding: 24, paddingBottom: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>取引履歴</Text>
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={{ padding: 60, alignItems: 'center' }}>
                        <Text style={{ color: colors.textMuted }}>このアカウントの取引履歴はありません</Text>
                    </View>
                )}
            />
        </View>
    );
}
