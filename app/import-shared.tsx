import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, ChevronRight, CreditCard, FileUp, Smartphone, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { csvImportService } from '../services/csvImportService';
import { useTransactionStore } from '../store/useTransactionStore';
import { CardType } from '../types/account';

export default function ImportSharedScreen() {
    const { uri } = useLocalSearchParams<{ uri: string }>();
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const { accounts, addTransactions } = useTransactionStore();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'type' | 'account'>('type');
    const [selectedType, setSelectedType] = useState<CardType | 'external' | null>(null);

    const isDark = colorScheme === 'dark';
    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        primary: '#6366f1',
        paypay: '#ff0033',
        bank: '#0066cc',
    };

    if (!uri) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <Text style={{ color: colors.text }}>ファイルが見つかりません</Text>
            </View>
        );
    }

    const handleTypeSelect = (type: CardType | 'external') => {
        if (type === 'external') {
            router.replace({
                pathname: '/settings/csv-import',
                params: { uri }
            });
            return;
        }
        setSelectedType(type);
        setStep('account');
    };

    const handleAccountSelect = async (accountId: string) => {
        if (!selectedType || selectedType === 'external') return;

        setIsLoading(true);
        try {
            const result = await csvImportService.parseCsvFromUri(uri, selectedType, accountId);

            if (result.missingMappings.length > 0) {
                // 紐付けが必要な場合は、一旦input画面に飛ばしてモーダルを出す等の対応が必要だが、
                // 今回は簡単のため、結果をAlertで出すか、既存のロジックに合わせる
                // 本来は input.tsx と同様のモーダルが必要だが、画面遷移の都合上、
                // 一旦「紐付け設定を完了してから再度お試しください」とするか、
                // ここでも紐付けモーダルを実装する。
                // ユーザー体験を優先し、アラートで案内する。
                Alert.alert('紐付けが必要です', '新しい取引口座が見つかりました。設定画面または入力画面から一度手動でインポートし、口座の紐付けを行ってください。');
                router.back();
                return;
            }

            if (result.transactions.length > 0) {
                await addTransactions(result.transactions);
                Alert.alert('完了', `${result.transactions.length}件の取引をインポートしました`);
                router.replace('/');
            } else {
                Alert.alert('情報', 'インポートする新しい取引はありませんでした');
                router.back();
            }
        } catch (error) {
            console.error(error);
            Alert.alert('エラー', 'CSVの解析に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{
                title: '共有ファイルを取り込む',
                headerShown: true,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
            }} />

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={{ alignItems: 'center', marginBottom: 30, marginTop: 10 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <FileUp size={32} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>CSVファイルのインポート</Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
                        取り込むCSVの形式を選択してください
                    </Text>
                </View>

                {step === 'type' ? (
                    <View style={{ gap: 12 }}>
                        <TypeOption
                            icon={<Smartphone color={colors.paypay} />}
                            title="PayPay"
                            description="PayPayの取引履歴CSV"
                            onPress={() => handleTypeSelect('paypay')}
                            colors={colors}
                        />
                        <TypeOption
                            icon={<Building2 color={colors.bank} />}
                            title="JP BANK カード"
                            description="ゆうちょ銀行の明細CSV"
                            onPress={() => handleTypeSelect('jp_bank')}
                            colors={colors}
                        />
                        <TypeOption
                            icon={<CreditCard color={colors.primary} />}
                            title="JCBカード"
                            description="JCBの明細CSV"
                            onPress={() => handleTypeSelect('jcb')}
                            colors={colors}
                        />
                        <TypeOption
                            icon={<Wallet color={colors.textMuted} />}
                            title="その他 (外部CSV)"
                            description="他のアプリ等の汎用CSV"
                            onPress={() => handleTypeSelect('external')}
                            colors={colors}
                        />
                    </View>
                ) : (
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 8, marginLeft: 4 }}>
                            インポート先の口座を選択
                        </Text>
                        {accounts
                            .filter(acc => {
                                if (selectedType === 'paypay') return acc.type === 'emoney';
                                if (selectedType === 'jp_bank' || selectedType === 'jcb') return acc.type === 'card';
                                return true;
                            })
                            .map(acc => (
                                <TouchableOpacity
                                    key={acc.id}
                                    onPress={() => handleAccountSelect(acc.id)}
                                    style={{
                                        backgroundColor: colors.card,
                                        padding: 16,
                                        borderRadius: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}
                                >
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                        {acc.type === 'card' ? <CreditCard size={20} color={colors.primary} /> : <Smartphone size={20} color={colors.paypay} />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{acc.name}</Text>
                                        <Text style={{ fontSize: 12, color: colors.textMuted }}>{acc.type === 'card' ? 'クレジットカード' : '電子マネー'}</Text>
                                    </View>
                                    <ChevronRight size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            ))}

                        <TouchableOpacity
                            onPress={() => setStep('type')}
                            style={{ marginTop: 20, alignItems: 'center' }}
                        >
                            <Text style={{ color: colors.primary }}>戻る</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isLoading && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background + '80', justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: 12, color: colors.text }}>解析中...</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

function TypeOption({ icon, title, description, onPress, colors }: any) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                backgroundColor: colors.card,
                padding: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border
            }}
        >
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                {icon}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{title}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{description}</Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );
}
