import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, ChevronRight, CreditCard, FileUp, Smartphone, Wallet, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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

    // 重複取引処理ステート
    const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
    const [isDuplicateModalVisible, setIsDuplicateModalVisible] = useState(false);
    const [pendingImportTransactions, setPendingImportTransactions] = useState<any[]>([]);
    const [pendingAccountId, setPendingAccountId] = useState<string>('');
    const [emailTransactions, setEmailTransactions] = useState<any[]>([]);
    const [isManualSelectModalVisible, setIsManualSelectModalVisible] = useState(false);
    const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);

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

    const sortedEmailTransactions = useMemo(() => {
        if (activeCandidateId === null) return [];
        const candidate = duplicateCandidates.find(c => c.id === activeCandidateId);
        if (!candidate) return [];
        const csvTx = candidate.csvTx;
        return [...emailTransactions].sort((a, b) => {
            const aAmtDiff = Math.abs(Math.abs(a.amount) - Math.abs(csvTx.amount));
            const bAmtDiff = Math.abs(Math.abs(b.amount) - Math.abs(csvTx.amount));
            if (aAmtDiff === 0 && bAmtDiff > 0) return -1;
            if (bAmtDiff === 0 && aAmtDiff > 0) return 1;
            if (aAmtDiff !== bAmtDiff) return aAmtDiff - bAmtDiff;
            const csvDate = new Date(csvTx.date).getTime();
            const aDateDiff = Math.abs(new Date(a.date).getTime() - csvDate);
            const bDateDiff = Math.abs(new Date(b.date).getTime() - csvDate);
            return aDateDiff - bDateDiff;
        });
    }, [emailTransactions, duplicateCandidates, activeCandidateId]);

    const processTransactionsWithDuplicateCheck = async (accountId: string, txs: CreateTransactionInput[]) => {
        if (txs.length === 0) {
            await databaseService.updateLastImportedAt(accountId, new Date().toISOString());
            await fetchData();
            Alert.alert('情報', 'インポートする新しい取引はありませんでした');
            router.replace('/');
            return;
        }

        const existingTransactions = await databaseService.getAllTransactions();
        const emailTxs = existingTransactions.filter(t => {
            const isEmailTx = t.import_hash !== null && /^(mock_msg|[0-9a-f]{16})/.test(t.import_hash);
            return t.account_id === accountId && isEmailTx;
        });
        setEmailTransactions(emailTxs);

        const duplicates = txs.filter(t => (t as any).duplicateEmailCandidate !== null);
        const rakutenId = await databaseService.getSetting('gmail_account_id_rakuten');
        const vpassId = await databaseService.getSetting('gmail_account_id_vpass');
        const jcbId = await databaseService.getSetting('gmail_account_id_jcb');
        const isEmailImportAccount = [rakutenId, vpassId, jcbId].filter(id => id !== null).includes(accountId);

        if (isEmailImportAccount || duplicates.length > 0) {
            setPendingImportTransactions(txs);
            setPendingAccountId(accountId);
            const candidates = txs.map((t, idx) => ({
                id: idx,
                csvTx: t,
                existingTx: (t as any).duplicateEmailCandidate,
                resolution: (t as any).duplicateEmailCandidate ? 'replace' : 'new'
            }));
            setDuplicateCandidates(candidates);
            setIsDuplicateModalVisible(true);
        } else {
            await databaseService.updateLastImportedAt(accountId, new Date().toISOString());
            await addTransactions(txs);
            Alert.alert('完了', `${txs.length}件の取引をインポートしました`);
            router.replace('/');
        }
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

            await processTransactionsWithDuplicateCheck(accountId, result.transactions);
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

            await processTransactionsWithDuplicateCheck(selectedAccountId, transactions);
        } catch (error) {
            console.error(error);
            Alert.alert('エラー', '保存またはインポートに失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDuplicateResolutions = async () => {
        setIsLoading(true);
        setIsDuplicateModalVisible(false);

        try {
            let importedCount = 0;
            let replacedCount = 0;

            for (const t of pendingImportTransactions) {
                const candidate = duplicateCandidates.find(c => c.csvTx === t);
                if (candidate) {
                    if (candidate.resolution === 'replace') {
                        const existingTx = candidate.existingTx;
                        const finalCategory = (existingTx.category_id && existingTx.category_id !== 'others') ? existingTx.category_id : t.category_id;
                        const finalMemo = (existingTx.memo && existingTx.memo !== 'Gmail自動インポート' && existingTx.memo !== 'Gmail自動インポート(Mock)') ? existingTx.memo : t.memo;

                        await databaseService.updateTransaction({
                            ...existingTx,
                            amount: t.amount,
                            date: t.date,
                            payee: t.payee,
                            memo: finalMemo,
                            category_id: finalCategory,
                            import_hash: t.import_hash || existingTx.import_hash
                        });
                        replacedCount++;
                    } else {
                        await databaseService.addTransaction({
                            amount: t.amount,
                            category_id: t.category_id,
                            account_id: t.account_id,
                            date: t.date,
                            memo: t.memo,
                            payee: t.payee,
                            import_hash: t.import_hash
                        });
                        importedCount++;
                    }
                } else {
                    await databaseService.addTransaction(t);
                    importedCount++;
                }
            }

            const { creditCardPaymentService } = require('../services/creditCardPaymentService');
            await creditCardPaymentService.updateTransferForDate(pendingAccountId);

            await fetchData();

            Alert.alert(
                'インポート完了',
                `CSVの取り込みが完了しました。\n(新規追加: ${importedCount}件、置換更新: ${replacedCount}件)`
            );

            setPendingImportTransactions([]);
            setDuplicateCandidates([]);
            setPendingAccountId('');
            router.replace('/');
        } catch (e) {
            console.error(e);
            Alert.alert('エラー', '取引のインポートに失敗しました');
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

            {/* 重複取引処理モーダル */}
            <Modal visible={isDuplicateModalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 24 }}>
                        <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>取り込み内容の確認</Text>
                        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>
                            メールから取り込み済みの取引と重複する可能性があるCSV行が見つかりました。
                        </Text>

                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                            {duplicateCandidates.map((candidate) => {
                                const csvTx = candidate.csvTx;
                                const existingTx = candidate.existingTx;
                                const csvDate = new Date(csvTx.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });

                                return (
                                    <View key={candidate.id} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>CSV of Line</Text>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text, marginTop: 2 }}>{csvDate} {csvTx.payee || '利用先不明'}</Text>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>¥{Math.abs(csvTx.amount).toLocaleString()}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>対応</Text>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, marginTop: 2 }}>
                                                    {candidate.resolution === 'replace' ? '既存の置換' : '新規追加'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* 既存の取引との比較 */}
                                        <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 12, marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textMuted }}>比較対象（既存のメール取引）</Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setActiveCandidateId(candidate.id);
                                                        setIsManualSelectModalVisible(true);
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary }}>手動選択...</Text>
                                                </TouchableOpacity>
                                            </View>
                                            {existingTx ? (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <View style={{ flex: 1, marginRight: 8 }}>
                                                        <Text style={{ fontSize: 12, color: colors.text }} numberOfLines={1}>
                                                            {new Date(existingTx.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} {existingTx.payee || '利用先不明'}
                                                        </Text>
                                                        <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{existingTx.memo || ''}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text }}>¥{Math.abs(existingTx.amount).toLocaleString()}</Text>
                                                </View>
                                            ) : (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>自動紐付け候補なし</Text>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setActiveCandidateId(candidate.id);
                                                            setIsManualSelectModalVisible(true);
                                                        }}
                                                        style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.primary + '20' }}
                                                    >
                                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.primary }}>既存取引から紐付け</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>

                                        {/* セレクター */}
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            <TouchableOpacity
                                                disabled={!existingTx}
                                                onPress={() => setDuplicateCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, resolution: 'replace' } : c))}
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 10,
                                                    borderRadius: 12,
                                                    backgroundColor: candidate.resolution === 'replace' ? colors.primary + '20' : colors.background,
                                                    borderWidth: 2,
                                                    borderColor: candidate.resolution === 'replace' ? colors.primary : 'transparent',
                                                    alignItems: 'center',
                                                    opacity: !existingTx ? 0.4 : 1
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: candidate.resolution === 'replace' ? colors.primary : colors.textMuted }}>
                                                    既存を置換する
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setDuplicateCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, resolution: 'new' } : c))}
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 10,
                                                    borderRadius: 12,
                                                    backgroundColor: candidate.resolution === 'new' ? colors.primary + '20' : colors.background,
                                                    borderWidth: 2,
                                                    borderColor: candidate.resolution === 'new' ? colors.primary : 'transparent',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: candidate.resolution === 'new' ? colors.primary : colors.textMuted }}>
                                                    新規追加する
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 16 }}>
                            <TouchableOpacity
                                onPress={() => { setIsDuplicateModalVisible(false); setPendingImportTransactions([]); setDuplicateCandidates([]); setPendingAccountId(''); }}
                                style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center' }}
                            >
                                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveDuplicateResolutions}
                                style={{ flex: 2, padding: 16, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center' }}
                            >
                                <Text style={{ fontWeight: 'bold', color: 'white' }}>インポートを実行</Text>
                            </TouchableOpacity>
                        </View>

                        {isManualSelectModalVisible && (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 999 }}>
                                <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '75%', padding: 24 }}>
                                    <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>置換する既存メール取引を選択</Text>
                                        <TouchableOpacity onPress={() => setIsManualSelectModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <X size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
                                        インポートする取引と金額や日付が近い既存のメール取り込み取引が優先的に表示されています。
                                    </Text>

                                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                        {sortedEmailTransactions.length > 0 ? (
                                            sortedEmailTransactions.map((tx) => {
                                                const txDate = new Date(tx.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
                                                return (
                                                    <TouchableOpacity
                                                        key={tx.id}
                                                        onPress={() => {
                                                            setDuplicateCandidates(prev => prev.map(c =>
                                                                c.id === activeCandidateId
                                                                    ? { ...c, existingTx: tx, resolution: 'replace' }
                                                                    : c
                                                            ));
                                                            setIsManualSelectModalVisible(false);
                                                        }}
                                                        style={{ backgroundColor: colors.card, padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                                    >
                                                        <View style={{ flex: 1, marginRight: 12 }}>
                                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary }}>{txDate}</Text>
                                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text, marginTop: 2 }} numberOfLines={1}>{tx.payee || '利用先不明'}</Text>
                                                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{tx.memo || ''}</Text>
                                                        </View>
                                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>¥{Math.abs(tx.amount).toLocaleString()}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        ) : (
                                            <View style={{ padding: 40, alignItems: 'center' }}>
                                                <Text style={{ color: colors.textMuted }}>選択可能な既存メール取引がありません</Text>
                                            </View>
                                        )}
                                    </ScrollView>

                                    <View style={{ paddingTop: 16 }}>
                                        <TouchableOpacity
                                            onPress={() => setIsManualSelectModalVisible(false)}
                                            style={{ padding: 16, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center' }}
                                        >
                                            <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>閉じる</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
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
