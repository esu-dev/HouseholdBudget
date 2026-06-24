import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ArrowDownCircle, ArrowUpCircle, Building2, CreditCard, EyeOff, Mail, RefreshCw, Smartphone, Wallet, ExternalLink, FileUp, X } from 'lucide-react-native';

// Expo Goで実行されているかを判別
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let GoogleSignin: any = null;
if (!isExpoGo) {
    try {
        const GoogleSigninModule = require('@react-native-google-signin/google-signin');
        GoogleSignin = GoogleSigninModule.GoogleSignin;
    } catch (e) {
        console.warn('GoogleSignin module could not be loaded', e);
    }
}
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View, Modal, TextInput, Linking } from 'react-native';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { emailImportService } from '../../services/emailImportService';
import { gmailService } from '../../services/gmailService';
import { useTransactionStore } from '../../store/useTransactionStore';
import { csvImportService } from '../../services/csvImportService';
import { databaseService } from '../../services/database';

const ACCOUNT_TYPE_INFO: Record<string, { label: string; icon: any; color: string }> = {
    cash: { label: '現金', icon: Wallet, color: '#f59e0b' },
    bank: { label: '銀行口座', icon: Building2, color: '#3b82f6' },
    card: { label: 'クレジットカード', icon: CreditCard, color: '#ef4444' },
    emoney: { label: '電子マネー', icon: Smartphone, color: '#10b981' },
    others: { label: 'その他', icon: Wallet, color: '#64748b' },
};

export default function BalanceScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { transactions, accounts, accountBalances, fetchData, syncCardTransfers, addTransactions } = useTransactionStore();
    const [gmailToken, setGmailToken] = React.useState<string | null>(null);
    const [isImporting, setIsImporting] = React.useState(false);

    // CSV Import State
    const [isCsvImporting, setIsCsvImporting] = useState(false);
    const [missingAccountMappings, setMissingAccountMappings] = useState<string[]>([]);
    const [isMappingModalVisible, setIsMappingModalVisible] = useState(false);
    const [pendingCsvResult, setPendingCsvResult] = useState<any>(null);
    const [localAccountMappings, setLocalAccountMappings] = useState<Record<string, string>>({});

    // 重複取引の置換・新規追加選択用ステート
    const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
    const [isDuplicateModalVisible, setIsDuplicateModalVisible] = useState(false);
    const [pendingImportTransactions, setPendingImportTransactions] = useState<any[]>([]);
    const [pendingAccountId, setPendingAccountId] = useState<string>('');

    const [emailTransactions, setEmailTransactions] = useState<any[]>([]);
    const [isManualSelectModalVisible, setIsManualSelectModalVisible] = useState(false);
    const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);

    const sortedEmailTransactions = useMemo(() => {
        if (activeCandidateId === null) return [];
        const candidate = duplicateCandidates.find(c => c.id === activeCandidateId);
        if (!candidate) return [];
        const csvTx = candidate.csvTx;

        return [...emailTransactions].sort((a, b) => {
            const aAmtDiff = Math.abs(Math.abs(a.amount) - Math.abs(csvTx.amount));
            const bAmtDiff = Math.abs(Math.abs(b.amount) - Math.abs(csvTx.amount));

            // Exact amount match first
            if (aAmtDiff === 0 && bAmtDiff > 0) return -1;
            if (bAmtDiff === 0 && aAmtDiff > 0) return 1;

            // Then by amount diff
            if (aAmtDiff !== bAmtDiff) return aAmtDiff - bAmtDiff;

            // Then by date proximity
            const csvDate = new Date(csvTx.date).getTime();
            const aDateDiff = Math.abs(new Date(a.date).getTime() - csvDate);
            const bDateDiff = Math.abs(new Date(b.date).getTime() - csvDate);
            return aDateDiff - bDateDiff;
        });
    }, [emailTransactions, duplicateCandidates, activeCandidateId]);

    const lastResolvedId = useRef<number | string | null | undefined>(undefined);

    const checkGmailStatus = async () => {
        if (!isExpoGo && GoogleSignin) {
            GoogleSignin.configure({
                scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
                iosClientId: '707898512731-491f9ltfgsoq46j1sff1pb8gqs4bnrqs.apps.googleusercontent.com',
            });
        }
        const token = await gmailService.getValidToken(GoogleSignin);
        setGmailToken(token);
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
            checkGmailStatus();
        }, [])
    );

    const handleQuickImport = async () => {
        if (isImporting) return;
        
        // トークンが古い可能性があるので再確認
        const currentToken = await gmailService.getValidToken(GoogleSignin);
        if (!currentToken) {
            setGmailToken(null);
            Alert.alert('認証エラー', 'Gmailにログインしていません。設定画面からログインしてください。');
            return;
        }

        setIsImporting(true);
        try {
            const result = await emailImportService.importFromGmail(currentToken);
            await fetchData();
            if (result.imported > 0) {
                Alert.alert('インポート完了', `${result.imported}件の取引を新しく追加しました。`);
            } else if (result.failed > 0) {
                Alert.alert('完了', `新着取引はありませんでした。（解析失敗 ${result.failed}件）`);
            } else {
                Alert.alert('完了', '新着取引はありませんでした。');
            }
        } catch (e: any) {
            if (e.message === 'Unauthorized') {
                setGmailToken(null);
                Alert.alert('認証エラー', 'Gmailのセッションが切れました。設定画面から再度ログインしてください。');
            } else {
                Alert.alert('エラー', 'メールの取得中に問題が発生しました。');
            }
        } finally {
            setIsImporting(false);
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

    const handleCsvImport = async (accountId: string, cardType: any) => {
        if (isCsvImporting) return;
        setIsCsvImporting(true);
        try {
            const result = await csvImportService.pickAndParseCsv(cardType, accountId);
            if (result.missingMappings.length > 0) {
                setPendingCsvResult(result);
                setMissingAccountMappings(result.missingMappings);
                setLocalAccountMappings({});
                setIsMappingModalVisible(true);
            } else if (result.transactions.length > 0) {
                // 重複メール取引の候補があるかチェック
                const rakutenId = await databaseService.getSetting('gmail_account_id_rakuten');
                const vpassId = await databaseService.getSetting('gmail_account_id_vpass');
                const jcbId = await databaseService.getSetting('gmail_account_id_jcb');
                const isEmailImportAccount = [rakutenId, vpassId, jcbId].filter(id => id !== null).includes(accountId);

                const existingTransactions = await databaseService.getAllTransactions();
                const emailTxs = existingTransactions.filter(t => {
                    const isEmailTx = t.import_hash !== null && /^(mock_msg|[0-9a-f]{16})/.test(t.import_hash);
                    return t.account_id === accountId && isEmailTx;
                });
                setEmailTransactions(emailTxs);

                const duplicates = result.transactions.filter(t => t.duplicateEmailCandidate !== null);
                if (isEmailImportAccount) {
                    setPendingImportTransactions(result.transactions);
                    setPendingAccountId(accountId);
                    const candidates = result.transactions.map((t, idx) => ({
                        id: idx,
                        csvTx: t,
                        existingTx: t.duplicateEmailCandidate,
                        resolution: t.duplicateEmailCandidate ? 'replace' : 'new'
                    }));
                    setDuplicateCandidates(candidates);
                    setIsDuplicateModalVisible(true);
                } else if (duplicates.length > 0) {
                    setPendingImportTransactions(result.transactions);
                    setPendingAccountId(accountId);
                    const candidates = duplicates.map((t, idx) => ({
                        id: idx,
                        csvTx: t,
                        existingTx: t.duplicateEmailCandidate,
                        resolution: 'replace'
                    }));
                    setDuplicateCandidates(candidates);
                    setIsDuplicateModalVisible(true);
                } else {
                    await databaseService.updateLastImportedAt(accountId, new Date().toISOString());
                    await addTransactions(result.transactions);
                    await fetchData();
                    Alert.alert('完了', `${result.transactions.length}件の取引をインポートしました`);
                }
            } else {
                await databaseService.updateLastImportedAt(accountId, new Date().toISOString());
                await fetchData();
                Alert.alert('情報', 'インポートする新しい取引はありませんでした');
            }
        } catch (error) {
            console.log(error);
            Alert.alert('エラー', 'CSVの読み込みに失敗しました');
        } finally {
            setIsCsvImporting(false);
        }
    };

    const handleSaveMappingsAndImport = async () => {
        if (!pendingCsvResult) return;

        try {
            // 紐付けを保存
            for (const [extName, intId] of Object.entries(localAccountMappings)) {
                await databaseService.setCsvAccountMapping(extName, intId);
            }

            // 再度パース（新しい紐付けを反映させるため）
            const mappings = await databaseService.getAllPayeeCategoryMappings();
            const existingTransactions = await databaseService.getAllTransactions();
            const accountMappings = await databaseService.getAllCsvAccountMappings();

            const rakutenId = await databaseService.getSetting('gmail_account_id_rakuten');
            const vpassId = await databaseService.getSetting('gmail_account_id_vpass');
            const jcbId = await databaseService.getSetting('gmail_account_id_jcb');
            const isEmailImportAccount = [rakutenId, vpassId, jcbId].filter(id => id !== null).includes(pendingCsvResult.accountId);

            const { transactions } = csvImportService.mapCsvToTransactions(
                pendingCsvResult.rawData,
                pendingCsvResult.cardType,
                pendingCsvResult.accountId,
                mappings,
                existingTransactions,
                accountMappings,
                isEmailImportAccount
            );

            setIsMappingModalVisible(false);
            setPendingCsvResult(null);
            setMissingAccountMappings([]);
            setLocalAccountMappings({});

            if (transactions.length > 0) {
                const emailTxs = existingTransactions.filter(t => {
                    const isEmailTx = t.import_hash !== null && /^(mock_msg|[0-9a-f]{16})/.test(t.import_hash);
                    return t.account_id === pendingCsvResult.accountId && isEmailTx;
                });
                setEmailTransactions(emailTxs);

                const duplicates = transactions.filter(t => t.duplicateEmailCandidate !== null);
                if (isEmailImportAccount) {
                    setPendingImportTransactions(transactions);
                    setPendingAccountId(pendingCsvResult.accountId);
                    const candidates = transactions.map((t, idx) => ({
                        id: idx,
                        csvTx: t,
                        existingTx: t.duplicateEmailCandidate,
                        resolution: t.duplicateEmailCandidate ? 'replace' : 'new'
                    }));
                    setDuplicateCandidates(candidates);
                    setIsDuplicateModalVisible(true);
                } else if (duplicates.length > 0) {
                    setPendingImportTransactions(transactions);
                    setPendingAccountId(pendingCsvResult.accountId);
                    const candidates = duplicates.map((t, idx) => ({
                        id: idx,
                        csvTx: t,
                        existingTx: t.duplicateEmailCandidate,
                        resolution: 'replace'
                    }));
                    setDuplicateCandidates(candidates);
                    setIsDuplicateModalVisible(true);
                } else {
                    await databaseService.updateLastImportedAt(pendingCsvResult.accountId, new Date().toISOString());
                    await addTransactions(transactions);
                    await fetchData();
                    Alert.alert('完了', `${transactions.length}件の取引をインポートしました`);
                }
            } else {
                await databaseService.updateLastImportedAt(pendingCsvResult.accountId, new Date().toISOString());
                await fetchData();
                Alert.alert('情報', 'インポートする新しい取引はありませんでした');
            }
        } catch (error) {
            Alert.alert('エラー', 'インポート中にエラーが発生しました');
        }
    };

    const handleSaveDuplicateResolutions = async () => {
        setIsCsvImporting(true);
        setIsDuplicateModalVisible(false);

        try {
            let importedCount = 0;
            let replacedCount = 0;

            for (const t of pendingImportTransactions) {
                const candidate = duplicateCandidates.find(c => c.csvTx === t);
                if (candidate) {
                    if (candidate.resolution === 'replace') {
                        const existingTx = candidate.existingTx;
                        // 既存のカテゴリが'others'以外ならそれを引き継ぎ、そうでなければCSVのものを適用
                        const finalCategory = (existingTx.category_id && existingTx.category_id !== 'others') ? existingTx.category_id : t.category_id;
                        // 既存のメモがGmail自動インポート以外ならそれを引き継ぎ、そうでなければCSVのものを適用
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
                        // 新規作成
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
                    // 通常の重複なし取引の追加
                    await databaseService.addTransaction(t);
                    importedCount++;
                }
            }

            const { creditCardPaymentService } = require('../../services/creditCardPaymentService');
            await creditCardPaymentService.updateTransferForDate(pendingAccountId);

            await fetchData();

            Alert.alert(
                'インポート完了',
                `CSVの取り込みが完了しました。\n(新規追加: ${importedCount}件、置換更新: ${replacedCount}件)`
            );

            setPendingImportTransactions([]);
            setDuplicateCandidates([]);
            setPendingAccountId('');
        } catch (e) {
            console.error(e);
            Alert.alert('エラー', '取引のインポートに失敗しました');
        } finally {
            setIsCsvImporting(false);
        }
    };

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        primary: '#6366f1',
        primarySub: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff',
        inputBg: isDark ? '#1e293b' : '#f1f5f9',
    };

    const formatLastImported = (dateStr: string | undefined) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    };

    // 合計資産（純資産）を計算
    const netWorth = useMemo(() => {
        return accounts.reduce((sum, account) => {
            if (account.excludeFromNetWorth) return sum;
            return sum + (accountBalances[account.id] || 0);
        }, 0);
    }, [accountBalances, accounts]);

    // 今月の収支
    const monthlyStats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let income = 0;
        let expenses = 0;

        transactions.forEach(t => {
            if (t.category_id === 'transfer' || t.category_id === 'adjustment') return;
            const d = new Date(t.date);
            if (d >= startOfMonth) {
                if (t.amount > 0) income += t.amount;
                else expenses += Math.abs(t.amount);
            }
        });

        return { income, expenses, balance: income - expenses };
    }, [transactions]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView style={{ flex: 1 }}>
                <Stack.Screen options={{
                    headerShown: true
                }} />

                <View style={{ padding: 20, paddingTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 10 }}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>資産状況</Text>
                        {gmailToken && (
                            <TouchableOpacity
                                onPress={handleQuickImport}
                                disabled={isImporting}
                                style={{
                                    paddingVertical: 6,
                                    paddingHorizontal: 12,
                                    borderRadius: 12,
                                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#eef2ff',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    borderWidth: 1,
                                    borderColor: colors.indigo + '30'
                                }}
                            >
                                {isImporting ? (
                                    <ActivityIndicator size="small" color={colors.indigo} />
                                ) : (
                                    <Mail size={16} color={colors.indigo} />
                                )}
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.indigo }}>
                                    {isImporting ? '読込中' : 'メール読込'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* 純資産カード */}
                    <View style={{ backgroundColor: colors.indigo, padding: 24, borderRadius: 32, marginBottom: 24, shadowColor: colors.indigo, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>現在の合計純資産</Text>
                        <Text style={{ color: 'white', fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>¥{netWorth.toLocaleString()}</Text>
                        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>今月の収支</Text>
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>
                                    {monthlyStats.balance >= 0 ? '+' : ''}¥{monthlyStats.balance.toLocaleString()}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>アカウント数</Text>
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>{accounts.filter(a => !a.isHidden).length} 口座</Text>
                            </View>
                        </View>
                    </View>

                    {/* 口座別残高一覧 */}
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>口座別残高</Text>

                    {accounts.filter(a => !a.isHidden).map((account) => {
                        const balance = accountBalances[account.id] || 0;
                        const typeInfo = ACCOUNT_TYPE_INFO[account.type] || ACCOUNT_TYPE_INFO.others;
                        const IconComp = typeInfo.icon;

                        return (
                            <TouchableOpacity
                                key={account.id}
                                onPress={() => router.push(`/accounts/${account.id}`)}
                                style={{
                                    backgroundColor: colors.card,
                                    padding: 18,
                                    borderRadius: 24,
                                    marginBottom: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 2,
                                    elevation: 1
                                }}
                            >
                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: typeInfo.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                                    <IconComp size={20} color={typeInfo.color} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 16, marginRight: 8 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }} numberOfLines={1}>{account.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                            {typeInfo.label}
                                        </Text>
                                        {account.lastImportedAt && (
                                            <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                                • CSV:{formatLastImported(account.lastImportedAt)}
                                            </Text>
                                        )}
                                        {account.lastEmailImportedAt && (
                                            <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                                • メール:{formatLastImported(account.lastEmailImportedAt)}
                                            </Text>
                                        )}
                                        {account.excludeFromNetWorth && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                <EyeOff size={10} color="#f43f5e" />
                                                <Text style={{ fontSize: 10, color: '#f43f5e', fontWeight: 'bold' }}>非計算</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end', minWidth: 100 }}>
                                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>¥{balance.toLocaleString()}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                        {account.cardType && account.cardType !== 'none' && (
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleCsvImport(account.id, account.cardType);
                                                }}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                style={{ padding: 4 }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <FileUp size={12} color={colors.primary} />
                                                    <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold' }}>CSV読込</Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                        {account.cardType && account.loginUrl && (
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    Linking.openURL(account.loginUrl!);
                                                }}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                style={{ padding: 4 }}
                                            >
                                                <ExternalLink size={12} color={colors.primary} />
                                            </TouchableOpacity>
                                        )}
                                        {account.type === 'card' && account.withdrawalAccountId && (
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleSync(account.id);
                                                }}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                style={{ padding: 4 }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <RefreshCw size={12} color={colors.indigo} />
                                                    <Text style={{ fontSize: 10, color: colors.indigo, fontWeight: 'bold' }}>振替更新</Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}

                    {/* 今月のサマリー詳細 */}
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginTop: 12, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>今月の動き</Text>

                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
                        <View style={{ flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 24, borderLeftWidth: 4, borderLeftColor: '#22c55e' }}>
                            <ArrowUpCircle size={16} color="#22c55e" />
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>収入</Text>
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>¥{monthlyStats.income.toLocaleString()}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 24, borderLeftWidth: 4, borderLeftColor: '#ef4444' }}>
                            <ArrowDownCircle size={16} color="#ef4444" />
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>支出</Text>
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>¥{monthlyStats.expenses.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* 口座紐付けモーダル */}
            <Modal visible={isMappingModalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%', padding: 24 }}>
                        <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>口座の紐付け設定</Text>
                        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24 }}>PayPayチャージ等の出金口座をアプリ内の口座と紐付けてください。</Text>

                        <ScrollView style={{ flex: 1 }}>
                            {missingAccountMappings.map(extAcc => (
                                <View key={extAcc} style={{ marginBottom: 16, backgroundColor: colors.card, padding: 16, borderRadius: 16 }}>
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>CSV上の名前: {extAcc}</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {accounts.filter(a => a.type === 'bank' || a.type === 'cash').map(acc => (
                                                <TouchableOpacity
                                                    key={acc.id}
                                                    onPress={() => setLocalAccountMappings(prev => ({ ...prev, [extAcc]: acc.id }))}
                                                    style={{
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 8,
                                                        borderRadius: 12,
                                                        backgroundColor: localAccountMappings[extAcc] === acc.id ? colors.primary : colors.inputBg,
                                                        borderWidth: 1,
                                                        borderColor: localAccountMappings[extAcc] === acc.id ? colors.primary : colors.border
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, color: localAccountMappings[extAcc] === acc.id ? 'white' : colors.text }}>{acc.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 16 }}>
                            <TouchableOpacity
                                onPress={() => { setIsMappingModalVisible(false); setPendingCsvResult(null); setMissingAccountMappings([]); setLocalAccountMappings({}); }}
                                style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.inputBg, alignItems: 'center' }}
                            >
                                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveMappingsAndImport}
                                disabled={Object.keys(localAccountMappings).length < missingAccountMappings.length}
                                style={{ flex: 2, padding: 16, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', opacity: Object.keys(localAccountMappings).length < missingAccountMappings.length ? 0.5 : 1 }}
                            >
                                <Text style={{ fontWeight: 'bold', color: 'white' }}>保存してインポート</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                                        <View style={{ backgroundColor: colors.inputBg, padding: 12, borderRadius: 12, marginBottom: 12 }}>
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
                                                        style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.primarySub }}
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
                                                    backgroundColor: candidate.resolution === 'replace' ? colors.primarySub : colors.inputBg,
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
                                                    backgroundColor: candidate.resolution === 'new' ? colors.primarySub : colors.inputBg,
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
                                style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.inputBg, alignItems: 'center' }}
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
                                            style={{ padding: 16, borderRadius: 16, backgroundColor: colors.inputBg, alignItems: 'center' }}
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
