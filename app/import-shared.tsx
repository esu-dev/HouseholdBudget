import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, ChevronRight, CreditCard, FileUp, Smartphone, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { csvImportService } from '../services/csvImportService';
import { useTransactionStore } from '../store/useTransactionStore';
import { CardType } from '../types/account';
import { databaseService } from '../services/database';
import { CreateTransactionInput } from '../types/transaction';

export default function ImportSharedScreen() {
    const { uri } = useLocalSearchParams<{ uri: string }>();
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const { accounts, addTransactions, fetchData } = useTransactionStore();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'type' | 'account' | 'mapping'>('type');
    const [selectedType, setSelectedType] = useState<CardType | 'external' | null>(null);
    const [missingMappings, setMissingMappings] = useState<string[]>([]);
    const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
    const [pendingTransactions, setPendingTransactions] = useState<CreateTransactionInput[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [rawData, setRawData] = useState<string[][]>([]);

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
                <Text style={{ color: colors.text, marginBottom: 20 }}>ファイルが見つかりません</Text>
                <TouchableOpacity
                    onPress={() => router.replace('/')}
                    style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 12 }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>ホームに戻る</Text>
                </TouchableOpacity>
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
            setSelectedAccountId(accountId);
            setRawData(result.rawData || []);

            if (result.missingMappings.length > 0) {
                setMissingMappings(result.missingMappings);
                setStep('mapping');
                return;
            }

            if (result.transactions.length > 0) {
                await databaseService.updateLastImportedAt(accountId, new Date().toISOString());
                await addTransactions(result.transactions);
                Alert.alert('完了', `${result.transactions.length}件の取引をインポートしました`);
                router.replace('/');
            } else {
                await databaseService.updateLastImportedAt(accountId, new Date().toISOString());
                await fetchData();
                Alert.alert('情報', 'インポートする新しい取引はありませんでした');
                router.replace('/');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('エラー', 'CSVの解析に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMappingComplete = async () => {
        if (!selectedType || !selectedAccountId) return;

        setIsLoading(true);
        try {
            // Save mappings to database
            for (const [extName, intId] of Object.entries(accountMappings)) {
                await databaseService.updateCsvAccountMapping(extName, intId);
            }

            // Re-parse with new mappings
            // We need to fetch all current mappings and transactions again for consistency
            const mappings = await databaseService.getAllPayeeCategoryMappings();
            const existingTransactions = await databaseService.getAllTransactions();
            const dbAccountMappings = await databaseService.getAllCsvAccountMappings();

            const { transactions } = csvImportService.mapCsvToTransactions(
                rawData,
                selectedType,
                selectedAccountId,
                mappings,
                existingTransactions,
                dbAccountMappings
            );

            if (transactions.length > 0) {
                await databaseService.updateLastImportedAt(selectedAccountId, new Date().toISOString());
                await addTransactions(transactions);
                Alert.alert('完了', `${transactions.length}件の取引をインポートしました`);
                router.replace('/');
            } else {
                await databaseService.updateLastImportedAt(selectedAccountId, new Date().toISOString());
                await fetchData();
                Alert.alert('情報', 'インポートする取引はありませんでした');
                router.replace('/');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('エラー', '保存またはインポートに失敗しました');
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
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.replace('/')} style={{ marginLeft: 8 }}>
                        <Text style={{ color: colors.primary, fontSize: 16 }}>キャンセル</Text>
                    </TouchableOpacity>
                ),
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

                        <TouchableOpacity
                            onPress={() => router.replace('/')}
                            style={{ marginTop: 24, alignItems: 'center', padding: 12 }}
                        >
                            <Text style={{ color: colors.textMuted, fontSize: 14 }}>キャンセルしてホームに戻る</Text>
                        </TouchableOpacity>
                    </View>
                ) : step === 'account' ? (
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
                            style={{ marginTop: 20, alignItems: 'center', padding: 12 }}
                        >
                            <Text style={{ color: colors.primary, fontWeight: '600' }}>形式選択に戻る</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.replace('/')}
                            style={{ marginTop: 8, alignItems: 'center', padding: 12 }}
                        >
                            <Text style={{ color: colors.textMuted, fontSize: 14 }}>キャンセルしてホームに戻る</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ gap: 16 }}>
                        <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
                                CSV内に不明な口座名が見つかりました。本アプリのどの口座と対応するか選択してください。
                            </Text>
                        </View>

                        {missingMappings.map(extName => (
                            <View key={extName} style={{ gap: 8 }}>
                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginLeft: 4 }}>
                                    CSV内の表記: <Text style={{ color: colors.text }}>{extName}</Text>
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                    {accounts.map(acc => (
                                        <TouchableOpacity
                                            key={acc.id}
                                            onPress={() => setAccountMappings(prev => ({ ...prev, [extName]: acc.id }))}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: accountMappings[extName] === acc.id ? colors.primary : colors.card,
                                                borderWidth: 1,
                                                borderColor: accountMappings[extName] === acc.id ? colors.primary : colors.border
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 12,
                                                color: accountMappings[extName] === acc.id ? 'white' : colors.text,
                                                fontWeight: accountMappings[extName] === acc.id ? 'bold' : 'normal'
                                            }}>
                                                {acc.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        ))}

                        <TouchableOpacity
                            onPress={handleMappingComplete}
                            disabled={missingMappings.some(name => !accountMappings[name]) || isLoading}
                            style={{
                                marginTop: 12,
                                backgroundColor: missingMappings.some(name => !accountMappings[name]) ? colors.textMuted : colors.primary,
                                padding: 16,
                                borderRadius: 16,
                                alignItems: 'center',
                                shadowColor: colors.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 8,
                                elevation: 4
                            }}
                        >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>保存してインポートを完了する</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setStep('account')}
                            style={{ marginTop: 8, alignItems: 'center', padding: 12 }}
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
