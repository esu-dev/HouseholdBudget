import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, CircleEllipsis, EyeOff, MessageSquare, Plus, RotateCcw, Store, Wallet, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, Keyboard, Platform, InputAccessoryView } from 'react-native';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function AccountHistoryScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { transactions, accounts, accountBalances, setEditingTransaction, majorCategories, addTransaction } = useTransactionStore();

    const [isAdjustModalVisible, setIsAdjustModalVisible] = useState(false);
    const [newActualBalance, setNewActualBalance] = useState('');

    const account = accounts.find(a => a.id === id);
    const balance = accountBalances[id as string] ?? 0;

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        inputBg: isDark ? '#334155' : '#f1f5f9',
        indigo: '#6366f1',
    };

    const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null);
    const [selectedMinorId, setSelectedMinorId] = useState<string | null>(null);

    const handleAdjustBalance = async () => {
        const actualBalance = Number(newActualBalance);
        if (isNaN(actualBalance)) {
            Alert.alert('エラー', '有効な金額を入力してください');
            return;
        }

        const diff = actualBalance - balance;
        if (diff === 0) {
            setIsAdjustModalVisible(false);
            return;
        }

        try {
            await addTransaction({
                amount: diff,
                category_id: 'adjustment',
                account_id: id as string,
                date: new Date().toISOString(),
                memo: '残高調整による自動生成',
                payee: '残高調整'
            });
            setIsAdjustModalVisible(false);
            setNewActualBalance('');
            Alert.alert('完了', '残高を調整しました');
        } catch (e) {
            Alert.alert('エラー', '残高の調整に失敗しました');
        }
    };

    const availableMajors = useMemo(() => {
        const accountTxs = transactions.filter(t => t.account_id === id);
        const catIds = new Set(accountTxs.map(t => t.category_id));
        const hasTransfer = catIds.has('transfer');

        const majors = majorCategories.filter(maj =>
            maj.subCategories.some(min => catIds.has(min.id))
        ).map(maj => ({
            id: maj.id,
            label: maj.label,
            color: maj.color
        }));

        if (hasTransfer) {
            majors.push({ id: 'transfer', label: '振替', color: colors.indigo });
        }

        return majors;
    }, [transactions, id, majorCategories, colors.indigo]);

    const availableMinors = useMemo(() => {
        if (!selectedMajorId || selectedMajorId === 'transfer') return [];

        const accountTxs = transactions.filter(t => t.account_id === id);
        const catIds = new Set(accountTxs.map(t => t.category_id));

        const major = majorCategories.find(m => m.id === selectedMajorId);
        if (!major) return [];

        return major.subCategories.filter(min => catIds.has(min.id));
    }, [transactions, id, majorCategories, selectedMajorId]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesAccount = t.account_id === id;
            if (!matchesAccount) return false;

            if (selectedMajorId === 'transfer') {
                return t.category_id === 'transfer';
            }

            if (selectedMajorId) {
                if (selectedMinorId) {
                    return t.category_id === selectedMinorId;
                }
                // 大カテゴリに属する全小カテゴリをフィルタ対象にする
                const major = majorCategories.find(m => m.id === selectedMajorId);
                return major?.subCategories.some(min => min.id === t.category_id) ?? false;
            }

            return true;
        });
    }, [transactions, id, selectedMajorId, selectedMinorId, majorCategories]);

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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Wallet size={20} color="rgba(255,255,255,0.7)" />
                        <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8, fontSize: 14 }}>{account?.name || 'アカウント'}</Text>
                    </View>
                    {account?.excludeFromNetWorth && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <EyeOff size={12} color="white" />
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }}>純資産非計上</Text>
                        </View>
                    )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>¥{balance.toLocaleString()}</Text>
                    <TouchableOpacity
                        onPress={() => {
                            setNewActualBalance(balance.toString());
                            setIsAdjustModalVisible(true);
                        }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 12
                        }}
                    >
                        <RotateCcw size={14} color="white" />
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold', marginLeft: 6 }}>残高調整</Text>
                    </TouchableOpacity>
                </View>
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

                        {availableMajors.length > 0 && (
                            <View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 8 }}
                                >
                                    <TouchableOpacity
                                        onPress={() => {
                                            setSelectedMajorId(null);
                                            setSelectedMinorId(null);
                                        }}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            backgroundColor: selectedMajorId === null ? colors.indigo : colors.card,
                                            borderWidth: 1,
                                            borderColor: selectedMajorId === null ? colors.indigo : colors.border
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: selectedMajorId === null ? 'white' : colors.textMuted }}>
                                            すべて
                                        </Text>
                                    </TouchableOpacity>
                                    {availableMajors.map(maj => (
                                        <TouchableOpacity
                                            key={maj.id}
                                            onPress={() => {
                                                setSelectedMajorId(maj.id);
                                                setSelectedMinorId(null);
                                            }}
                                            style={{
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 20,
                                                backgroundColor: selectedMajorId === maj.id ? colors.indigo : colors.card,
                                                borderWidth: 1,
                                                borderColor: selectedMajorId === maj.id ? colors.indigo : colors.border
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: selectedMajorId === maj.id ? 'white' : colors.textMuted }}>
                                                {maj.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                {availableMinors.length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 16, paddingTop: 8 }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => setSelectedMinorId(null)}
                                            style={{
                                                paddingHorizontal: 14,
                                                paddingVertical: 6,
                                                borderRadius: 16,
                                                backgroundColor: selectedMinorId === null ? colors.indigo + '20' : colors.card,
                                                borderWidth: 1,
                                                borderColor: selectedMinorId === null ? colors.indigo : colors.border
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: selectedMinorId === null ? colors.indigo : colors.textMuted, fontWeight: selectedMinorId === null ? 'bold' : 'normal' }}>
                                                すべて
                                            </Text>
                                        </TouchableOpacity>
                                        {availableMinors.map(min => (
                                            <TouchableOpacity
                                                key={min.id}
                                                onPress={() => setSelectedMinorId(min.id)}
                                                style={{
                                                    paddingHorizontal: 14,
                                                    paddingVertical: 6,
                                                    borderRadius: 16,
                                                    backgroundColor: selectedMinorId === min.id ? colors.indigo + '20' : colors.card,
                                                    borderWidth: 1,
                                                    borderColor: selectedMinorId === min.id ? colors.indigo : colors.border
                                                }}
                                            >
                                                <Text style={{ fontSize: 12, color: selectedMinorId === min.id ? colors.indigo : colors.textMuted, fontWeight: selectedMinorId === min.id ? 'bold' : 'normal' }}>
                                                    {min.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={{ padding: 60, alignItems: 'center' }}>
                        <Text style={{ color: colors.textMuted }}>このアカウントの取引履歴はありません</Text>
                    </View>
                )}
            />

            {/* 残高調整モーダル */}
            <Modal
                visible={isAdjustModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsAdjustModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>残高の調整</Text>
                            <TouchableOpacity onPress={() => setIsAdjustModalVisible(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 8 }}>
                            実際の現在の残高を入力してください。
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>
                            家計簿上の残高との差分（¥{(Number(newActualBalance || 0) - balance).toLocaleString()}）を、自動的に調整用の取引として記録します。
                        </Text>

                        <View style={{ backgroundColor: colors.inputBg, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>実際の残高</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>¥</Text>
                                <TextInput
                                    autoFocus
                                    keyboardType="numeric"
                                    inputAccessoryViewID="balanceAdjustAccessory"
                                    style={{ flex: 1, fontSize: 24, fontWeight: 'bold', color: colors.text, marginLeft: 8 }}
                                    value={newActualBalance}
                                    onChangeText={setNewActualBalance}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                />
                                {Platform.OS === 'ios' && (
                                    <InputAccessoryView nativeID="balanceAdjustAccessory">
                                        <View style={{
                                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                            padding: 12,
                                            borderTopWidth: 1,
                                            borderTopColor: colors.border,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end',
                                            alignItems: 'center'
                                        }}>
                                            <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
                                                <Text style={{ color: colors.indigo, fontSize: 16, fontWeight: 'bold' }}>完了</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </InputAccessoryView>
                                )}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setIsAdjustModalVisible(false)}
                                style={{ flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: isDark ? '#334155' : '#f1f5f9' }}
                            >
                                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAdjustBalance}
                                style={{ flex: 2, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: colors.indigo }}
                            >
                                <Text style={{ fontWeight: 'bold', color: 'white' }}>残高を更新する</Text>
                            </TouchableOpacity>
                        </View>
                    </View>


                </View>
            </Modal>
        </View>
    );
}
