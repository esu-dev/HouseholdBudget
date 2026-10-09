import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    Coins,
    CreditCard,
    Edit2,
    Gift,
    Plus,
    RotateCcw,
    Smartphone,
    Sparkles,
    Trash2,
    Wallet,
    X,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { WishlistItem, WishlistSaving } from '../../types/wishlist';

export default function WishlistScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';

    const { accounts, accountBalances } = useTransactionStore();
    const {
        items,
        isLoading,
        fetchWishlist,
        createItem,
        updateItem,
        deleteItem,
        addSaving,
        removeSaving,
        getSavingsForItem,
    } = useWishlistStore();

    // Tab filter: 'saving' or 'completed'
    const [selectedTab, setSelectedTab] = useState<'saving' | 'completed'>('saving');

    // Modals
    const [isItemModalVisible, setIsItemModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);

    const [isSavingModalVisible, setIsSavingModalVisible] = useState(false);
    const [savingTargetItem, setSavingTargetItem] = useState<WishlistItem | null>(null);

    const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
    const [historyTargetItem, setHistoryTargetItem] = useState<WishlistItem | null>(null);
    const [itemSavings, setItemSavings] = useState<WishlistSaving[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Form state for Item
    const [formName, setFormName] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formMemo, setFormMemo] = useState('');
    const [formTargetDate, setFormTargetDate] = useState<Date | null>(null);
    const [showItemDatePicker, setShowItemDatePicker] = useState(false);
    const [formCategoryId, setFormCategoryId] = useState<string>('');

    // Form state for Saving (お金を移す)
    const [savingAccountId, setSavingAccountId] = useState('');
    const [savingAmount, setSavingAmount] = useState('');
    const [savingDate, setSavingDate] = useState<Date>(new Date());
    const [showSavingDatePicker, setShowSavingDatePicker] = useState(false);
    const [savingMemo, setSavingMemo] = useState('');
    const [isSubmittingSaving, setIsSubmittingSaving] = useState(false);

    useEffect(() => {
        fetchWishlist();
    }, []);

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : '#ffffff',
        cardSecondary: isDark ? '#273549' : '#f1f5f9',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        primary: '#ec4899', // Pink theme for wishlist/dreams
        primarySub: isDark ? '#831843' : '#fce7f3',
        indigo: '#6366f1',
        indigoSub: isDark ? '#312e81' : '#eef2ff',
        success: '#10b981',
        successSub: isDark ? '#064e3b' : '#d1fae5',
        warning: '#f59e0b',
        danger: '#ef4444',
    };

    // Filter items
    const savingItems = useMemo(() => items.filter((i) => i.status === 'saving'), [items]);
    const completedItems = useMemo(() => items.filter((i) => i.status === 'completed'), [items]);
    const currentList = selectedTab === 'saving' ? savingItems : completedItems;

    // Overall stats
    const totalTarget = useMemo(
        () => items.reduce((sum, item) => sum + item.target_amount, 0),
        [items]
    );
    const totalSaved = useMemo(
        () => items.reduce((sum, item) => sum + item.saved_amount, 0),
        [items]
    );
    const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

    // Open item modal for Create or Edit
    const handleOpenItemModal = (item?: WishlistItem) => {
        if (item) {
            setEditingItem(item);
            setFormName(item.name);
            setFormAmount(item.target_amount.toString());
            setFormMemo(item.memo || '');
            setFormCategoryId(item.category_id || '');
            setFormTargetDate(item.target_date ? new Date(item.target_date + 'T00:00:00') : null);
        } else {
            setEditingItem(null);
            setFormName('');
            setFormAmount('');
            setFormMemo('');
            setFormCategoryId('');
            setFormTargetDate(null);
        }
        setShowItemDatePicker(false);
        setIsItemModalVisible(true);
    };

    const handleSaveItem = async () => {
        if (!formName.trim()) {
            Alert.alert('入力エラー', '欲しいものの名前を入力してください');
            return;
        }
        const amountNum = parseInt(formAmount.replace(/[^0-9]/g, ''), 10);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('入力エラー', '有効な目標金額を入力してください');
            return;
        }

        const dateStr = formTargetDate
            ? `${formTargetDate.getFullYear()}-${String(formTargetDate.getMonth() + 1).padStart(2, '0')}-${String(formTargetDate.getDate()).padStart(2, '0')}`
            : null;

        try {
            if (editingItem) {
                await updateItem({
                    id: editingItem.id,
                    name: formName.trim(),
                    target_amount: amountNum,
                    memo: formMemo.trim() || null,
                    category_id: formCategoryId || null,
                    target_date: dateStr,
                });
            } else {
                await createItem({
                    name: formName.trim(),
                    target_amount: amountNum,
                    memo: formMemo.trim() || null,
                    category_id: formCategoryId || null,
                    target_date: dateStr,
                });
            }
            setIsItemModalVisible(false);
        } catch (e: any) {
            Alert.alert('エラー', e.message || '保存に失敗しました');
        }
    };

    // Open Saving modal
    const handleOpenSavingModal = (item: WishlistItem) => {
        setSavingTargetItem(item);
        // Default to first non-card account or 'cash'
        const defaultAcc = accounts.find((a) => !a.isHidden && a.type !== 'card') || accounts[0];
        setSavingAccountId(defaultAcc ? defaultAcc.id : 'cash');
        const remaining = Math.max(0, item.target_amount - item.saved_amount);
        setSavingAmount(remaining > 0 ? '' : '1000');
        setSavingDate(new Date());
        setSavingMemo('');
        setShowSavingDatePicker(false);
        setIsSavingModalVisible(true);
    };

    const handleExecuteSaving = async () => {
        if (!savingTargetItem) return;
        const amountNum = parseInt(savingAmount.replace(/[^0-9]/g, ''), 10);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('入力エラー', '有効な積立金額を入力してください');
            return;
        }
        if (!savingAccountId) {
            Alert.alert('入力エラー', '出金元口座を選択してください');
            return;
        }

        const sourceAccount = accounts.find((a) => a.id === savingAccountId);
        const sourceBalance = accountBalances[savingAccountId] || 0;

        if (sourceBalance < amountNum) {
            Alert.alert(
                '残高注意',
                `選択した口座「${sourceAccount?.name}」の残高（¥${sourceBalance.toLocaleString()}）が積立額（¥${amountNum.toLocaleString()}）を下回っています。このまま移しますか？`,
                [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: '続行する', onPress: () => doAddSaving(amountNum) },
                ]
            );
            return;
        }

        await doAddSaving(amountNum);
    };

    const doAddSaving = async (amountNum: number) => {
        if (!savingTargetItem) return;
        setIsSubmittingSaving(true);
        try {
            await addSaving({
                wishlist_id: savingTargetItem.id,
                account_id: savingAccountId,
                amount: amountNum,
                date: savingDate.toISOString(),
                memo: savingMemo.trim() || null,
            });
            setIsSavingModalVisible(false);
            Alert.alert('積立完了', `¥${amountNum.toLocaleString()} を「${savingTargetItem.name}」へ移しました！🎯`);
        } catch (e: any) {
            Alert.alert('エラー', e.message || '積立に失敗しました');
        } finally {
            setIsSubmittingSaving(false);
        }
    };

    // Open History modal
    const handleOpenHistoryModal = async (item: WishlistItem) => {
        setHistoryTargetItem(item);
        setIsHistoryModalVisible(true);
        setIsLoadingHistory(true);
        try {
            const savings = await getSavingsForItem(item.id);
            setItemSavings(savings);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleRemoveSingleSaving = (saving: WishlistSaving) => {
        const accName = accounts.find((a) => a.id === saving.account_id)?.name || '元の口座';
        Alert.alert(
            '積立の取り消し・口座へ戻す',
            `¥${saving.amount.toLocaleString()} を「${accName}」に戻しますか？\n出金取引も取り消されます。`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '口座に戻す',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeSaving(saving.id);
                            if (historyTargetItem) {
                                const updated = await getSavingsForItem(historyTargetItem.id);
                                setItemSavings(updated);
                            }
                            Alert.alert('完了', `¥${saving.amount.toLocaleString()} を「${accName}」に戻しました。`);
                        } catch (e: any) {
                            Alert.alert('エラー', e.message || '解除に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    // Delete item with guarantee that all savings are returned
    const handleDeleteItem = (item: WishlistItem) => {
        Alert.alert(
            '欲しいものの削除',
            `「${item.name}」を削除しますか？\n\nこれまでに積み立てた ¥${item.saved_amount.toLocaleString()} はすべて元の口座に戻り、積立取引もすべて削除されます。`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除する',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteItem(item.id);
                            Alert.alert('削除完了', `「${item.name}」を削除し、積立金はすべて口座へ戻しました。`);
                        } catch (e: any) {
                            Alert.alert('エラー', e.message || '削除に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    const handleToggleStatus = async (item: WishlistItem) => {
        const nextStatus = item.status === 'saving' ? 'completed' : 'saving';
        const msg = nextStatus === 'completed'
            ? `「${item.name}」を達成・購入済みにしますか？`
            : `「${item.name}」を貯金中に戻しますか？`;

        Alert.alert('ステータス変更', msg, [
            { text: 'キャンセル', style: 'cancel' },
            {
                text: '変更する',
                onPress: async () => {
                    await updateItem({ id: item.id, status: nextStatus });
                },
            },
        ]);
    };

    const getAccountInfo = (accId: string) => {
        const acc = accounts.find((a) => a.id === accId);
        if (!acc) return { name: '不明な口座', icon: Wallet, color: '#64748b' };
        if (acc.type === 'bank') return { name: acc.name, icon: Building2, color: '#3b82f6' };
        if (acc.type === 'card') return { name: acc.name, icon: CreditCard, color: '#ef4444' };
        if (acc.type === 'emoney') return { name: acc.name, icon: Smartphone, color: '#10b981' };
        return { name: acc.name, icon: Wallet, color: '#f59e0b' };
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header */}
            <View
                style={{
                    paddingTop: Platform.OS === 'ios' ? 56 : 40,
                    paddingHorizontal: 20,
                    paddingBottom: 16,
                    backgroundColor: colors.card,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.cardSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft size={20} color={colors.text} />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                        欲しいものリスト
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        計画的な目的別貯金
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => handleOpenItemModal()}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.primary,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        gap: 4,
                    }}
                >
                    <Plus size={16} color="white" />
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>追加</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                {/* Overall Summary Card */}
                <View
                    style={{
                        backgroundColor: colors.card,
                        padding: 20,
                        borderRadius: 28,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 6,
                        elevation: 2,
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    backgroundColor: colors.primarySub,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Sparkles size={18} color={colors.primary} />
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>
                                貯金進捗サマリー
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.primary }}>
                                {overallProgress}%
                            </Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View
                        style={{
                            height: 10,
                            backgroundColor: isDark ? '#334155' : '#f1f5f9',
                            borderRadius: 5,
                            overflow: 'hidden',
                            marginBottom: 16,
                        }}
                    >
                        <View
                            style={{
                                width: `${overallProgress}%`,
                                height: '100%',
                                backgroundColor: colors.primary,
                                borderRadius: 5,
                            }}
                        />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>現在の総積立額</Text>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.primary, marginTop: 2 }}>
                                ¥{totalSaved.toLocaleString()}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>目標合計額</Text>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 2 }}>
                                ¥{totalTarget.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Tabs Segment */}
                <View
                    style={{
                        flexDirection: 'row',
                        backgroundColor: colors.cardSecondary,
                        borderRadius: 16,
                        padding: 4,
                        marginBottom: 20,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => setSelectedTab('saving')}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 12,
                            alignItems: 'center',
                            backgroundColor: selectedTab === 'saving' ? colors.card : 'transparent',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: selectedTab === 'saving' ? 1 : 0 },
                            shadowOpacity: selectedTab === 'saving' ? 0.08 : 0,
                            shadowRadius: 2,
                            elevation: selectedTab === 'saving' ? 1 : 0,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: 'bold',
                                color: selectedTab === 'saving' ? colors.primary : colors.textMuted,
                            }}
                        >
                            貯金中 ({savingItems.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setSelectedTab('completed')}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 12,
                            alignItems: 'center',
                            backgroundColor: selectedTab === 'completed' ? colors.card : 'transparent',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: selectedTab === 'completed' ? 1 : 0 },
                            shadowOpacity: selectedTab === 'completed' ? 0.08 : 0,
                            shadowRadius: 2,
                            elevation: selectedTab === 'completed' ? 1 : 0,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: 'bold',
                                color: selectedTab === 'completed' ? colors.success : colors.textMuted,
                            }}
                        >
                            達成・購入済 ({completedItems.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Wishlist Items List */}
                {isLoading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                ) : currentList.length === 0 ? (
                    <View
                        style={{
                            backgroundColor: colors.card,
                            padding: 36,
                            borderRadius: 24,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: colors.border,
                            marginTop: 10,
                        }}
                    >
                        <Gift size={48} color={colors.textMuted} style={{ marginBottom: 12, opacity: 0.6 }} />
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>
                            {selectedTab === 'saving' ? '欲しいものを追加しましょう' : '達成済みのアイテムはありません'}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                            {selectedTab === 'saving'
                                ? '買いたいものや目標金額を登録して、\n口座から計画的にお金を積み立てられます。'
                                : '目標金額が貯まったアイテムはここに表示されます。'}
                        </Text>
                        {selectedTab === 'saving' && (
                            <TouchableOpacity
                                onPress={() => handleOpenItemModal()}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: colors.primary,
                                    paddingHorizontal: 20,
                                    paddingVertical: 12,
                                    borderRadius: 16,
                                    gap: 6,
                                }}
                            >
                                <Plus size={18} color="white" />
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>欲しいものを登録する</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    currentList.map((item) => {
                        const progress = item.target_amount > 0
                            ? Math.min(100, Math.round((item.saved_amount / item.target_amount) * 100))
                            : 0;
                        const remaining = Math.max(0, item.target_amount - item.saved_amount);

                        return (
                            <View
                                key={item.id}
                                style={{
                                    backgroundColor: colors.card,
                                    borderRadius: 24,
                                    padding: 20,
                                    marginBottom: 16,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 3,
                                    elevation: 1,
                                }}
                            >
                                {/* Item Header */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                                                {item.name}
                                            </Text>
                                            {item.status === 'completed' && (
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        backgroundColor: colors.successSub,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 2,
                                                        borderRadius: 8,
                                                        gap: 4,
                                                    }}
                                                >
                                                    <CheckCircle2 size={12} color={colors.success} />
                                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.success }}>達成</Text>
                                                </View>
                                            )}
                                        </View>
                                        {item.target_date && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                <Calendar size={12} color={colors.textMuted} />
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                    目標期日: {item.target_date.replace(/-/g, '/')}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Action icons */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <TouchableOpacity
                                            onPress={() => handleOpenItemModal(item)}
                                            style={{
                                                padding: 8,
                                                borderRadius: 10,
                                                backgroundColor: colors.cardSecondary,
                                            }}
                                        >
                                            <Edit2 size={15} color={colors.textMuted} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteItem(item)}
                                            style={{
                                                padding: 8,
                                                borderRadius: 10,
                                                backgroundColor: colors.cardSecondary,
                                            }}
                                        >
                                            <Trash2 size={15} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Memo if exists */}
                                {item.memo && (
                                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 16 }}>
                                        {item.memo}
                                    </Text>
                                )}

                                {/* Amounts & Progress */}
                                <View style={{ marginTop: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: item.status === 'completed' ? colors.success : colors.primary }}>
                                                ¥{item.saved_amount.toLocaleString()}
                                            </Text>
                                            <Text style={{ fontSize: 13, color: colors.textMuted }}>
                                                / ¥{item.target_amount.toLocaleString()}
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textMuted }}>
                                            {progress}%
                                        </Text>
                                    </View>

                                    <View
                                        style={{
                                            height: 8,
                                            backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: `${progress}%`,
                                                height: '100%',
                                                backgroundColor: item.status === 'completed' ? colors.success : colors.primary,
                                                borderRadius: 4,
                                            }}
                                        />
                                    </View>

                                    {item.status === 'saving' && remaining > 0 && (
                                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'right' }}>
                                            目標まで あと ¥{remaining.toLocaleString()}
                                        </Text>
                                    )}
                                </View>

                                {/* Buttons Row */}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
                                    <TouchableOpacity
                                        onPress={() => handleOpenSavingModal(item)}
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: colors.primary,
                                            paddingVertical: 10,
                                            borderRadius: 14,
                                            gap: 6,
                                        }}
                                    >
                                        <Coins size={16} color="white" />
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>お金を移す</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleOpenHistoryModal(item)}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: colors.cardSecondary,
                                            paddingHorizontal: 14,
                                            paddingVertical: 10,
                                            borderRadius: 14,
                                            gap: 6,
                                        }}
                                    >
                                        <Clock size={15} color={colors.text} />
                                        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 12 }}>履歴</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleToggleStatus(item)}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: item.status === 'completed' ? colors.cardSecondary : colors.successSub,
                                            paddingHorizontal: 14,
                                            paddingVertical: 10,
                                            borderRadius: 14,
                                            gap: 4,
                                        }}
                                    >
                                        <CheckCircle2 size={15} color={item.status === 'completed' ? colors.textMuted : colors.success} />
                                        <Text
                                            style={{
                                                color: item.status === 'completed' ? colors.textMuted : colors.success,
                                                fontWeight: 'bold',
                                                fontSize: 12,
                                            }}
                                        >
                                            {item.status === 'completed' ? '貯金中に戻す' : '達成済みにする'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Modal: 欲しいものを追加・編集 */}
            <Modal visible={isItemModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                >
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            maxHeight: '90%',
                            padding: 24,
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
                                {editingItem ? '欲しいものの編集' : '欲しいものを追加'}
                            </Text>
                            <TouchableOpacity onPress={() => setIsItemModalVisible(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Name */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>
                                欲しいものの名前 <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.cardSecondary,
                                    padding: 14,
                                    borderRadius: 14,
                                    fontSize: 16,
                                    color: colors.text,
                                    marginBottom: 16,
                                }}
                                placeholder="例: MacBook Air, 旅行資金, スニーカー"
                                placeholderTextColor={colors.textMuted}
                                value={formName}
                                onChangeText={setFormName}
                            />

                            {/* Amount */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>
                                目標金額 (円) <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.cardSecondary,
                                    padding: 14,
                                    borderRadius: 14,
                                    fontSize: 20,
                                    fontWeight: 'bold',
                                    color: colors.text,
                                    marginBottom: 16,
                                }}
                                placeholder="150000"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                                value={formAmount}
                                onChangeText={setFormAmount}
                            />

                            {/* Target Date */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>
                                目標期日（任意）
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (!formTargetDate) setFormTargetDate(new Date());
                                        setShowItemDatePicker(!showItemDatePicker);
                                    }}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: colors.cardSecondary,
                                        padding: 14,
                                        borderRadius: 14,
                                        gap: 10,
                                    }}
                                >
                                    <Calendar size={18} color={colors.primary} />
                                    <Text style={{ fontSize: 15, color: formTargetDate ? colors.text : colors.textMuted }}>
                                        {formTargetDate
                                            ? formTargetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
                                            : '日付を設定しない'}
                                    </Text>
                                </TouchableOpacity>
                                {formTargetDate && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setFormTargetDate(null);
                                            setShowItemDatePicker(false);
                                        }}
                                        style={{
                                            backgroundColor: colors.cardSecondary,
                                            paddingHorizontal: 16,
                                            borderRadius: 14,
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Text style={{ color: colors.danger, fontWeight: 'bold', fontSize: 12 }}>解除</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {showItemDatePicker && formTargetDate && (
                                <View style={{ marginBottom: 16 }}>
                                    <DateTimePicker
                                        value={formTargetDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        locale="ja-JP"
                                        themeVariant={isDark ? 'dark' : 'light'}
                                        onChange={(event, date) => {
                                            if (Platform.OS === 'android') setShowItemDatePicker(false);
                                            if (date) setFormTargetDate(date);
                                        }}
                                    />
                                </View>
                            )}

                            {/* Memo */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>
                                メモ・URL（任意）
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.cardSecondary,
                                    padding: 14,
                                    borderRadius: 14,
                                    fontSize: 15,
                                    color: colors.text,
                                    minHeight: 80,
                                    textAlignVertical: 'top',
                                    marginBottom: 24,
                                }}
                                placeholder="スペック、型番、欲しい理由など"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                value={formMemo}
                                onChangeText={setFormMemo}
                            />

                            <TouchableOpacity
                                onPress={handleSaveItem}
                                style={{
                                    backgroundColor: colors.primary,
                                    paddingVertical: 16,
                                    borderRadius: 18,
                                    alignItems: 'center',
                                    marginBottom: 16,
                                }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                                    {editingItem ? '更新する' : '登録する'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal: 口座からお金を移す（積立） */}
            <Modal visible={isSavingModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                >
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            maxHeight: '90%',
                            padding: 24,
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
                                    口座からお金を移す
                                </Text>
                                {savingTargetItem && (
                                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: 'bold', marginTop: 2 }}>
                                        対象: {savingTargetItem.name} (残り: ¥{Math.max(0, savingTargetItem.target_amount - savingTargetItem.saved_amount).toLocaleString()})
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setIsSavingModalVisible(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Source Account Selector */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 10 }}>
                                出金元の口座を選択 <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            <View style={{ gap: 8, marginBottom: 16 }}>
                                {accounts.filter((a) => !a.isHidden).map((acc) => {
                                    const isSelected = savingAccountId === acc.id;
                                    const accInfo = getAccountInfo(acc.id);
                                    const IconComp = accInfo.icon;
                                    const balance = accountBalances[acc.id] || 0;

                                    return (
                                        <TouchableOpacity
                                            key={acc.id}
                                            onPress={() => setSavingAccountId(acc.id)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: 14,
                                                borderRadius: 16,
                                                backgroundColor: isSelected ? colors.primarySub : colors.cardSecondary,
                                                borderWidth: 2,
                                                borderColor: isSelected ? colors.primary : 'transparent',
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <IconComp size={18} color={isSelected ? colors.primary : accInfo.color} />
                                                <Text style={{ fontSize: 15, fontWeight: 'bold', color: isSelected ? colors.primary : colors.text }}>
                                                    {acc.name}
                                                </Text>
                                            </View>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: isSelected ? colors.primary : colors.textMuted }}>
                                                残高: ¥{balance.toLocaleString()}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Amount Input */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>
                                積立金額 (円) <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.cardSecondary,
                                    padding: 14,
                                    borderRadius: 14,
                                    fontSize: 22,
                                    fontWeight: 'bold',
                                    color: colors.text,
                                    marginBottom: 10,
                                }}
                                placeholder="10000"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                                value={savingAmount}
                                onChangeText={setSavingAmount}
                            />

                            {/* Quick Amount Chips */}
                            {savingTargetItem && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                    {[1000, 3000, 5000, 10000, 30000].map((amt) => (
                                        <TouchableOpacity
                                            key={amt}
                                            onPress={() => {
                                                const current = parseInt(savingAmount.replace(/[^0-9]/g, ''), 10) || 0;
                                                setSavingAmount((current + amt).toString());
                                            }}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 10,
                                                backgroundColor: colors.cardSecondary,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text }}>
                                                +{amt.toLocaleString()}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                    {savingTargetItem.target_amount > savingTargetItem.saved_amount && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                const remaining = savingTargetItem.target_amount - savingTargetItem.saved_amount;
                                                setSavingAmount(remaining.toString());
                                            }}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 10,
                                                backgroundColor: colors.primarySub,
                                                borderWidth: 1,
                                                borderColor: colors.primary,
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary }}>
                                                残り全額
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* Date */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>
                                積立日
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowSavingDatePicker(!showSavingDatePicker)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: colors.cardSecondary,
                                    padding: 14,
                                    borderRadius: 14,
                                    gap: 10,
                                    marginBottom: 16,
                                }}
                            >
                                <Calendar size={18} color={colors.primary} />
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    {savingDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })}
                                </Text>
                            </TouchableOpacity>

                            {showSavingDatePicker && (
                                <View style={{ marginBottom: 16 }}>
                                    <DateTimePicker
                                        value={savingDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        locale="ja-JP"
                                        themeVariant={isDark ? 'dark' : 'light'}
                                        onChange={(event, date) => {
                                            if (Platform.OS === 'android') setShowSavingDatePicker(false);
                                            if (date) setSavingDate(date);
                                        }}
                                    />
                                </View>
                            )}

                            {/* Memo */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>
                                メモ（任意）
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.cardSecondary,
                                    padding: 14,
                                    borderRadius: 14,
                                    fontSize: 15,
                                    color: colors.text,
                                    marginBottom: 24,
                                }}
                                placeholder="例: 今月のボーナスから一部積立"
                                placeholderTextColor={colors.textMuted}
                                value={savingMemo}
                                onChangeText={setSavingMemo}
                            />

                            <View
                                style={{
                                    backgroundColor: colors.indigoSub,
                                    padding: 14,
                                    borderRadius: 14,
                                    marginBottom: 20,
                                }}
                            >
                                <Text style={{ fontSize: 11, color: colors.indigo, lineHeight: 16 }}>
                                    💡 口座からお金を移すと、口座残高から差し引かれます。生活費予算の計算からは自動的に除外されるため、今月の生活費には影響しません。
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleExecuteSaving}
                                disabled={isSubmittingSaving}
                                style={{
                                    backgroundColor: colors.primary,
                                    paddingVertical: 16,
                                    borderRadius: 18,
                                    alignItems: 'center',
                                    marginBottom: 16,
                                }}
                            >
                                {isSubmittingSaving ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                                        口座からお金を移す
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal: 積立履歴・内訳 */}
            <Modal visible={isHistoryModalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            height: '75%',
                            padding: 24,
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
                                    積立の履歴・内訳
                                </Text>
                                {historyTargetItem && (
                                    <Text style={{ fontSize: 13, color: colors.primary, fontWeight: 'bold', marginTop: 2 }}>
                                        {historyTargetItem.name}（合計積立: ¥{historyTargetItem.saved_amount.toLocaleString()}）
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {isLoadingHistory ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                        ) : itemSavings.length === 0 ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Coins size={40} color={colors.textMuted} style={{ marginBottom: 10, opacity: 0.5 }} />
                                <Text style={{ fontSize: 14, color: colors.textMuted }}>
                                    まだ積立の履歴はありません
                                </Text>
                            </View>
                        ) : (
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                {itemSavings.map((s) => {
                                    const accInfo = getAccountInfo(s.account_id);
                                    const IconComp = accInfo.icon;

                                    return (
                                        <View
                                            key={s.id}
                                            style={{
                                                backgroundColor: colors.cardSecondary,
                                                padding: 16,
                                                borderRadius: 16,
                                                marginBottom: 10,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            <View style={{ flex: 1, marginRight: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <IconComp size={16} color={accInfo.color} />
                                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>
                                                        {accInfo.name}
                                                    </Text>
                                                </View>
                                                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                                                    {s.date.split('T')[0].replace(/-/g, '/')}
                                                    {s.memo ? ` | ${s.memo}` : ''}
                                                </Text>
                                            </View>

                                            <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary }}>
                                                    +¥{s.amount.toLocaleString()}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => handleRemoveSingleSaving(s)}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        backgroundColor: colors.card,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        borderRadius: 8,
                                                        gap: 4,
                                                    }}
                                                >
                                                    <RotateCcw size={11} color={colors.danger} />
                                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.danger }}>
                                                        口座に戻す
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
