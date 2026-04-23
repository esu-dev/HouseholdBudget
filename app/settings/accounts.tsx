import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { Building2, Calendar, Check, ChevronDown, ChevronLeft, ChevronUp, CreditCard, Edit2, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';
import { Account, CardType } from '../../types/account';

const ACCOUNT_TYPES = [
    { id: 'cash', label: '現金', icon: Wallet, color: '#f59e0b' },
    { id: 'bank', label: '銀行口座', icon: Building2, color: '#3b82f6' },
    { id: 'card', label: 'クレジットカード', icon: CreditCard, color: '#ef4444' },
    { id: 'others', label: 'その他', icon: Wallet, color: '#64748b' },
];

const CARD_TYPES: { id: CardType; label: string }[] = [
    { id: 'none', label: '設定なし' },
    { id: 'jp_bank', label: 'JP BANKカード' },
    { id: 'jcb', label: 'JCBカード' },
];

export default function AccountManagementScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';

    const { accounts, addAccount, updateAccount, deleteAccount, syncCardTransfers, reorderAccounts, isLoading } = useTransactionStore();

    const [modalVisible, setModalVisible] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountName, setAccountName] = useState('');
    const [accountType, setAccountType] = useState<string>('cash');
    const [cardType, setCardType] = useState<CardType>('none');
    const [loginUrl, setLoginUrl] = useState('');
    const [closingDay, setClosingDay] = useState('');
    const [withdrawalDay, setWithdrawalDay] = useState('');
    const [withdrawalAccountId, setWithdrawalAccountId] = useState<string | undefined>(undefined);
    const [billingStartDate, setBillingStartDate] = useState('');
    const [showBillingMonthPicker, setShowBillingMonthPicker] = useState(false);

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        inputBg: isDark ? '#1e293b' : '#f1f5f9',
        indigo: '#6366f1',
    };

    const { cashAccount, otherAccounts } = React.useMemo(() => {
        return {
            cashAccount: accounts.find(a => a.id === 'cash'),
            otherAccounts: accounts.filter(a => a.id !== 'cash')
        };
    }, [accounts]);

    const handleAddOrUpdate = async () => {
        if (!accountName.trim()) {
            Alert.alert('エラー', '名前を入力してください');
            return;
        }

        let formattedUrl = loginUrl.trim();
        if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }

        const closingDayNum = accountType === 'card' && closingDay ? parseInt(closingDay) : undefined;
        const withdrawalDayNum = accountType === 'card' && withdrawalDay ? parseInt(withdrawalDay) : undefined;

        try {
            if (editingAccount) {
                await updateAccount({
                    id: editingAccount.id,
                    name: accountName,
                    type: accountType as any,
                    cardType: accountType === 'card' ? cardType : 'none',
                    loginUrl: formattedUrl || undefined,
                    closingDay: closingDayNum,
                    withdrawalDay: withdrawalDayNum,
                    withdrawalAccountId: accountType === 'card' ? withdrawalAccountId : undefined,
                    billingStartDate: accountType === 'card' ? billingStartDate : undefined,
                    displayOrder: editingAccount.displayOrder ?? 0
                });
            } else {
                await addAccount({
                    id: Date.now().toString(),
                    name: accountName,
                    type: accountType as any,
                    cardType: accountType === 'card' ? cardType : 'none',
                    loginUrl: formattedUrl || undefined,
                    closingDay: closingDayNum,
                    withdrawalDay: withdrawalDayNum,
                    withdrawalAccountId: accountType === 'card' ? withdrawalAccountId : undefined,
                    billingStartDate: accountType === 'card' ? billingStartDate : undefined,
                    displayOrder: accounts.length
                });
            }
            setModalVisible(false);
            setAccountName('');
            setCardType('none');
            setLoginUrl('');
            setClosingDay('');
            setWithdrawalDay('');
            setWithdrawalAccountId(undefined);
            setBillingStartDate('');
            setEditingAccount(null);
            setModalVisible(false);
        } catch (e) {
            Alert.alert('エラー', '保存に失敗しました');
        }
    };

    const handleSync = async (accountId: string) => {
        const account = accounts.find(a => a.id === accountId);
        if (!account || !account.withdrawalAccountId || account.withdrawalDay == null) {
            Alert.alert('設定不足', '引き落とし口座と引き落とし日が設定されている必要があります。');
            return;
        }

        try {
            const now = new Date();
            // 今月と先月、来月分を同期
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            await syncCardTransfers(accountId, now.toISOString());
            await syncCardTransfers(accountId, lastMonth.toISOString());
            await syncCardTransfers(accountId, nextMonth.toISOString());

            Alert.alert('同期完了', `${account.name} の最近の振替を更新しました。`);
        } catch (e) {
            Alert.alert('エラー', '振替の同期に失敗しました');
        }
    };

    const handleDelete = (id: string) => {
        if (id === 'cash') {
            Alert.alert('エラー', 'このアカウントは削除できません');
            return;
        }

        Alert.alert('確認', 'このアカウントを削除しますか？\n関連する取引も削除される可能性があります。', [
            { text: 'キャンセル', style: 'cancel' },
            {
                text: '削除',
                style: 'destructive',
                onPress: async () => {
                    await deleteAccount(id);
                }
            }
        ]);
    };

    const formatDayLabel = (day: number | undefined) => {
        if (day === undefined || day === null) return null;
        if (day === 0) return '末日';
        return `${day}日`;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.card }}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 15, bottom: 15, left: 30, right: 15 }}>
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text, marginRight: 28 }}>
                    口座・アカウント設定
                </Text>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                    登録済みのアカウント
                </Text>

                {/* 口座リストの描画 */}
                {(() => {
                    const renderAccountItem = (account: Account, index: number, isOther: boolean) => {
                        const typeInfo = ACCOUNT_TYPES.find(t => t.id === account.type) || ACCOUNT_TYPES[3];
                        const IconComp = typeInfo.icon;

                        return (
                            <View key={account.id} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: typeInfo.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                    <IconComp size={22} color={typeInfo.color} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{account.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                        <Text style={{ fontSize: 12, color: colors.textMuted }}>{typeInfo.label}</Text>
                                        {account.type === 'card' && account.cardType && account.cardType !== 'none' && (
                                            <Text style={{ fontSize: 10, color: colors.indigo, backgroundColor: colors.indigo + '10', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold' }}>
                                                {CARD_TYPES.find(ct => ct.id === account.cardType)?.label}
                                            </Text>
                                        )}
                                        {account.type === 'card' && (account.closingDay !== undefined || account.withdrawalDay !== undefined) && (
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                （〆:{formatDayLabel(account.closingDay) || '-'} / 引:{formatDayLabel(account.withdrawalDay) || '-'}）
                                                {account.billingStartDate ? ` [始:${account.billingStartDate}]` : ''}
                                            </Text>
                                        )}
                                        {account.type === 'card' && account.withdrawalAccountId && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Building2 size={10} color={colors.textMuted} />
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                    {accounts.find(a => a.id === account.withdrawalAccountId)?.name || '不明な口座'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    {/* 並び替えボタン */}
                                    {isOther && (
                                        <View style={{ flexDirection: 'column', marginRight: 4 }}>
                                            <TouchableOpacity
                                                disabled={index === 0}
                                                onPress={() => reorderAccounts(index, index - 1)}
                                                hitSlop={{ top: 10, bottom: 5, left: 10, right: 10 }}
                                                style={{ padding: 4, opacity: index === 0 ? 0.3 : 1 }}
                                            >
                                                <ChevronUp size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                disabled={index === otherAccounts.length - 1}
                                                onPress={() => reorderAccounts(index, index + 1)}
                                                hitSlop={{ top: 5, bottom: 10, left: 10, right: 10 }}
                                                style={{ padding: 4, opacity: index === otherAccounts.length - 1 ? 0.3 : 1 }}
                                            >
                                                <ChevronDown size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {account.type === 'card' && account.withdrawalAccountId && (
                                        <TouchableOpacity
                                            onPress={() => handleSync(account.id)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={{ padding: 8 }}
                                        >
                                            <RefreshCw size={20} color={colors.indigo} />
                                        </TouchableOpacity>
                                    )}
                                    {/* 編集ボタン */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            setEditingAccount(account);
                                            setAccountName(account.name);
                                            setAccountType(account.type);
                                            setCardType(account.cardType || 'none');
                                            setLoginUrl(account.loginUrl || '');
                                            setClosingDay(account.closingDay !== undefined ? account.closingDay?.toString() : '');
                                            setWithdrawalDay(account.withdrawalDay !== undefined ? account.withdrawalDay?.toString() : '');
                                            setWithdrawalAccountId(account.withdrawalAccountId);
                                            setBillingStartDate(account.billingStartDate || '');
                                            setModalVisible(true);
                                        }}
                                        hitSlop={{ top: 30, bottom: 10, left: 10, right: 10 }}
                                        style={{ padding: 8 }}
                                    >
                                        <Edit2 size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    {account.id !== 'cash' && (
                                        <TouchableOpacity
                                            onPress={() => handleDelete(account.id)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={{ padding: 8 }}
                                        >
                                            <Trash2 size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    };

                    return (
                        <>
                            {cashAccount && renderAccountItem(cashAccount, -1, false)}
                            {otherAccounts.map((account, index) => renderAccountItem(account, index, true))}
                        </>
                    );
                })()}

                <TouchableOpacity
                    onPress={() => {
                        setEditingAccount(null);
                        setAccountName('');
                        setAccountType('cash');
                        setClosingDay('');
                        setWithdrawalDay('');
                        setWithdrawalAccountId(undefined);
                        setBillingStartDate('');
                        setModalVisible(true);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: colors.indigo,
                        borderStyle: 'dashed',
                        marginTop: 12,
                        marginBottom: 40
                    }}
                >
                    <Plus size={20} color={colors.indigo} />
                    <Text style={{ marginLeft: 8, fontWeight: 'bold', color: colors.indigo }}>新しいアカウントを追加</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Modal for Add/Edit */}
            <Modal
                transparent
                visible={modalVisible}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={{ paddingTop: 24, flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <ScrollView bounces={false} style={{ flexGrow: 0 }}>
                        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 24 }}>
                                {editingAccount ? 'アカウントを編集' : 'アカウントを追加'}
                            </Text>

                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>名前</Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.inputBg,
                                    padding: 16,
                                    borderRadius: 16,
                                    fontSize: 16,
                                    color: colors.text,
                                    marginBottom: 20
                                }}
                                placeholder="例: 〇〇銀行、お財布"
                                placeholderTextColor={colors.textMuted}
                                value={accountName}
                                onChangeText={setAccountName}
                            />

                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>ログインURL (任意)</Text>
                            <TextInput
                                style={{
                                    backgroundColor: colors.inputBg,
                                    padding: 16,
                                    borderRadius: 16,
                                    fontSize: 16,
                                    color: colors.text,
                                    marginBottom: 24
                                }}
                                placeholder="https://..."
                                placeholderTextColor={colors.textMuted}
                                value={loginUrl}
                                onChangeText={setLoginUrl}
                                autoCapitalize="none"
                                keyboardType="url"
                            />

                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12 }}>種類</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                                {ACCOUNT_TYPES.map((t) => {
                                    const isSelected = accountType === t.id;
                                    const TIcon = t.icon;
                                    return (
                                        <TouchableOpacity
                                            key={t.id}
                                            onPress={() => setAccountType(t.id)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 12,
                                                borderRadius: 16,
                                                backgroundColor: isSelected ? colors.indigo : colors.inputBg,
                                                borderWidth: 2,
                                                borderColor: isSelected ? colors.indigo : 'transparent'
                                            }}
                                        >
                                            <TIcon size={18} color={isSelected ? 'white' : colors.textMuted} />
                                            <Text style={{ marginLeft: 8, fontWeight: 'bold', color: isSelected ? 'white' : colors.textMuted }}>
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {accountType === 'card' && (
                                <View style={{ marginBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>締め日</Text>
                                            <TextInput
                                                style={{ backgroundColor: colors.inputBg, padding: 16, borderRadius: 16, fontSize: 16, color: colors.text }}
                                                placeholder="例: 15"
                                                placeholderTextColor={colors.textMuted}
                                                value={closingDay}
                                                onChangeText={setClosingDay}
                                                keyboardType="numeric"
                                                maxLength={2}
                                            />
                                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>※末日の場合は0</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>引き落とし日</Text>
                                            <TextInput
                                                style={{ backgroundColor: colors.inputBg, padding: 16, borderRadius: 16, fontSize: 16, color: colors.text }}
                                                placeholder="例: 10"
                                                placeholderTextColor={colors.textMuted}
                                                value={withdrawalDay}
                                                onChangeText={setWithdrawalDay}
                                                keyboardType="numeric"
                                                maxLength={2}
                                            />
                                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>※末日の場合は0</Text>
                                        </View>
                                    </View>

                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8 }}>自動振替の開始月</Text>
                                        <TouchableOpacity
                                            onPress={() => setShowBillingMonthPicker(true)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: colors.inputBg,
                                                padding: 16,
                                                borderRadius: 16,
                                            }}
                                        >
                                            <Calendar size={20} color={colors.textMuted} />
                                            <Text style={{ marginLeft: 12, fontSize: 16, color: billingStartDate ? colors.text : colors.textMuted }}>
                                                {billingStartDate || '選択してください'}
                                            </Text>
                                        </TouchableOpacity>
                                        {showBillingMonthPicker && (
                                            <View>
                                                {Platform.OS === 'ios' && (
                                                    <TouchableOpacity onPress={() => setShowBillingMonthPicker(false)} style={{ alignItems: 'flex-end', padding: 8 }}>
                                                        <Text style={{ color: colors.indigo, fontWeight: 'bold' }}>完了</Text>
                                                    </TouchableOpacity>
                                                )}
                                                <DateTimePicker
                                                    value={billingStartDate ? new Date(billingStartDate + '-01') : new Date()}
                                                    mode="date"
                                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                    locale="ja-JP"
                                                    onChange={(event, date) => {
                                                        if (Platform.OS === 'android') setShowBillingMonthPicker(false);
                                                        if (date) {
                                                            const y = date.getFullYear();
                                                            const m = String(date.getMonth() + 1).padStart(2, '0');
                                                            setBillingStartDate(`${y}-${m}`);
                                                        }
                                                    }}
                                                />
                                            </View>
                                        )}
                                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>※この月以降のサイクル分（締め日基準）を自動計算します。</Text>
                                    </View>

                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12 }}>引き落とし口座</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                                        <TouchableOpacity
                                            onPress={() => setWithdrawalAccountId(undefined)}
                                            style={{
                                                paddingHorizontal: 16,
                                                paddingVertical: 10,
                                                borderRadius: 12,
                                                backgroundColor: withdrawalAccountId === undefined ? colors.indigo : colors.inputBg,
                                                borderWidth: 1,
                                                borderColor: withdrawalAccountId === undefined ? colors.indigo : colors.border
                                            }}
                                        >
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: withdrawalAccountId === undefined ? 'white' : colors.text }}>設定なし</Text>
                                        </TouchableOpacity>
                                        {accounts.filter(a => a.type === 'bank' || a.type === 'cash').map(acc => (
                                            <TouchableOpacity
                                                key={acc.id}
                                                onPress={() => setWithdrawalAccountId(acc.id)}
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 10,
                                                    borderRadius: 12,
                                                    backgroundColor: withdrawalAccountId === acc.id ? colors.indigo : colors.inputBg,
                                                    borderWidth: 1,
                                                    borderColor: withdrawalAccountId === acc.id ? colors.indigo : colors.border
                                                }}
                                            >
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: withdrawalAccountId === acc.id ? 'white' : colors.text }}>{acc.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12 }}>CSV形式設定（カードの種類）</Text>
                                    <View style={{ gap: 8 }}>
                                        {CARD_TYPES.map((ct) => {
                                            const isSelected = cardType === ct.id;
                                            return (
                                                <TouchableOpacity
                                                    key={ct.id}
                                                    onPress={() => setCardType(ct.id)}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: 16,
                                                        borderRadius: 16,
                                                        backgroundColor: colors.inputBg,
                                                        borderWidth: 2,
                                                        borderColor: isSelected ? colors.indigo : 'transparent'
                                                    }}
                                                >
                                                    <Text style={{ fontWeight: 'bold', color: isSelected ? colors.indigo : colors.text }}>
                                                        {ct.label}
                                                    </Text>
                                                    {isSelected && <Check size={18} color={colors.indigo} />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => setModalVisible(false)}
                                    style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: isDark ? '#334155' : '#f1f5f9', alignItems: 'center' }}
                                >
                                    <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleAddOrUpdate}
                                    style={{ flex: 2, padding: 16, borderRadius: 16, backgroundColor: colors.indigo, alignItems: 'center' }}
                                >
                                    <Text style={{ fontWeight: 'bold', color: 'white' }}>
                                        {editingAccount ? '更新する' : '追加する'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}