import { Stack, useRouter } from 'expo-router';
import {
    Calendar,
    CalendarClock,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleEllipsis,
    Pencil,
    Plus,
    Receipt,
    Repeat,
    Trash2,
    X,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';
import { CreateFixedExpenseInput, FixedExpense } from '../../types/fixedExpense';

export default function FixedExpensesScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';

    const {
        fixedExpenses,
        addFixedExpense,
        updateFixedExpense,
        deleteFixedExpense,
        toggleFixedExpenseActive,
        recordFixedExpensesForMonth,
        majorCategories,
        accounts,
        transactions,
    } = useTransactionStore();

    // Selected month for registration check (YYYY-MM)
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formCategoryId, setFormCategoryId] = useState('');
    const [formAccountId, setFormAccountId] = useState('');
    const [formPaymentDay, setFormPaymentDay] = useState('1');
    const [formPayee, setFormPayee] = useState('');
    const [formMemo, setFormMemo] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);
    const [formSelectedMajorId, setFormSelectedMajorId] = useState<string | null>(null);

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        indigoSub: isDark ? '#312e81' : '#eef2ff',
        inputBg: isDark ? '#0f172a' : '#f1f5f9',
        green: '#10b981',
        greenSub: isDark ? '#064e3b' : '#ecfdf5',
        amber: '#f59e0b',
        amberSub: isDark ? '#451a03' : '#fff7ed',
        danger: '#ef4444',
        dangerSub: isDark ? '#451a1a' : '#fef2f2',
    };

    const monthStr = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }, [selectedDate]);

    const changeMonth = (offset: number) => {
        const next = new Date(selectedDate);
        next.setMonth(next.getMonth() + offset);
        setSelectedDate(next);
    };

    // Filter expense categories only
    const expenseCategories = useMemo(() => {
        return majorCategories.filter(cat => cat.type === 'expense');
    }, [majorCategories]);

    // Active fixed expenses
    const activeFixedExpenses = useMemo(() => {
        return fixedExpenses.filter(e => e.is_active);
    }, [fixedExpenses]);

    // Total monthly fixed expense amount
    const totalMonthlyAmount = useMemo(() => {
        return activeFixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    }, [activeFixedExpenses]);

    // Check which fixed expenses are recorded for the selected month
    const recordedMap = useMemo(() => {
        const map: Record<number, boolean> = {};
        const prefix = `fixed_`;
        const suffix = `_${monthStr}`;

        transactions.forEach(t => {
            if (t.import_hash && t.import_hash.startsWith(prefix) && t.import_hash.endsWith(suffix)) {
                // hash format: fixed_{id}_{YYYY-MM}
                const parts = t.import_hash.split('_');
                if (parts.length >= 3) {
                    const id = parseInt(parts[1], 10);
                    if (!isNaN(id)) {
                        map[id] = true;
                    }
                }
            }
        });

        return map;
    }, [transactions, monthStr]);

    const recordedCount = useMemo(() => {
        return activeFixedExpenses.filter(e => recordedMap[e.id]).length;
    }, [activeFixedExpenses, recordedMap]);

    const unrecordedCount = activeFixedExpenses.length - recordedCount;

    // Fixed expense breakdown by major category
    const categoryTotals = useMemo(() => {
        const map: Record<string, { label: string; color: string; amount: number }> = {};
        activeFixedExpenses.forEach(e => {
            const major = expenseCategories.find(maj => maj.subCategories.some(sub => sub.id === e.category_id));
            const id = major?.id || 'others';
            if (!map[id]) {
                map[id] = {
                    label: major?.label || 'その他',
                    color: major?.color || '#64748b',
                    amount: 0,
                };
            }
            map[id].amount += e.amount;
        });
        return Object.values(map).sort((a, b) => b.amount - a.amount);
    }, [activeFixedExpenses, expenseCategories]);

    const handleOpenAdd = () => {
        setEditingExpense(null);
        setFormName('');
        setFormAmount('');
        // Default category to first available
        const firstMajor = expenseCategories[0];
        setFormSelectedMajorId(firstMajor?.id || null);
        setFormCategoryId(firstMajor?.subCategories[0]?.id || '');
        // Default account
        setFormAccountId(accounts[0]?.id || 'cash');
        setFormPaymentDay('25');
        setFormPayee('');
        setFormMemo('');
        setFormIsActive(true);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (expense: FixedExpense) => {
        setEditingExpense(expense);
        setFormName(expense.name);
        setFormAmount(expense.amount.toString());
        setFormCategoryId(expense.category_id);
        const parentMajor = expenseCategories.find(maj => maj.subCategories.some(sub => sub.id === expense.category_id));
        setFormSelectedMajorId(parentMajor?.id || null);
        setFormAccountId(expense.account_id);
        setFormPaymentDay(expense.payment_day.toString());
        setFormPayee(expense.payee || '');
        setFormMemo(expense.memo || '');
        setFormIsActive(expense.is_active);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const trimmedName = formName.trim();
        if (!trimmedName) {
            Alert.alert('入力エラー', '項目名を入力してください');
            return;
        }

        const parsedAmount = parseInt(formAmount, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('入力エラー', '正しい金額を入力してください');
            return;
        }

        if (!formCategoryId) {
            Alert.alert('入力エラー', 'カテゴリを選択してください');
            return;
        }

        if (!formAccountId) {
            Alert.alert('入力エラー', '出金口座を選択してください');
            return;
        }

        const parsedDay = parseInt(formPaymentDay, 10);
        const paymentDay = isNaN(parsedDay) ? 1 : Math.min(31, Math.max(1, parsedDay));

        try {
            if (editingExpense) {
                await updateFixedExpense({
                    id: editingExpense.id,
                    name: trimmedName,
                    amount: parsedAmount,
                    category_id: formCategoryId,
                    account_id: formAccountId,
                    payment_day: paymentDay,
                    payee: formPayee.trim() || null,
                    memo: formMemo.trim() || null,
                    is_active: formIsActive,
                });
                Alert.alert('完了', '固定支出を更新しました');
            } else {
                const input: CreateFixedExpenseInput = {
                    name: trimmedName,
                    amount: parsedAmount,
                    category_id: formCategoryId,
                    account_id: formAccountId,
                    payment_day: paymentDay,
                    payee: formPayee.trim() || null,
                    memo: formMemo.trim() || null,
                    is_active: formIsActive,
                };
                await addFixedExpense(input);
                Alert.alert('完了', '固定支出を追加しました');
            }
            setIsModalOpen(false);
        } catch (e) {
            Alert.alert('エラー', '保存に失敗しました');
        }
    };

    const handleDelete = (expense: FixedExpense) => {
        Alert.alert(
            '削除の確認',
            `固定支出「${expense.name}」を削除しますか？\n（過去に記帳された取引データは削除されません）`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteFixedExpense(expense.id);
                        } catch (e) {
                            Alert.alert('エラー', '削除に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    const handleBatchRecord = async () => {
        if (unrecordedCount === 0) {
            Alert.alert('確認', `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月分の固定支出はすべて記帳済みです。`);
            return;
        }

        Alert.alert(
            '固定支出の記帳',
            `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月分の未記帳な固定支出（${unrecordedCount}件）を取引履歴に記帳しますか？`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '記帳する',
                    onPress: async () => {
                        try {
                            const result = await recordFixedExpensesForMonth(monthStr);
                            Alert.alert('記帳完了', `${result.addedCount}件の取引を記帳しました。`);
                        } catch (e) {
                            Alert.alert('エラー', '記帳に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    const handleSingleRecord = async (expense: FixedExpense) => {
        Alert.alert(
            '固定支出の記帳',
            `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月分の「${expense.name}（¥${expense.amount.toLocaleString()}）」を取引履歴に記帳しますか？`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '記帳する',
                    onPress: async () => {
                        try {
                            const result = await recordFixedExpensesForMonth(monthStr, [expense.id]);
                            if (result.addedCount > 0) {
                                Alert.alert('記帳完了', `「${expense.name}」を記帳しました。`);
                            } else {
                                Alert.alert('確認', `すでに記帳されています。`);
                            }
                        } catch (e) {
                            Alert.alert('エラー', '記帳に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: '固定支出設定',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            style={{
                                minWidth: 44,
                                minHeight: 44,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: 4,
                            }}
                        >
                            <ChevronLeft size={24} color={colors.indigo} />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={handleOpenAdd}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.indigo,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16,
                                marginRight: 4,
                            }}
                        >
                            <Plus size={16} color="white" />
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13, marginLeft: 4 }}>追加</Text>
                        </TouchableOpacity>
                    ),
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                }}
            />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* 1. サマリーカード */}
                <View style={{ padding: 20 }}>
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 24,
                            padding: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 10,
                            elevation: 2,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 14,
                                        backgroundColor: colors.indigoSub,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Repeat size={22} color={colors.indigo} />
                                </View>
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: 'bold' }}>毎月の固定支出合計</Text>
                                    <Text style={{ fontSize: 24, fontWeight: 'black', color: colors.text, marginTop: 2 }}>
                                        ¥{totalMonthlyAmount.toLocaleString()}
                                    </Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <View
                                    style={{
                                        backgroundColor: activeFixedExpenses.length > 0 ? colors.indigoSub : (isDark ? '#334155' : '#f1f5f9'),
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        borderRadius: 12,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.indigo }}>
                                        {activeFixedExpenses.length}件 有効
                                    </Text>
                                </View>
                                {fixedExpenses.length !== activeFixedExpenses.length && (
                                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                                        (全{fixedExpenses.length}件中)
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* カテゴリ別内訳ピル */}
                        {categoryTotals.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                                {categoryTotals.map(item => (
                                    <View
                                        key={item.label}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: item.color + '15',
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 8,
                                        }}
                                    >
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 6 }} />
                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.text }}>
                                            {item.label}: ¥{item.amount.toLocaleString()}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* 2. 月別記帳セクション */}
                <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 20,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        {/* 月スイッチャー */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <TouchableOpacity
                                onPress={() => changeMonth(-1)}
                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.indigoSub, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <ChevronLeft size={18} color={colors.indigo} />
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Calendar size={16} color={colors.indigo} style={{ marginRight: 6 }} />
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                                    {selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => changeMonth(1)}
                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.indigoSub, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <ChevronRight size={18} color={colors.indigo} />
                            </TouchableOpacity>
                        </View>

                        {/* 記帳状況 */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>今月の記帳状況</Text>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: unrecordedCount === 0 && activeFixedExpenses.length > 0 ? colors.green : colors.amber }}>
                                {activeFixedExpenses.length === 0
                                    ? '固定費未登録'
                                    : `${recordedCount} / ${activeFixedExpenses.length} 件 記帳済み`}
                            </Text>
                        </View>

                        {/* 一括記帳ボタン */}
                        <TouchableOpacity
                            onPress={handleBatchRecord}
                            disabled={unrecordedCount === 0}
                            style={{
                                backgroundColor: unrecordedCount > 0 ? colors.indigo : (isDark ? '#334155' : '#e2e8f0'),
                                paddingVertical: 12,
                                borderRadius: 14,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                            }}
                        >
                            {unrecordedCount > 0 ? (
                                <>
                                    <Receipt size={16} color="white" style={{ marginRight: 6 }} />
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                                        今月分の未記帳（{unrecordedCount}件）を一括記帳する
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Check size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                                    <Text style={{ color: colors.textMuted, fontWeight: 'bold', fontSize: 13 }}>
                                        {activeFixedExpenses.length === 0 ? '固定支出を登録してください' : '今月分はすべて記帳済みです'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 3. 固定支出一覧 */}
                <View style={{ paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginLeft: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                            登録中の固定支出 ({fixedExpenses.length}件)
                        </Text>
                    </View>

                    {fixedExpenses.length === 0 ? (
                        <View
                            style={{
                                backgroundColor: colors.card,
                                borderRadius: 20,
                                padding: 32,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <CalendarClock size={48} color={colors.textMuted} />
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginTop: 16 }}>
                                固定支出が未登録です
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                                家賃、光熱費、サブスク、保険など{'\n'}毎月発生する支出を登録して効率的に管理しましょう。
                            </Text>
                            <TouchableOpacity
                                onPress={handleOpenAdd}
                                style={{
                                    backgroundColor: colors.indigo,
                                    paddingHorizontal: 20,
                                    paddingVertical: 12,
                                    borderRadius: 16,
                                    marginTop: 20,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <Plus size={16} color="white" />
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14, marginLeft: 6 }}>
                                    固定支出を追加する
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        fixedExpenses.map(expense => {
                            // Find category
                            let minorCategory = null;
                            let majorCategory = null;
                            for (const maj of expenseCategories) {
                                const min = maj.subCategories.find(s => s.id === expense.category_id);
                                if (min) {
                                    minorCategory = min;
                                    majorCategory = maj;
                                    break;
                                }
                            }

                            const IconComp = CATEGORY_ICONS[majorCategory?.icon || 'others'] || CircleEllipsis;
                            const account = accounts.find(a => a.id === expense.account_id);
                            const isRecorded = !!recordedMap[expense.id];

                            return (
                                <View
                                    key={expense.id}
                                    style={{
                                        backgroundColor: colors.card,
                                        borderRadius: 20,
                                        padding: 16,
                                        marginBottom: 12,
                                        borderWidth: 1,
                                        borderColor: expense.is_active ? colors.border : (isDark ? '#273549' : '#f1f5f9'),
                                        opacity: expense.is_active ? 1 : 0.6,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 2,
                                        elevation: 1,
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        {/* アイコンとタイトル */}
                                        <TouchableOpacity
                                            onPress={() => handleOpenEdit(expense)}
                                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}
                                        >
                                            <View
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 14,
                                                    backgroundColor: (majorCategory?.color || colors.indigo) + '20',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <IconComp size={22} color={majorCategory?.color || colors.indigo} />
                                            </View>
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }} numberOfLines={1}>
                                                        {expense.name}
                                                    </Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                        {minorCategory?.label || majorCategory?.label || '未分類'}
                                                    </Text>
                                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginHorizontal: 4 }}>•</Text>
                                                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                        {account?.name || '不明な口座'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>

                                        {/* 金額とスイッチ */}
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 18, fontWeight: 'black', color: colors.text }}>
                                                ¥{expense.amount.toLocaleString()}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Switch
                                                    value={expense.is_active}
                                                    onValueChange={(val) => toggleFixedExpenseActive(expense.id, val)}
                                                    trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: colors.indigo }}
                                                    thumbColor="white"
                                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    {/* 下段情報: 支払日、今月記帳状態、編集/削除 */}
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: 12,
                                            paddingTop: 10,
                                            borderTopWidth: 1,
                                            borderTopColor: isDark ? '#334155' : '#f1f5f9',
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View
                                                style={{
                                                    backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 3,
                                                    borderRadius: 8,
                                                }}
                                            >
                                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                                                    毎月 {expense.payment_day === 31 ? '月末' : `${expense.payment_day}日`}
                                                </Text>
                                            </View>

                                            {/* 今月の記帳バッジ */}
                                            {isRecorded ? (
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        backgroundColor: colors.greenSub,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 3,
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    <Check size={11} color={colors.green} style={{ marginRight: 3 }} />
                                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.green }}>
                                                        今月記帳済
                                                    </Text>
                                                </View>
                                            ) : expense.is_active ? (
                                                <TouchableOpacity
                                                    onPress={() => handleSingleRecord(expense)}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        backgroundColor: colors.indigoSub,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 3,
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    <Plus size={11} color={colors.indigo} style={{ marginRight: 3 }} />
                                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.indigo }}>
                                                        今月分を記帳
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <TouchableOpacity
                                                onPress={() => handleOpenEdit(expense)}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Pencil size={16} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDelete(expense)}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Trash2 size={16} color={colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* 追加・編集モーダル */}
            <Modal
                visible={isModalOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalOpen(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                >
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                            padding: 24,
                            maxHeight: '90%',
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                                {editingExpense ? '固定支出を編集' : '新しい固定支出を追加'}
                            </Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* 支出名 */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 }}>
                                支出項目名 <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.inputBg,
                                    color: colors.text,
                                    borderRadius: 12,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    fontSize: 16,
                                    marginBottom: 16,
                                }}
                                placeholder="例: 家賃、Netflix、インターネット回線"
                                placeholderTextColor={colors.textMuted}
                                value={formName}
                                onChangeText={setFormName}
                            />

                            {/* 金額 */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 }}>
                                毎月の金額（円） <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.inputBg,
                                    color: colors.text,
                                    borderRadius: 12,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    marginBottom: 16,
                                }}
                                placeholder="0"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                                value={formAmount}
                                onChangeText={text => setFormAmount(text.replace(/[^0-9]/g, ''))}
                            />

                            {/* 毎月の支払日 */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 }}>
                                毎月の支払日
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {[1, 10, 15, 20, 25, 27, 31].map(day => {
                                    const isSelected = formPaymentDay === day.toString();
                                    return (
                                        <TouchableOpacity
                                            key={day}
                                            onPress={() => setFormPaymentDay(day.toString())}
                                            style={{
                                                backgroundColor: isSelected ? colors.indigo : (isDark ? '#334155' : '#f1f5f9'),
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 10,
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: isSelected ? 'white' : colors.text }}>
                                                {day === 31 ? '月末' : `${day}日`}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <TextInput
                                style={{
                                    backgroundColor: colors.inputBg,
                                    color: colors.text,
                                    borderRadius: 12,
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    fontSize: 14,
                                    marginBottom: 16,
                                    width: 100,
                                }}
                                placeholder="1〜31"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                                value={formPaymentDay}
                                onChangeText={text => setFormPaymentDay(text.replace(/[^0-9]/g, ''))}
                            />

                            {/* カテゴリ選択 */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 }}>
                                カテゴリ <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            {/* 大カテゴリタブ */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {expenseCategories.map(cat => {
                                        const isSelected = formSelectedMajorId === cat.id;
                                        return (
                                            <TouchableOpacity
                                                key={cat.id}
                                                onPress={() => {
                                                    setFormSelectedMajorId(cat.id);
                                                    if (cat.subCategories.length > 0) {
                                                        setFormCategoryId(cat.subCategories[0].id);
                                                    }
                                                }}
                                                style={{
                                                    backgroundColor: isSelected ? cat.color : (isDark ? '#334155' : '#f1f5f9'),
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 6,
                                                    borderRadius: 12,
                                                }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: isSelected ? 'white' : colors.text }}>
                                                    {cat.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>

                            {/* 小カテゴリ選択 */}
                            {formSelectedMajorId && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                    {expenseCategories
                                        .find(c => c.id === formSelectedMajorId)
                                        ?.subCategories.map(sub => {
                                            const isSelected = formCategoryId === sub.id;
                                            return (
                                                <TouchableOpacity
                                                    key={sub.id}
                                                    onPress={() => setFormCategoryId(sub.id)}
                                                    style={{
                                                        backgroundColor: isSelected ? colors.indigo : (isDark ? '#1e293b' : 'white'),
                                                        borderWidth: 1,
                                                        borderColor: isSelected ? colors.indigo : colors.border,
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 6,
                                                        borderRadius: 10,
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? 'white' : colors.text }}>
                                                        {sub.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                </View>
                            )}

                            {/* 出金口座選択 */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 }}>
                                出金口座 <Text style={{ color: colors.danger }}>*</Text>
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                {accounts.map(acc => {
                                    const isSelected = formAccountId === acc.id;
                                    return (
                                        <TouchableOpacity
                                            key={acc.id}
                                            onPress={() => setFormAccountId(acc.id)}
                                            style={{
                                                backgroundColor: isSelected ? colors.indigo : (isDark ? '#1e293b' : 'white'),
                                                borderWidth: 1,
                                                borderColor: isSelected ? colors.indigo : colors.border,
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 10,
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? 'white' : colors.text }}>
                                                {acc.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* 支払先 (任意) */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 }}>
                                支払先（任意）
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.inputBg,
                                    color: colors.text,
                                    borderRadius: 12,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    fontSize: 15,
                                    marginBottom: 16,
                                }}
                                placeholder="例: Netflix、東京電力、NTT東日本"
                                placeholderTextColor={colors.textMuted}
                                value={formPayee}
                                onChangeText={setFormPayee}
                            />

                            {/* メモ (任意) */}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 }}>
                                メモ（任意）
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.inputBg,
                                    color: colors.text,
                                    borderRadius: 12,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    fontSize: 15,
                                    marginBottom: 16,
                                }}
                                placeholder="メモを入力"
                                placeholderTextColor={colors.textMuted}
                                value={formMemo}
                                onChangeText={setFormMemo}
                            />

                            {/* 有効/無効 */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingVertical: 4 }}>
                                <View>
                                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text }}>有効にする</Text>
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                                        無効にすると毎月の集計や一括記帳の対象から外れます
                                    </Text>
                                </View>
                                <Switch
                                    value={formIsActive}
                                    onValueChange={setFormIsActive}
                                    trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: colors.indigo }}
                                    thumbColor="white"
                                />
                            </View>

                            {/* 保存ボタン */}
                            <TouchableOpacity
                                onPress={handleSave}
                                style={{
                                    backgroundColor: colors.indigo,
                                    paddingVertical: 16,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    marginBottom: Platform.OS === 'ios' ? 24 : 12,
                                }}
                            >
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                                    {editingExpense ? '変更を保存する' : '固定支出を追加する'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </KeyboardAvoidingView>
    );
}
