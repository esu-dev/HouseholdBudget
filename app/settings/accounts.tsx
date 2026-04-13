import { Stack, useRouter } from 'expo-router';
import { Building2, Check, ChevronLeft, CreditCard, Edit2, Plus, Trash2, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
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
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const { accounts, addAccount, updateAccount, deleteAccount, isLoading } = useTransactionStore();

    const [modalVisible, setModalVisible] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountName, setAccountName] = useState('');
    const [accountType, setAccountType] = useState<string>('cash');
    const [cardType, setCardType] = useState<CardType>('none');
    const [loginUrl, setLoginUrl] = useState('');

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        inputBg: isDark ? '#1e293b' : '#f1f5f9',
        indigo: '#6366f1',
    };

    const handleAddOrUpdate = async () => {
        if (!accountName.trim()) {
            Alert.alert('エラー', '名前を入力してください');
            return;
        }

        let formattedUrl = loginUrl.trim();
        if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }

        try {
            if (editingAccount) {
                await updateAccount({
                    id: editingAccount.id,
                    name: accountName,
                    type: accountType as any,
                    cardType: accountType === 'card' ? cardType : 'none',
                    loginUrl: formattedUrl || undefined,
                });
            } else {
                await addAccount({
                    id: Date.now().toString(),
                    name: accountName,
                    type: accountType as any,
                    cardType: accountType === 'card' ? cardType : 'none',
                    loginUrl: formattedUrl || undefined,
                });
            }
            setModalVisible(false);
            setAccountName('');
            setCardType('none');
            setLoginUrl('');
            setEditingAccount(null);
        } catch (e) {
            Alert.alert('エラー', '保存に失敗しました');
        }
    };

    const handleDelete = (id: string) => {
        // デフォルトのアカウントは削除できないようにする（簡易ガード）
        if (['cash', 'bank', 'card'].includes(id)) {
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

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: colors.card }}>
                <TouchableOpacity onPress={() => router.back()}>
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

                {accounts.map((account) => {
                    const typeInfo = ACCOUNT_TYPES.find(t => t.id === account.type) || ACCOUNT_TYPES[3];
                    const IconComp = typeInfo.icon;

                    return (
                        <View key={account.id} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: typeInfo.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                <IconComp size={22} color={typeInfo.color} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{account.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{typeInfo.label}</Text>
                                    {account.type === 'card' && account.cardType && account.cardType !== 'none' && (
                                        <Text style={{ fontSize: 10, color: colors.indigo, backgroundColor: colors.indigo + '10', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold' }}>
                                            {CARD_TYPES.find(ct => ct.id === account.cardType)?.label}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        setEditingAccount(account);
                                        setAccountName(account.name);
                                        setAccountType(account.type);
                                        setCardType(account.cardType || 'none');
                                        setLoginUrl(account.loginUrl || '');
                                        setModalVisible(true);
                                    }}
                                    style={{ padding: 8 }}
                                >
                                    <Edit2 size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                                {!['cash', 'bank', 'card'].includes(account.id) && (
                                    <TouchableOpacity onPress={() => handleDelete(account.id)} style={{ padding: 8 }}>
                                        <Trash2 size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}

                <TouchableOpacity 
                    onPress={() => {
                        setEditingAccount(null);
                        setAccountName('');
                        setAccountType('cash');
                        setModalVisible(true);
                    }}
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
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
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
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
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
                            <View style={{ marginBottom: 32 }}>
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
                </View>
            </Modal>
        </View>
    );
}
