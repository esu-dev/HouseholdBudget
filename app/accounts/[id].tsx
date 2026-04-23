import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, CircleEllipsis, MessageSquare, Store, Wallet } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
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

    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const availableCategories = useMemo(() => {
        const accountTxs = transactions.filter(t => t.account_id === id);
        const catIds = new Set(accountTxs.map(t => t.category_id));
        const cats: { id: string, label: string }[] = [];

        majorCategories.forEach(maj => {
            maj.subCategories.forEach(min => {
                if (catIds.has(min.id)) {
                    cats.push({ id: min.id, label: min.label });
                }
            });
        });
        return cats;
    }, [transactions, id, majorCategories]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesAccount = t.account_id === id;
            if (!matchesAccount) return false;
            if (selectedCategoryId) {
                return t.category_id === selectedCategoryId;
            }
            return true;
        });
    }, [transactions, id, selectedCategoryId]);

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
                    router.push('/edit-transaction');
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
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }} numberOfLines={1}>
                                {item.category_id === 'transfer' && toAccount
                                    ? `${item.amount > 0 ? '←' : '→'} ${toAccount.name}`
                                    : label}
                            </Text>
                            {item.payee && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                    <Store size={10} color={colors.textMuted} />
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 4 }} numberOfLines={1}>{item.payee}</Text>
                                </View>
                            )}
                            {item.memo && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                    <MessageSquare size={10} color={colors.textMuted} />
                                    <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 4 }} numberOfLines={1}>
                                        {item.memo}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: amount > 0 ? '#22c55e' : colors.text, minWidth: 80, textAlign: 'right' }}>
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
            <View style={{ backgroundColor: colors.indigo, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ marginBottom: 20 }}
                    hitSlop={{ top: 10, bottom: 10, left: 20, right: 10 }}
                >
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
                    <View style={{ paddingTop: 24, paddingBottom: 8 }}>
                        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>取引履歴</Text>
                        </View>

                        {availableCategories.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 8 }}
                            >
                                <TouchableOpacity
                                    onPress={() => setSelectedCategoryId(null)}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 20,
                                        backgroundColor: selectedCategoryId === null ? colors.indigo : colors.card,
                                        borderWidth: 1,
                                        borderColor: selectedCategoryId === null ? colors.indigo : colors.border
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: selectedCategoryId === null ? 'white' : colors.textMuted }}>
                                        すべて
                                    </Text>
                                </TouchableOpacity>
                                {availableCategories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        onPress={() => setSelectedCategoryId(cat.id)}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            backgroundColor: selectedCategoryId === cat.id ? colors.indigo : colors.card,
                                            borderWidth: 1,
                                            borderColor: selectedCategoryId === cat.id ? colors.indigo : colors.border
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: selectedCategoryId === cat.id ? 'white' : colors.textMuted }}>
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
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
