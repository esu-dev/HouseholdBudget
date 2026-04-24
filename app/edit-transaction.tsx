import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRouter } from 'expo-router';
import { ArrowDownCircle, ArrowUpCircle, Calendar, CircleEllipsis, Clock3, ExternalLink, FileUp, Plus, Store, Trash2, Wallet, X, ZapOff } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, InputAccessoryView, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as z from 'zod';
import { CATEGORY_ICONS } from '../constants/categories';
import { useAppColorScheme } from '../hooks/useAppColorScheme';
import { csvImportService } from '../services/csvImportService';
import { databaseService } from '../services/database';
import { useTransactionStore } from '../store/useTransactionStore';



const schema = z.object({
  type: z.enum(['expense', 'income', 'transfer']),
  amount: z.string().min(1, '金額を入力してください').refine((val) => !isNaN(Number(val)), '数値で入力してください'),
  category_id: z.string().optional(),
  account_id: z.string().min(1, 'アカウントを選択してください'),
  to_account_id: z.string().optional(),
  date: z.date(),
  payee: z.string().optional(),
  memo: z.string().optional(),
  fee: z.string().optional(),
  ignore_learning: z.boolean().optional(),
  is_deferred: z.boolean().optional(),
}).refine(data => {
  if (data.type === 'transfer') return !!data.to_account_id && data.account_id !== data.to_account_id;
  return !!data.category_id;
}, {
  message: "入力内容を確認してください",
  path: ["category_id"]
});

type FormData = z.infer<typeof schema>;

export default function EditTransactionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';

  const { addTransaction, addTransactions, updateTransaction, deleteTransaction, accounts, fetchData, editingTransaction, setEditingTransaction, majorCategories, addTransfer, addMinorCategory, addMajorCategory } = useTransactionStore();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);
  const [isNewMajorModalVisible, setIsNewMajorModalVisible] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newMajorLabel, setNewMajorLabel] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // 最後に反映した取引IDを保持して、不必要なリセットを防ぐ
  const lastResolvedId = useRef<number | string | null | undefined>(undefined);

  const colors = {
    background: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? '#1e293b' : 'white',
    text: isDark ? '#f1f5f9' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    inputBg: isDark ? '#273549' : '#f8fafc',
    primary: '#6366f1',
    primarySub: isDark ? '#312e81' : '#eef2ff',
    expense: '#ef4444',
    income: '#22c55e',
    danger: '#ef4444',
  };

  const { control, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      amount: '',
      category_id: '',
      account_id: 'cash',
      to_account_id: '',
      date: new Date(),
      payee: '',
      memo: '',
      fee: '',
      ignore_learning: false,
      is_deferred: false,
    },
  });

  const transactionType = watch('type');
  const selectedMinorId = watch('category_id');
  const selectedAccountId = watch('account_id');
  const selectedToAccountId = watch('to_account_id');
  const selectedDate = watch('date');
  const payee = watch('payee');
  const isDeferred = watch('is_deferred');

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const isCardAccount = selectedAccount?.type === 'card';

  const currentMajorCategories = React.useMemo(() =>
    majorCategories.filter(c => c.type === transactionType)
    , [majorCategories, transactionType]);

  const selectedMajor = currentMajorCategories.find(c => c.id === selectedMajorId);

  // マウント時のみデータをフェッチ
  useEffect(() => {
    fetchData();
  }, []);

  // 支払先の入力に応じてカテゴリを自動設定
  useEffect(() => {
    const lookupCategoryAndIgnoreStatus = async () => {
      if (payee && payee.trim().length > 0) {
        // カテゴリの自動設定 (新規入力時のみ)
        if (!selectedMinorId && !editingTransaction) {
          const categoryId = await databaseService.getCategoryByPayee(payee.trim());
          if (categoryId) {
            setValue('category_id', categoryId);
            const major = majorCategories.find(maj => maj.subCategories.some(min => min.id === categoryId));
            if (major) setSelectedMajorId(major.id);
          }
        }

        // 除外ステータスの確認
        const isIgnored = await databaseService.isPayeeIgnored(payee.trim());
        setValue('ignore_learning', isIgnored);
      } else {
        setValue('ignore_learning', false);
      }
    };

    const timer = setTimeout(lookupCategoryAndIgnoreStatus, 600);
    return () => clearTimeout(timer);
  }, [payee, majorCategories]);

  // 取引データの初期化ロジック
  useEffect(() => {
    // すでにこの取引データを反映済みなら何もしない
    if (lastResolvedId.current === (editingTransaction?.id || null)) return;

    if (editingTransaction) {
      const type = editingTransaction.amount > 0 ? 'income' : 'expense';
      setValue('type', type);
      setValue('amount', Math.abs(editingTransaction.amount).toString());
      setValue('category_id', editingTransaction.category_id);
      setValue('account_id', editingTransaction.account_id);
      setValue('to_account_id', editingTransaction.to_account_id || '');
      setValue('date', new Date(editingTransaction.date));
      setValue('payee', editingTransaction.payee || '');
      setValue('memo', editingTransaction.memo || '');
      setValue('fee', editingTransaction.fee ? editingTransaction.fee.toString() : '');
      setValue('is_deferred', editingTransaction.is_deferred || false);

      if (editingTransaction.transfer_id) {
        setValue('type', 'transfer');
        // 他のアカウント（振替先）を探すロジックが必要だが、一旦シンプルに
      }

      const major = majorCategories.find(maj => maj.subCategories.some(min => min.id === editingTransaction.category_id));
      if (major) setSelectedMajorId(major.id);
    } else {
      reset({
        type: 'expense',
        amount: '',
        category_id: '',
        account_id: 'cash',
        date: new Date(),
        payee: '',
        memo: '',
        fee: '',
        is_deferred: false,
      });
      setSelectedMajorId(null);
    }

    lastResolvedId.current = editingTransaction?.id || null;
  }, [editingTransaction]); // majorCategoriesを依存関係から外す

  const navigateAfterAction = () => {
    reset();
    setEditingTransaction(null);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleCsvImport = async (accountId: string, cardType: any) => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const transactions = await csvImportService.pickAndParseCsv(cardType, accountId);
      if (transactions.length > 0) {
        await addTransactions(transactions);
        Alert.alert('完了', `${transactions.length}件の取引をインポートしました`);
      }
    } catch (error) {
      console.log(error);
      Alert.alert('エラー', 'CSVの読み込みに失敗しました');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleType = (type: 'expense' | 'income' | 'transfer') => {
    setValue('type', type);
    setValue('category_id', '');
    setValue('to_account_id', '');
    setSelectedMajorId(null);
  };

  const onSubmit = async (data: FormData) => {
    const amountNum = Number(data.amount);
    const amount = data.type === 'income' ? Math.abs(amountNum) : -Math.abs(amountNum);
    const feeNum = data.fee ? Math.abs(Number(data.fee)) : 0;

    // 自動学習除外設定の反映
    if (data.payee && data.payee.trim()) {
      if (data.ignore_learning) {
        await databaseService.addIgnoredPayee(data.payee.trim());
      } else {
        await databaseService.removeIgnoredPayee(data.payee.trim());
      }
    }

    if (editingTransaction) {
      if (data.type === 'transfer' && data.to_account_id) {
        // 振替の編集は一旦既存を削除して新規作成
        await deleteTransaction(editingTransaction.id);
        await addTransfer(data.account_id, data.to_account_id, amountNum, data.date.toISOString(), data.memo || null, feeNum);
      } else {
        await updateTransaction({
          ...editingTransaction,
          amount,
          category_id: data.category_id || 'others',
          account_id: data.account_id,
          date: data.date.toISOString(),
          payee: data.payee || null,
          memo: data.memo || null,
          transfer_id: null,
          fee: feeNum,
          is_deferred: !!data.is_deferred
        });
      }
    } else {
      if (data.type === 'transfer' && data.to_account_id) {
        await addTransfer(data.account_id, data.to_account_id, amountNum, data.date.toISOString(), data.memo || null, feeNum);
      } else {
        await addTransaction({
          amount,
          category_id: data.category_id || 'others',
          account_id: data.account_id,
          date: data.date.toISOString(),
          payee: data.payee || null,
          memo: data.memo || null,
          fee: feeNum,
          is_deferred: !!data.is_deferred
        });
      }
    }

    navigateAfterAction();
  };

  const handleCancel = () => {
    navigateAfterAction();
  };

  const handleDelete = () => {
    if (!editingTransaction) return;

    Alert.alert('確認', 'この取引を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(editingTransaction.id);
          navigateAfterAction();
        }
      }
    ]);
  };

  const handleAddCategory = async () => {
    if (!newCategoryLabel.trim() || !selectedMajorId) return;

    setIsAddingCategory(true);
    try {
      const newId = `custom_${Date.now()}`;
      await addMinorCategory({
        id: newId,
        parent_id: selectedMajorId,
        label: newCategoryLabel.trim(),
        displayOrder: (selectedMajor?.subCategories.length || 0) + 1
      });
      setValue('category_id', newId);
      setNewCategoryLabel('');
      setIsNewCategoryModalVisible(false);
    } catch (error) {
      Alert.alert('エラー', 'カテゴリの追加に失敗しました');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleAddMajorCategory = async () => {
    if (!newMajorLabel.trim()) return;

    setIsAddingCategory(true);
    try {
      const newId = `major_${Date.now()}`;
      await addMajorCategory({
        id: newId,
        label: newMajorLabel.trim(),
        icon: 'others',
        color: '#6366f1',
        type: transactionType as 'expense' | 'income',
        displayOrder: currentMajorCategories.length
      });
      setSelectedMajorId(newId);
      setNewMajorLabel('');
      setIsNewMajorModalVisible(false);
    } catch (error) {
      Alert.alert('エラー', '大カテゴリの追加に失敗しました');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const amountAccessoryID = 'amountDoneButton';
  const payeeAccessoryID = 'payeeDoneButton';
  const memoAccessoryID = 'memoDoneButton';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView style={{ flex: 1, padding: 16, paddingTop: 24 }} showsVerticalScrollIndicator={false}>
          {/* CSV Import Section */}
          {!editingTransaction && accounts.some(acc => acc.cardType && acc.cardType !== 'none') && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                CSVからインポート
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {accounts.filter(acc => acc.cardType && acc.cardType !== 'none').map((account) => (
                  <TouchableOpacity
                    key={`csv-${account.id}`}
                    onPress={() => handleCsvImport(account.id, account.cardType)}
                    disabled={isImporting}
                    style={{
                      flex: 1,
                      minWidth: '45%',
                      backgroundColor: colors.card,
                      padding: 16,
                      borderRadius: 20,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: isImporting ? 0.6 : 1
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySub, alignItems: 'center', justifyContent: 'center' }}>
                      <FileUp size={18} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }} numberOfLines={1}>{account.name}</Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted }}>{account.cardType === 'jp_bank' ? 'JP BANK' : 'JCB'}</Text>
                    </View>
                    {account.loginUrl && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(account.loginUrl!)}
                        style={{ padding: 8, backgroundColor: colors.inputBg, borderRadius: 10 }}
                      >
                        <ExternalLink size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
                  {editingTransaction ? '取引を編集' : '新規入力'}
                </Text>
              </View>
              {editingTransaction && (
                <TouchableOpacity
                  onPress={handleDelete}
                  hitSlop={{ top: 40, bottom: 10, left: 20, right: 20 }}
                >
                  <Trash2 size={22} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#334155' : '#f1f5f9', padding: 4, borderRadius: 16, marginBottom: 32 }}>
              <TouchableOpacity
                onPress={() => toggleType('expense')}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: transactionType === 'expense' ? (isDark ? '#475569' : 'white') : 'transparent' }}
              >
                <ArrowDownCircle size={18} color={transactionType === 'expense' ? colors.expense : colors.textMuted} />
                <Text style={{ marginLeft: 8, fontWeight: 'bold', color: transactionType === 'expense' ? colors.text : colors.textMuted }}>支出</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleType('income')}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: transactionType === 'income' ? (isDark ? '#475569' : 'white') : 'transparent' }}
              >
                <ArrowUpCircle size={18} color={transactionType === 'income' ? colors.income : colors.textMuted} />
                <Text style={{ marginLeft: 8, fontWeight: 'bold', color: transactionType === 'income' ? colors.text : colors.textMuted }}>収入</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleType('transfer')}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: transactionType === 'transfer' ? (isDark ? '#475569' : 'white') : 'transparent' }}
              >
                <ExternalLink size={18} color={transactionType === 'transfer' ? colors.primary : colors.textMuted} />
                <Text style={{ marginLeft: 8, fontWeight: 'bold', color: transactionType === 'transfer' ? colors.text : colors.textMuted }}>振替</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textMuted, marginBottom: 8, fontWeight: '500' }}>金額</Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, value } }) => (
                <View>
                  <TextInput
                    style={{ fontSize: 36, fontWeight: 'bold', color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 }}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    inputAccessoryViewID={amountAccessoryID}
                    onChangeText={onChange}
                    value={value || ''}
                  />
                  {errors.amount && (
                    <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}>{errors.amount.message}</Text>
                  )}
                </View>
              )}
            />

            {transactionType === 'transfer' && (
              <>
                <Text style={{ color: colors.textMuted, marginTop: 16, marginBottom: 8, fontWeight: '500' }}>手数料（任意）</Text>
                <Controller
                  control={control}
                  name="fee"
                  render={({ field: { onChange, value } }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, padding: 16, borderRadius: 12 }}>
                      <Text style={{ fontSize: 18, color: colors.textMuted }}>¥</Text>
                      <TextInput
                        style={{ marginLeft: 8, flex: 1, fontSize: 18, color: colors.text }}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        onChangeText={onChange}
                        value={value || ''}
                      />
                    </View>
                  )}
                />
              </>
            )}

            {transactionType !== 'transfer' && (
              <>
                <Text style={{ color: colors.textMuted, marginTop: 24, marginBottom: 12, fontWeight: '500' }}>大カテゴリ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {currentMajorCategories.map((major) => {
                    const IconComp = CATEGORY_ICONS[major.icon] || CircleEllipsis;
                    const isSelected = selectedMajorId === major.id;
                    return (
                      <TouchableOpacity
                        key={major.id}
                        onPress={() => {
                          setSelectedMajorId(major.id);
                          if (selectedMinorId && !major.subCategories.some(s => s.id === selectedMinorId)) {
                            setValue('category_id', '');
                          }
                        }}
                        style={{
                          padding: 12, borderRadius: 16, alignItems: 'center', marginRight: 10, minWidth: 80,
                          backgroundColor: isSelected ? colors.primarySub : colors.inputBg,
                          borderWidth: 2, borderColor: isSelected ? colors.primary : 'transparent'
                        }}
                      >
                        <IconComp size={24} color={isSelected ? colors.primary : major.color} />
                        <Text style={{ fontSize: 12, marginTop: 4, fontWeight: isSelected ? 'bold' : '500', color: isSelected ? (isDark ? '#a5b4fc' : colors.primary) : colors.textMuted }}>
                          {major.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  
                  {/* 大カテゴリ追加ボタン */}
                  <TouchableOpacity
                    onPress={() => setIsNewMajorModalVisible(true)}
                    style={{
                      padding: 12, borderRadius: 16, alignItems: 'center', marginRight: 10, minWidth: 80,
                      backgroundColor: colors.inputBg,
                      borderWidth: 2, borderColor: 'transparent'
                    }}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isDark ? '#334155' : '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={16} color={colors.textMuted} />
                    </View>
                    <Text style={{ fontSize: 12, marginTop: 4, fontWeight: '500', color: colors.textMuted }}>
                      追加
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {selectedMajor ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.textMuted, marginBottom: 12, fontWeight: '500' }}>小カテゴリ（{selectedMajor.label}）</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {selectedMajor.subCategories.map((minor) => {
                        const isSelected = selectedMinorId === minor.id;
                        return (
                          <TouchableOpacity
                            key={minor.id}
                            onPress={() => setValue('category_id', minor.id)}
                            style={{
                              paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 8, marginBottom: 8,
                              backgroundColor: isSelected ? selectedMajor.color : (isDark ? '#334155' : '#f1f5f9'),
                              borderWidth: 1, borderColor: isSelected ? selectedMajor.color : colors.border
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? 'white' : colors.text }}>
                              {minor.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      
                      {/* カテゴリ追加ボタン */}
                      <TouchableOpacity
                        onPress={() => setIsNewCategoryModalVisible(true)}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 8, marginBottom: 8,
                          backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                          borderWidth: 1, borderColor: colors.border,
                          flexDirection: 'row', alignItems: 'center'
                        }}
                      >
                        <Plus size={14} color={colors.textMuted} />
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginLeft: 4 }}>
                          追加
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 16, marginTop: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>大カテゴリを選択してください</Text>
                  </View>
                )}
                {errors.category_id && (
                  <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}>カテゴリを選択してください</Text>
                )}
              </>
            )}

            <Text style={{ color: colors.textMuted, marginTop: 16, marginBottom: 12, fontWeight: '500' }}>{transactionType === 'transfer' ? '振替元アカウント' : 'アカウント'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {accounts.filter(acc => !acc.isHidden || acc.id === selectedAccountId).map((account) => {
                const isAccSelected = selectedAccountId === account.id;
                return (
                  <TouchableOpacity
                    key={account.id}
                    onPress={() => {
                      setValue('account_id', account.id);
                      if (transactionType === 'transfer' && selectedToAccountId === account.id) {
                        setValue('to_account_id', '');
                      }
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginRight: 8, marginBottom: 8,
                      backgroundColor: isAccSelected ? colors.primarySub : colors.inputBg,
                      borderWidth: 2, borderColor: isAccSelected ? colors.primary : 'transparent'
                    }}
                  >
                    <Wallet size={16} color={isAccSelected ? colors.primary : colors.textMuted} />
                    <Text style={{ marginLeft: 8, fontWeight: '500', color: isAccSelected ? (isDark ? '#a5b4fc' : '#475569') : colors.textMuted }}>
                      {account.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {transactionType === 'transfer' && (
              <>
                <Text style={{ color: colors.textMuted, marginTop: 16, marginBottom: 12, fontWeight: '500' }}>振替先アカウント</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {accounts.filter(a => a.id !== selectedAccountId && (!a.isHidden || a.id === selectedToAccountId)).map((account) => {
                    const isAccSelected = selectedToAccountId === account.id;
                    return (
                      <TouchableOpacity
                        key={`to-${account.id}`}
                        onPress={() => setValue('to_account_id', account.id)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginRight: 8, marginBottom: 8,
                          backgroundColor: isAccSelected ? colors.primarySub : colors.inputBg,
                          borderWidth: 2, borderColor: isAccSelected ? colors.primary : 'transparent'
                        }}
                      >
                        <Wallet size={16} color={isAccSelected ? colors.primary : colors.textMuted} />
                        <Text style={{ marginLeft: 8, fontWeight: '500', color: isAccSelected ? (isDark ? '#a5b4fc' : '#475569') : colors.textMuted }}>
                          {account.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.to_account_id && (
                  <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}>振替先を選択してください</Text>
                )}
              </>
            )}

            <Text style={{ color: colors.textMuted, marginTop: 24, marginBottom: 8, fontWeight: '500' }}>日付</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(!showDatePicker)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, padding: 16, borderRadius: 12 }}
            >
              <Calendar size={20} color={colors.textMuted} />
              <Text style={{ marginLeft: 12, fontSize: 18, color: colors.text }}>
                {selectedDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <View>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ alignItems: 'flex-end', padding: 8 }}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>完了</Text>
                  </TouchableOpacity>
                )}
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  locale="ja-JP"
                  themeVariant={isDark ? 'dark' : 'light'}
                  onChange={(event, date) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (date) setValue('date', date);
                  }}
                />
              </View>
            )}

            {transactionType !== 'transfer' && (
              <>
                <Text style={{ color: colors.textMuted, marginTop: 24, marginBottom: 8, fontWeight: '500' }}>支払先・振込元（任意）</Text>
                <Controller
                  control={control}
                  name="payee"
                  render={({ field: { onChange, value } }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, padding: 16, borderRadius: 12 }}>
                      <Store size={20} color={colors.textMuted} />
                      <TextInput
                        style={{ marginLeft: 12, flex: 1, fontSize: 18, color: colors.text }}
                        placeholder={transactionType === 'expense' ? "例: コンビニ、スーパー" : "例: 会社、〇〇さん"}
                        placeholderTextColor={colors.textMuted}
                        inputAccessoryViewID={payeeAccessoryID}
                        onChangeText={onChange}
                        value={value || ''}
                      />
                    </View>
                  )}
                />

                <Controller
                  control={control}
                  name="ignore_learning"
                  render={({ field: { onChange, value } }) => (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.inputBg,
                      padding: 12,
                      borderRadius: 12,
                      marginTop: 8
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <ZapOff size={16} color={value ? colors.primary : colors.textMuted} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: value ? colors.primary : colors.text }}>
                            カテゴリの自動学習を除外
                          </Text>
                          <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                            この支払先のカテゴリ対応を記録しません
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={value}
                        onValueChange={onChange}
                        trackColor={{ false: isDark ? '#334155' : '#e2e8f0', true: colors.primary + '80' }}
                        thumbColor={value ? colors.primary : '#f4f3f4'}
                        ios_backgroundColor={isDark ? '#334155' : '#e2e8f0'}
                      />
                    </View>
                  )}
                />

                {isCardAccount && transactionType === 'expense' && (
                  <Controller
                    control={control}
                    name="is_deferred"
                    render={({ field: { onChange, value } }) => (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: colors.inputBg,
                        padding: 12,
                        borderRadius: 12,
                        marginTop: 8
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Clock3 size={16} color={value ? colors.primary : colors.textMuted} />
                          <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: value ? colors.primary : colors.text }}>
                              引き落としを翌月に繰り越す
                            </Text>
                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                              ETC等の請求タイミングがずれる支払いに使用します
                            </Text>
                          </View>
                        </View>
                        <Switch
                          value={value}
                          onValueChange={onChange}
                          trackColor={{ false: isDark ? '#334155' : '#e2e8f0', true: colors.primary + '80' }}
                          thumbColor={value ? colors.primary : '#f4f3f4'}
                          ios_backgroundColor={isDark ? '#334155' : '#e2e8f0'}
                        />
                      </View>
                    )}
                  />
                )}
              </>
            )}

            <Text style={{ color: colors.textMuted, marginTop: 8, marginBottom: 8, fontWeight: '500' }}>メモ（任意）</Text>
            <Controller
              control={control}
              name="memo"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={{ backgroundColor: colors.inputBg, padding: 16, borderRadius: 12, fontSize: 18, color: colors.text, textAlignVertical: 'top', minHeight: 100 }}
                  placeholder="備考など"
                  placeholderTextColor={colors.textMuted}
                  inputAccessoryViewID={memoAccessoryID}
                  onChangeText={onChange}
                  value={value || ''}
                  multiline
                />
              )}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          style={{
            padding: 20, borderRadius: 16, alignItems: 'center',
            backgroundColor: transactionType === 'expense' ? colors.primary : (transactionType === 'income' ? colors.income : colors.primary)
          }}
        >
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
            {editingTransaction ? '更新を保存する' : '取引を保存する'}
          </Text>
        </TouchableOpacity>
      </View>

      {Platform.OS === 'ios' && (
        <>
          <InputAccessoryView nativeID={amountAccessoryID}>
            <View style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9', padding: 8, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18, paddingHorizontal: 16 }}>完了</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          <InputAccessoryView nativeID={payeeAccessoryID}>
            <View style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9', padding: 8, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18, paddingHorizontal: 16 }}>完了</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          <InputAccessoryView nativeID={memoAccessoryID}>
            <View style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9', padding: 8, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18, paddingHorizontal: 16 }}>完了</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        </>
      )}

      {/* 新規カテゴリ追加モーダル */}
      <Modal
        visible={isNewCategoryModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsNewCategoryModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: 400 }}
          >
            <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>新しいカテゴリを追加</Text>
                <TouchableOpacity onPress={() => setIsNewCategoryModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
                「{selectedMajor?.label}」に新しい項目を追加します
              </Text>

              <TextInput
                autoFocus
                style={{ backgroundColor: colors.inputBg, padding: 16, borderRadius: 12, fontSize: 18, color: colors.text, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                placeholder="カテゴリ名（例: ランチ、おやつ）"
                placeholderTextColor={colors.textMuted}
                value={newCategoryLabel}
                onChangeText={setNewCategoryLabel}
                returnKeyType="done"
                onSubmitEditing={handleAddCategory}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setIsNewCategoryModalVisible(false)}
                  style={{ flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: colors.inputBg }}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: 'bold' }}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddCategory}
                  disabled={!newCategoryLabel.trim() || isAddingCategory}
                  style={{ flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary, opacity: (!newCategoryLabel.trim() || isAddingCategory) ? 0.6 : 1 }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>追加して選択</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 新規大カテゴリ追加モーダル */}
      <Modal
        visible={isNewMajorModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsNewMajorModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: 400 }}
          >
            <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>新しい大カテゴリを追加</Text>
                <TouchableOpacity onPress={() => setIsNewMajorModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
                {transactionType === 'expense' ? '支出' : '収入'}の大カテゴリを作成します
              </Text>

              <TextInput
                autoFocus
                style={{ backgroundColor: colors.inputBg, padding: 16, borderRadius: 12, fontSize: 18, color: colors.text, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                placeholder="大カテゴリ名（例: 食費、趣味）"
                placeholderTextColor={colors.textMuted}
                value={newMajorLabel}
                onChangeText={setNewMajorLabel}
                returnKeyType="done"
                onSubmitEditing={handleAddMajorCategory}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setIsNewMajorModalVisible(false)}
                  style={{ flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: colors.inputBg }}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: 'bold' }}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddMajorCategory}
                  disabled={!newMajorLabel.trim() || isAddingCategory}
                  style={{ flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary, opacity: (!newMajorLabel.trim() || isAddingCategory) ? 0.6 : 1 }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>追加して選択</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
