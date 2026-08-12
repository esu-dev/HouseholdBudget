import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, CircleEllipsis, EyeOff, ExternalLink, FileUp, MessageSquare, MoreVertical, Plus, RefreshCw, RotateCcw, Store, Trash2, Wallet, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, Keyboard, Platform, InputAccessoryView } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { csvImportService } from '../../services/csvImportService';
import { databaseService } from '../../services/database';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function AccountHistoryScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { transactions, accounts, accountBalances, setEditingTransaction, majorCategories, addTransaction, addTransactions, deleteTransaction, fetchData, syncCardTransfers } = useTransactionStore();

    const isAllAccounts = id === 'all';

    const [isAdjustModalVisible, setIsAdjustModalVisible] = useState(false);
    const [newActualBalance, setNewActualBalance] = useState('');
    const [isMenuModalVisible, setIsMenuModalVisible] = useState(false);

    // CSV import state
    const [isCsvImporting, setIsCsvImporting] = useState(false);
    const [missingAccountMappings, setMissingAccountMappings] = useState<string[]>([]);
    const [isMappingModalVisible, setIsMappingModalVisible] = useState(false);
    const [pendingCsvResult, setPendingCsvResult] = useState<any>(null);
    const [localAccountMappings, setLocalAccountMappings] = useState<Record<string, string>>({});
    const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
    const [isDuplicateModalVisible, setIsDuplicateModalVisible] = useState(false);
    const [pendingImportTransactions, setPendingImportTransactions] = useState<any[]>([]);
    const [pendingAccountId, setPendingAccountId] = useState<string>('');
    const [emailTransactions, setEmailTransactions] = useState<any[]>([]);
    const [isManualSelectModalVisible, setIsManualSelectModalVisible] = useState(false);
    const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);

    const account = accounts.find(a => a.id === id);
    const balance = accountBalances[id as string] ?? 0;
    const totalNetWorth = Object.values(accountBalances).reduce((sum, b) => sum + b, 0);

    const nextWithdrawal = useMemo(() => {
        if (!account || account.type !== 'card' || account.withdrawalDay == null) return null;

        const closingDay = account.closingDay || 0;
        const normalizeYearMonth = (str: string | undefined) => {
            if (!str) return undefined;
            const match = str.match(/(\d{4})[-/年](\d{1,2})/);
            if (match) {
                return `${match[1]}-${match[2].padStart(2, '0')}`;
            }
            return str;
        };
        const billingStartDate = normalizeYearMonth(account.billingStartDate);

        // クレジットカードの通常の取引（振替以外・残高除外以外）
        const cardTransactions = transactions.filter(t => 
            t.account_id === id && t.category_id !== 'transfer' && !t.exclude_from_balance
        );

        const withdrawalGroups = new Map<string, { date: Date, amount: number }>();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        cardTransactions.forEach(t => {
            const tDate = new Date(t.date);
            let tYear = tDate.getFullYear();
            let tMonth = tDate.getMonth();
            const tDay = tDate.getDate();

            if (t.is_deferred) {
                tMonth++;
                if (tMonth > 11) {
                    tMonth = 0;
                    tYear++;
                }
            }

            if (closingDay > 0 && tDay > closingDay) {
                tMonth++;
                if (tMonth > 11) {
                    tMonth = 0;
                    tYear++;
                }
            }

            const cycleKey = `${tYear}-${String(tMonth + 1).padStart(2, '0')}`;
            if (billingStartDate && cycleKey < billingStartDate) return;

            // 引き落とし日を計算 (サイクル月の翌月)
            let withdrawalYear = tYear;
            let withdrawalMonth = tMonth + 1;
            if (withdrawalMonth > 11) {
                withdrawalYear++;
                withdrawalMonth = 0;
            }

            let wDay = account.withdrawalDay;
            if (wDay === 0) {
                wDay = new Date(withdrawalYear, withdrawalMonth + 1, 0).getDate();
            }

            let withdrawalDate = new Date(withdrawalYear, withdrawalMonth, wDay);

            // 土日の営業日調整
            if (withdrawalDate.getDay() === 0) {
                withdrawalDate.setDate(withdrawalDate.getDate() + 1);
            } else if (withdrawalDate.getDay() === 6) {
                withdrawalDate.setDate(withdrawalDate.getDate() + 2);
            }

            const dateKey = withdrawalDate.toISOString().split('T')[0];

            if (!withdrawalGroups.has(dateKey)) {
                withdrawalGroups.set(dateKey, { date: withdrawalDate, amount: 0 });
            }
            // クレジットカードの支出は負の値なので、引落額として正の値にするため減算する
            withdrawalGroups.get(dateKey)!.amount -= t.amount;
        });

        // 未来の引落日かつ金額がプラスのもの
        const futureWithdrawals = Array.from(withdrawalGroups.values())
            .filter(w => w.date > today && w.amount > 0)
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        if (futureWithdrawals.length === 0) return null;

        const next = futureWithdrawals[0];
        return {
            amount: next.amount,
            dateStr: next.date.toLocaleDateString('ja-JP', {
                month: 'long',
                day: 'numeric',
                weekday: 'short'
            })
        };
    }, [transactions, id, account]);

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

    const handleSync = async () => {
        if (!account || !account.withdrawalAccountId || account.withdrawalDay == null) {
            Alert.alert('設定不足', '引き落とし口座と引き落とし日が設定されている必要があります。');
            return;
        }
        try {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            await syncCardTransfers(id as string, now.toISOString());
            await syncCardTransfers(id as string, lastMonth.toISOString());
            await syncCardTransfers(id as string, nextMonth.toISOString());
            Alert.alert('同期完了', `${account.name} の最近の振替を更新しました。`);
        } catch (e) {
            Alert.alert('エラー', '振替の同期に失敗しました');
        }
    };

    const handleCsvImport = async () => {
        if (isCsvImporting || !account?.cardType || account.cardType === 'none') return;
        setIsCsvImporting(true);
        const accountId = id as string;
        try {
            const result = await csvImportService.pickAndParseCsv(account.cardType, accountId);
            if (result.missingMappings.length > 0) {
                setPendingCsvResult(result);
                setMissingAccountMappings(result.missingMappings);
                setLocalAccountMappings({});
                setIsMappingModalVisible(true);
            } else if (result.transactions.length > 0) {
                const rakutenId = await databaseService.getSetting('gmail_account_id_rakuten');
                const vpassId = await databaseService.getSetting('gmail_account_id_vpass');
                const jcbId = await databaseService.getSetting('gmail_account_id_jcb');
                const isEmailImportAccount = [rakutenId, vpassId, jcbId].filter(x => x !== null).includes(accountId);
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
                    const candidates = result.transactions.map((t, idx) => ({ id: idx, csvTx: t, existingTx: t.duplicateEmailCandidate, resolution: t.duplicateEmailCandidate ? 'replace' : 'new' }));
                    setDuplicateCandidates(candidates);
                    setIsDuplicateModalVisible(true);
                } else if (duplicates.length > 0) {
                    setPendingImportTransactions(result.transactions);
                    setPendingAccountId(accountId);
                    const candidates = duplicates.map((t, idx) => ({ id: idx, csvTx: t, existingTx: t.duplicateEmailCandidate, resolution: 'replace' }));
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
            Alert.alert('エラー', 'CSVの読み込みに失敗しました');
        } finally {
            setIsCsvImporting(false);
        }
    };

    const handleSaveMappingsAndImport = async () => {
        if (!pendingCsvResult) return;
        try {
            for (const [extName, intId] of Object.entries(localAccountMappings)) {
                await databaseService.setCsvAccountMapping(extName, intId);
            }
            const mappings = await databaseService.getAllPayeeCategoryMappings();
            const existingTransactions = await databaseService.getAllTransactions();
            const accountMappings = await databaseService.getAllCsvAccountMappings();
            const rakutenId = await databaseService.getSetting('gmail_account_id_rakuten');
            const vpassId = await databaseService.getSetting('gmail_account_id_vpass');
            const jcbId = await databaseService.getSetting('gmail_account_id_jcb');
            const isEmailImportAccount = [rakutenId, vpassId, jcbId].filter(x => x !== null).includes(pendingCsvResult.accountId);
            const { transactions: txs } = csvImportService.mapCsvToTransactions(pendingCsvResult.rawData, pendingCsvResult.cardType, pendingCsvResult.accountId, mappings, existingTransactions, accountMappings, isEmailImportAccount);
            setIsMappingModalVisible(false);
            setPendingCsvResult(null);
            setMissingAccountMappings([]);
            setLocalAccountMappings({});
            if (txs.length > 0) {
                const emailTxs = existingTransactions.filter(t => {
                    const isEmailTx = t.import_hash !== null && /^(mock_msg|[0-9a-f]{16})/.test(t.import_hash);
                    return t.account_id === pendingCsvResult.accountId && isEmailTx;
                });
                setEmailTransactions(emailTxs);
                const duplicates = txs.filter(t => t.duplicateEmailCandidate !== null);
                if (isEmailImportAccount) {
                    setPendingImportTransactions(txs);
                    setPendingAccountId(pendingCsvResult.accountId);
                    const candidates = txs.map((t, idx) => ({ id: idx, csvTx: t, existingTx: t.duplicateEmailCandidate, resolution: t.duplicateEmailCandidate ? 'replace' : 'new' }));
                    setDuplicateCandidates(candidates);
                    setIsDuplicateModalVisible(true);
                } else if (duplicates.length > 0) {
                    setPendingImportTransactions(txs);
                    setPendingAccountId(pendingCsvResult.accountId);
                    const candidates = duplicates.map((t, idx) => ({ id: idx, csvTx: t, existingTx: t.duplicateEmailCandidate, resolution: 'replace' }));
                    setDuplicateCandidates(candidates);
                    setIsDuplicateModalVisible(true);
                } else {
                    await databaseService.updateLastImportedAt(pendingCsvResult.accountId, new Date().toISOString());
                    await addTransactions(txs);
                    await fetchData();
                    Alert.alert('完了', `${txs.length}件の取引をインポートしました`);
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
                        const finalCategory = (existingTx.category_id && existingTx.category_id !== 'others') ? existingTx.category_id : t.category_id;
                        const finalMemo = (existingTx.memo && existingTx.memo !== 'Gmail自動インポート' && existingTx.memo !== 'Gmail自動インポート(Mock)') ? existingTx.memo : t.memo;
                        // 置換時は元のメール取引のimport_hashを保持する（CSVハッシュで上書きしない）
                        // こうすることで次回メール読み込み時に重複として正しく検知される
                        await databaseService.updateTransaction({ ...existingTx, amount: t.amount, date: t.date, payee: t.payee, memo: finalMemo, category_id: finalCategory, import_hash: existingTx.import_hash });
                        replacedCount++;
                    } else {
                        await databaseService.addTransaction({ amount: t.amount, category_id: t.category_id, account_id: t.account_id, date: t.date, memo: t.memo, payee: t.payee, import_hash: t.import_hash });
                        importedCount++;
                    }
                } else {
                    await databaseService.addTransaction(t);
                    importedCount++;
                }
            }
            const { creditCardPaymentService } = require('../../services/creditCardPaymentService');
            await creditCardPaymentService.updateTransferForDate(pendingAccountId);
            await fetchData();
            Alert.alert('インポート完了', `CSVの取り込みが完了しました。\n(新規追加: ${importedCount}件、置換更新: ${replacedCount}件)`);
            setPendingImportTransactions([]);
            setDuplicateCandidates([]);
            setPendingAccountId('');
        } catch (e) {
            Alert.alert('エラー', '取引のインポートに失敗しました');
        } finally {
            setIsCsvImporting(false);
        }
    };

    const availableMajors = useMemo(() => {
        const accountTxs = isAllAccounts
            ? transactions
            : transactions.filter(t => t.account_id === id);
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

        const accountTxs = isAllAccounts
            ? transactions
            : transactions.filter(t => t.account_id === id);
        const catIds = new Set(accountTxs.map(t => t.category_id));

        const major = majorCategories.find(m => m.id === selectedMajorId);
        if (!major) return [];

        return major.subCategories.filter(min => catIds.has(min.id));
    }, [transactions, id, majorCategories, selectedMajorId]);

    const filteredTransactions = useMemo(() => {
        const baseTxs = isAllAccounts
            ? transactions
            : transactions.filter(t => t.account_id === id);
        return baseTxs.filter(t => {

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
    }, [transactions, id, selectedMajorId, selectedMinorId, majorCategories, isAllAccounts]);

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

        const renderRightActions = () => (
            <View
                style={{
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    marginBottom: 8,
                    marginRight: 16,
                }}
            >
                <TouchableOpacity
                    onPress={() => {
                        Alert.alert(
                            '取引の削除',
                            'この取引を削除してもよいですか？\nこの操作は取り消すことができません。',
                            [
                                { text: 'キャンセル', style: 'cancel' },
                                {
                                    text: '削除する',
                                    style: 'destructive',
                                    onPress: async () => {
                                        await deleteTransaction(item.id);
                                        await fetchData();
                                    },
                                },
                            ]
                        );
                    }}
                    style={{
                        width: 72,
                        height: '100%',
                        backgroundColor: '#ef4444',
                        borderRadius: 20,
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    <Trash2 size={20} color="white" />
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>削除</Text>
                </TouchableOpacity>
            </View>
        );

        return (
            <Swipeable
                renderRightActions={renderRightActions}
                overshootRight={false}
                friction={2}
                rightThreshold={40}
            >
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    {item.payee && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                                            <Store size={10} color={colors.textMuted} style={{ flexShrink: 0 }} />
                                            <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 4 }} numberOfLines={1}>{item.payee}</Text>
                                        </View>
                                    )}
                                    {item.import_hash && (
                                        <View style={{
                                            backgroundColor: item.import_hash.startsWith('csv_') || !/^(mock_msg|[0-9a-f]{16})/.test(item.import_hash)
                                                ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe')
                                                : (isDark ? 'rgba(251, 191, 36, 0.15)' : '#fef3c7'),
                                            paddingHorizontal: 6,
                                            paddingVertical: 1,
                                            borderRadius: 6
                                        }}>
                                            <Text style={{
                                                fontSize: 9,
                                                fontWeight: 'bold',
                                                color: item.import_hash.startsWith('csv_') || !/^(mock_msg|[0-9a-f]{16})/.test(item.import_hash)
                                                    ? (isDark ? '#38bdf8' : '#0369a1')
                                                    : (isDark ? '#fbbf24' : '#b45309')
                                            }}>
                                                {item.import_hash.startsWith('csv_') || !/^(mock_msg|[0-9a-f]{16})/.test(item.import_hash) ? 'CSV' : 'メール'}
                                            </Text>
                                        </View>
                                    )}
                                    {item.exclude_from_balance && (
                                        <View style={{
                                            backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
                                            paddingHorizontal: 6,
                                            paddingVertical: 1,
                                            borderRadius: 6
                                        }}>
                                            <Text style={{
                                                fontSize: 9,
                                                fontWeight: 'bold',
                                                color: isDark ? '#fb7185' : '#e11d48'
                                            }}>
                                                残高除外
                                            </Text>
                                        </View>
                                    )}
                                    {item.exclude_from_budget && (
                                        <View style={{
                                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                                            paddingHorizontal: 6,
                                            paddingVertical: 1,
                                            borderRadius: 6
                                        }}>
                                            <Text style={{
                                                fontSize: 9,
                                                fontWeight: 'bold',
                                                color: isDark ? '#fbbf24' : '#d97706'
                                            }}>
                                                予算除外
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                {item.memo && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                        <MessageSquare size={10} color={colors.textMuted} />
                                        <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 4 }} numberOfLines={1}>
                                            {item.memo}
                                        </Text>
                                    </View>
                                )}
                                {item.tags && item.tags.length > 0 && (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {item.tags.map((tag: string) => (
                                            <View
                                                key={tag}
                                                style={{
                                                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                                                    paddingHorizontal: 6,
                                                    paddingVertical: 2,
                                                    borderRadius: 10,
                                                    borderWidth: 1,
                                                    borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#c7d2fe'
                                                }}
                                            >
                                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: isDark ? '#818cf8' : '#4f46e5' }}>
                                                    #{tag}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: amount > 0 ? '#22c55e' : colors.text, minWidth: 80, textAlign: 'right' }}>
                                {amount > 0 ? '+' : ''}¥{amount.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header Area */}
            <View style={{ backgroundColor: colors.indigo, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 20, right: 10 }}
                    >
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>
                    {!isAllAccounts && (account?.cardType && account.cardType !== 'none' || account?.loginUrl || (account?.type === 'card' && account?.withdrawalAccountId)) && (
                        <TouchableOpacity
                            onPress={() => setIsMenuModalVisible(true)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 16
                            }}
                        >
                            <MoreVertical size={16} color="white" />
                            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>メニュー</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isAllAccounts ? (
                            <>
                                <Wallet size={20} color="rgba(255,255,255,0.7)" />
                                <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8, fontSize: 14 }}>全口座</Text>
                            </>
                        ) : (
                            <>
                                <Wallet size={20} color="rgba(255,255,255,0.7)" />
                                <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8, fontSize: 14 }}>{account?.name || 'アカウント'}</Text>
                            </>
                        )}
                    </View>
                    {account?.excludeFromNetWorth && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <EyeOff size={12} color="white" />
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }}>純資産非計上</Text>
                        </View>
                    )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {isAllAccounts ? (
                        <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>¥{totalNetWorth.toLocaleString()}</Text>
                    ) : (
                        <>
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
                        </>
                    )}
                </View>
                {account?.type === 'card' && nextWithdrawal && (
                    <View style={{
                        marginTop: 10,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)'
                    }}>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold' }}>
                            直近の引き落とし額 ({nextWithdrawal.dateStr})
                        </Text>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 2 }}>
                            ¥{nextWithdrawal.amount.toLocaleString()}
                        </Text>
                    </View>
                )}
            </View>

            {/* FlashList Transaction List */}

            <FlashList
                data={sectionedTransactions}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.type === 'header' ? `header-${item.date}-${index}` : `item-${item.id}-${index}`}
                getItemType={(item) => item.type}
                drawDistance={1000}
                ListHeaderComponent={() => (
                    <View style={{ paddingTop: 16, paddingBottom: 4 }}>
                        <View style={{ paddingHorizontal: 24, marginBottom: 10 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                                {isAllAccounts ? 'すべての取引（全期間）' : '取引履歴'}
                            </Text>
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
                        <Text style={{ color: colors.textMuted }}>
                            {isAllAccounts ? '取引履歴がありません' : 'このアカウントの取引履歴はありません'}
                        </Text>
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
                                                        backgroundColor: localAccountMappings[extAcc] === acc.id ? colors.indigo : colors.inputBg,
                                                        borderWidth: 1,
                                                        borderColor: localAccountMappings[extAcc] === acc.id ? colors.indigo : colors.border
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
                                style={{ flex: 2, padding: 16, borderRadius: 16, backgroundColor: colors.indigo, alignItems: 'center', opacity: Object.keys(localAccountMappings).length < missingAccountMappings.length ? 0.5 : 1 }}
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
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.indigo, marginTop: 2 }}>
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
                                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.indigo }}>手動選択...</Text>
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
                                                        style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.indigo + '20' }}
                                                    >
                                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.indigo }}>既存取引から紐付け</Text>
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
                                                    backgroundColor: candidate.resolution === 'replace' ? colors.indigo + '20' : colors.inputBg,
                                                    borderWidth: 2,
                                                    borderColor: candidate.resolution === 'replace' ? colors.indigo : 'transparent',
                                                    alignItems: 'center',
                                                    opacity: !existingTx ? 0.4 : 1
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: candidate.resolution === 'replace' ? colors.indigo : colors.textMuted }}>
                                                    既存を置換する
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setDuplicateCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, resolution: 'new' } : c))}
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 10,
                                                    borderRadius: 12,
                                                    backgroundColor: candidate.resolution === 'new' ? colors.indigo + '20' : colors.inputBg,
                                                    borderWidth: 2,
                                                    borderColor: candidate.resolution === 'new' ? colors.indigo : 'transparent',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: candidate.resolution === 'new' ? colors.indigo : colors.textMuted }}>
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
                                style={{ flex: 2, padding: 16, borderRadius: 16, backgroundColor: colors.indigo, alignItems: 'center' }}
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
                                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.indigo }}>{txDate}</Text>
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
            {/* 操作メニューポップアップモーダル */}
            <Modal
                visible={isMenuModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsMenuModalVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsMenuModalVisible(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: colors.background,
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            padding: 24,
                            paddingBottom: Platform.OS === 'ios' ? 40 : 24
                        }}
                    >
                        <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                                {account?.name} の操作メニュー
                            </Text>
                            <TouchableOpacity onPress={() => setIsMenuModalVisible(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ gap: 12, marginBottom: 12 }}>
                            {account?.cardType && account.cardType !== 'none' && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsMenuModalVisible(false);
                                        setTimeout(() => handleCsvImport(), 300);
                                    }}
                                    disabled={isCsvImporting}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: colors.card,
                                        padding: 16,
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}
                                >
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                        <FileUp size={20} color={colors.indigo} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>CSVファイルの読み込み</Text>
                                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>カードの明細CSVを取り込みます</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {account?.cardType && account.loginUrl && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsMenuModalVisible(false);
                                        Linking.openURL(account.loginUrl!);
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: colors.card,
                                        padding: 16,
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}
                                >
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                        <ExternalLink size={20} color={colors.indigo} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>会員サイトを開く</Text>
                                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Webブラウザで公式サイトにアクセスします</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {account?.type === 'card' && account.withdrawalAccountId && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsMenuModalVisible(false);
                                        setTimeout(() => handleSync(), 300);
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: colors.card,
                                        padding: 16,
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}
                                >
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                        <RefreshCw size={20} color={colors.indigo} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>引き落とし振替の更新</Text>
                                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>引落日・確定額の最新データを反映します</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
