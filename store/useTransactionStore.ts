import { create } from 'zustand';
import { MajorCategory, MinorCategory } from '../constants/categories';
import { creditCardPaymentService } from '../services/creditCardPaymentService';
import { databaseService } from '../services/database';
import { Account } from '../types/account';
import { Budget, CreateBudgetInput } from '../types/budget';
import { CreateFixedExpenseInput, FixedExpense, UpdateFixedExpenseInput } from '../types/fixedExpense';
import { CreateTransactionInput, Transaction } from '../types/transaction';

interface TransactionState {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  majorCategories: MajorCategory[];
  accountBalances: Record<string, number>;
  csvAccountMappings: Record<string, string>;
  fixedExpenses: FixedExpense[];
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlyExpensesByCategory: Record<string, number>;
  maxMonthlyExpensesByCategory: Record<string, number>;
  expectedMonthlyIncome: number;
  savingsGoal: number;
  incomeCategoryIdsForAverage: string[];
  editingTransaction: Transaction | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (baseDate?: string) => Promise<void>;
  fetchBudgets: (month: string) => Promise<void>;
  fetchStatistics: (baseDate?: string) => Promise<void>;
  updateExpectedMonthlyIncome: (amount: number) => Promise<void>;
  updateSavingsGoal: (amount: number) => Promise<void>;
  updateIncomeCategoriesForAverage: (categoryIds: string[]) => Promise<void>;
  addTransaction: (transaction: CreateTransactionInput) => Promise<void>;
  addTransactions: (transactions: CreateTransactionInput[]) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  deletePlannedTransactions: (ids: number[]) => Promise<void>;
  addTransfer: (fromAccountId: string, toAccountId: string, amount: number, date: string, memo: string | null, fee?: number) => Promise<void>;
  addAccount: (account: Omit<Account, 'balance'>) => Promise<void>;
  updateAccount: (account: Omit<Account, 'balance'>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  deleteAllTransactionsForAccount: (accountId: string) => Promise<void>;
  upsertBudget: (budget: CreateBudgetInput) => Promise<void>;
  syncCardTransfers: (accountId: string, dateStr: string) => Promise<void>;
  reorderAccounts: (startIndex: number, endIndex: number) => Promise<void>;
  setEditingTransaction: (transaction: Transaction | null) => void;
  // Category Actions
  addMajorCategory: (major: Omit<MajorCategory, 'subCategories'>) => Promise<void>;
  updateMajorCategory: (major: Omit<MajorCategory, 'subCategories'>) => Promise<void>;
  deleteMajorCategory: (id: string) => Promise<void>;
  addMinorCategory: (minor: MinorCategory & { parent_id: string }) => Promise<void>;
  updateMinorCategory: (minor: MinorCategory) => Promise<void>;
  deleteMinorCategory: (id: string) => Promise<void>;
  reorderMajorCategories: (type: 'expense' | 'income', startIndex: number, endIndex: number) => Promise<void>;
  reorderMinorCategories: (parentId: string, startIndex: number, endIndex: number) => Promise<void>;
  deleteAllData: () => Promise<void>;
  // Payee Actions
  getIgnoredPayees: () => Promise<string[]>;
  addIgnoredPayee: (payee: string) => Promise<void>;
  removeIgnoredPayee: (payee: string) => Promise<void>;
  fetchCsvAccountMappings: () => Promise<void>;
  setCsvAccountMapping: (externalName: string, internalId: string) => Promise<void>;
  // Fixed Expense Actions
  fetchFixedExpenses: () => Promise<void>;
  addFixedExpense: (input: CreateFixedExpenseInput) => Promise<void>;
  updateFixedExpense: (input: UpdateFixedExpenseInput) => Promise<void>;
  deleteFixedExpense: (id: number) => Promise<void>;
  toggleFixedExpenseActive: (id: number, isActive: boolean) => Promise<void>;
  recordFixedExpensesForMonth: (monthStr: string, expenseIds?: number[]) => Promise<{ addedCount: number; skippedCount: number }>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  accounts: [],
  budgets: [],
  majorCategories: [],
  accountBalances: {},
  csvAccountMappings: {},
  fixedExpenses: [],
  averageMonthlyIncome: 0,
  averageMonthlyExpense: 0,
  averageMonthlyExpensesByCategory: {},
  maxMonthlyExpensesByCategory: {},
  expectedMonthlyIncome: 0,
  savingsGoal: 0,
  incomeCategoryIdsForAverage: [],
  editingTransaction: null,
  isLoading: false,
  error: null,

  fetchData: async (baseDate?: string) => {
    set({ isLoading: true });
    try {
      const [transactions, accounts, balances, categories, expectedMonthlyIncome, savingsGoal, incomeCats, csvMappings, fixedExpenses] = await Promise.all([
        databaseService.getAllTransactions(),
        databaseService.getAllAccounts(),
        databaseService.getAccountBalances(),
        databaseService.getAllMajorCategories(),
        databaseService.getSetting('expected_monthly_income'),
        databaseService.getSetting('savings_goal'),
        databaseService.getSetting('income_categories_for_average'),
        databaseService.getAllCsvAccountMappings(),
        databaseService.getAllFixedExpenses(),
      ]);

      const incomeCategoryIds = incomeCats ? JSON.parse(incomeCats) : [];
      
      const [avgIncome, avgExpense, avgExpenses, maxExpenses] = await Promise.all([
        databaseService.getAverageMonthlyIncome(6, incomeCategoryIds, baseDate),
        databaseService.getAverageMonthlyExpense(6, baseDate),
        databaseService.getAverageMonthlyExpenseByCategory(6, baseDate),
        databaseService.getMaxMonthlyExpenseByCategory(6, baseDate),
      ]);

      const balanceMap: Record<string, number> = {};
      balances.forEach(b => {
        balanceMap[b.account_id] = b.balance;
      });

      set({
        transactions,
        accounts,
        accountBalances: balanceMap,
        majorCategories: categories,
        averageMonthlyIncome: avgIncome,
        averageMonthlyExpense: avgExpense,
        averageMonthlyExpensesByCategory: avgExpenses,
        maxMonthlyExpensesByCategory: maxExpenses,
        expectedMonthlyIncome: expectedMonthlyIncome ? parseInt(expectedMonthlyIncome) : 0,
        savingsGoal: savingsGoal ? parseInt(savingsGoal) : 0,
        incomeCategoryIdsForAverage: incomeCategoryIds,
        csvAccountMappings: csvMappings || {},
        fixedExpenses: fixedExpenses || [],
        isLoading: false
      });
    } catch (error) {
      set({ error: 'Failed to fetch data', isLoading: false });
    }
  },

  fetchBudgets: async (month: string) => {
    try {
      const budgets = await databaseService.getBudgetsByMonth(month);
      set({ budgets });
    } catch (error) {
      set({ error: 'Failed to fetch budgets' });
    }
  },

  fetchStatistics: async (baseDate?: string) => {
    try {
      const { incomeCategoryIdsForAverage } = get();
      const [avgIncome, avgExpense, avgExpenses, maxExpenses] = await Promise.all([
        databaseService.getAverageMonthlyIncome(6, incomeCategoryIdsForAverage, baseDate),
        databaseService.getAverageMonthlyExpense(6, baseDate),
        databaseService.getAverageMonthlyExpenseByCategory(6, baseDate),
        databaseService.getMaxMonthlyExpenseByCategory(6, baseDate),
      ]);
      set({ 
        averageMonthlyIncome: avgIncome,
        averageMonthlyExpense: avgExpense,
        averageMonthlyExpensesByCategory: avgExpenses,
        maxMonthlyExpensesByCategory: maxExpenses
      });
    } catch (error) {
      set({ error: 'Failed to fetch statistics' });
    }
  },

  updateExpectedMonthlyIncome: async (amount: number) => {
    try {
      await databaseService.updateSetting('expected_monthly_income', amount.toString());
      set({ expectedMonthlyIncome: amount });
    } catch (error) {
      set({ error: 'Failed to update expected monthly income' });
    }
  },

  updateIncomeCategoriesForAverage: async (categoryIds: string[]) => {
    try {
      await databaseService.updateSetting('income_categories_for_average', JSON.stringify(categoryIds));
      set({ incomeCategoryIdsForAverage: categoryIds });
      await get().fetchStatistics();
    } catch (error) {
      set({ error: 'Failed to update income categories for average' });
    }
  },

  updateSavingsGoal: async (amount: number) => {
    try {
      await databaseService.updateSetting('savings_goal', amount.toString());
      set({ savingsGoal: amount });
    } catch (error) {
      set({ error: 'Failed to update savings goal' });
    }
  },

  addTransaction: async (transaction: CreateTransactionInput) => {
    try {
      await databaseService.addTransaction(transaction);
      // クレジットカード振替の更新
      await creditCardPaymentService.updateTransferForDate(transaction.account_id, transaction.date);
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to add transaction' });
    }
  },

  addTransactions: async (transactions: CreateTransactionInput[]) => {
    try {
      for (const t of transactions) {
        try {
          await databaseService.addTransaction(t);
        } catch (e) {
          console.error('Error adding individual transaction during batch import:', e);
        }
      }
      // 全て追加した後に、関係する全ての口座の振替を一括更新
      const affectedAccountIds = new Set(transactions.map(t => t.account_id));
      for (const accountId of affectedAccountIds) {
        await creditCardPaymentService.updateTransferForDate(accountId);
      }
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to add transactions' });
    }
  },

  updateTransaction: async (transaction: Transaction) => {
    try {
      const oldTx = get().transactions.find(t => t.id === transaction.id);
      await databaseService.updateTransaction(transaction);

      // クレジットカード振替の更新 (変更前後の口座に対して)
      if (oldTx) {
        await creditCardPaymentService.updateTransferForDate(oldTx.account_id);
        if (oldTx.account_id !== transaction.account_id) {
          await creditCardPaymentService.updateTransferForDate(transaction.account_id);
        }
      } else {
        await creditCardPaymentService.updateTransferForDate(transaction.account_id);
      }

      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to update transaction' });
    }
  },

  deleteTransaction: async (id: number) => {
    try {
      const tx = get().transactions.find(t => t.id === id);
      await databaseService.deleteTransaction(id);

      // クレジットカード振替の更新
      if (tx) {
        await creditCardPaymentService.updateTransferForDate(tx.account_id, tx.date);
      }

      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to delete transaction' });
    }
  },

  deletePlannedTransactions: async (ids: number[]) => {
    try {
      const txs = get().transactions.filter(t => ids.includes(t.id));
      await databaseService.deletePlannedTransactions(ids);

      // クレジットカード振替の更新
      const affectedAccountIds = new Set(txs.map(t => t.account_id));
      for (const accountId of affectedAccountIds) {
        await creditCardPaymentService.updateTransferForDate(accountId);
      }

      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to delete planned transactions' });
    }
  },

  addTransfer: async (fromAccountId, toAccountId, amount, date, memo, fee = 0) => {
    try {
      const transferId = Date.now();

      // 振替元からの出金
      await databaseService.addTransaction({
        amount: -Math.abs(amount),
        category_id: 'transfer',
        account_id: fromAccountId,
        to_account_id: toAccountId,
        date,
        memo: memo || '振替',
        payee: null,
        transfer_id: transferId,
        fee: 0 // 手数料は独立した取引にするためここでは0
      });

      // 振替先への入金
      await databaseService.addTransaction({
        amount: Math.abs(amount),
        category_id: 'transfer',
        account_id: toAccountId,
        to_account_id: fromAccountId,
        date,
        memo: memo || '振替',
        payee: null,
        transfer_id: transferId,
        fee: 0
      });

      // 手数料が発生している場合、別途支出取引を作成
      if (fee > 0) {
        const fromAccountName = get().accounts.find(a => a.id === fromAccountId)?.name;
        const toAccountName = get().accounts.find(a => a.id === toAccountId)?.name;
        await databaseService.addTransaction({
          amount: -Math.abs(fee),
          category_id: 'others', // 手数料用カテゴリがないため「その他」を使用
          account_id: fromAccountId,
          date,
          memo: memo ? `${memo} (手数料)` : '振替手数料',
          payee: `振替手数料 (${fromAccountName} → ${toAccountName})`,
          transfer_id: transferId, // 振替IDを紐付けることで一括削除を可能にする
          fee: 0
        });
      }

      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to add transfer' });
    }
  },

  addAccount: async (account: Omit<Account, 'balance'>) => {
    try {
      await databaseService.addAccount(account);
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to add account' });
    }
  },

  updateAccount: async (account: Omit<Account, 'balance'>) => {
    try {
      await databaseService.updateAccount(account);

      // アカウント情報（締め日や引き落とし口座など）が変更された可能性があるため、
      // 全取引の振替を最新の設定で再計算・一括同期する
      await creditCardPaymentService.updateTransferForDate(account.id);

      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to update account' });
    }
  },

  deleteAccount: async (id: string) => {
    try {
      await databaseService.deleteAccount(id);
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to delete account' });
    }
  },

  deleteAllTransactionsForAccount: async (accountId: string) => {
    try {
      await databaseService.deleteAllTransactionsForAccount(accountId);
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to delete all transactions' });
    }
  },

  upsertBudget: async (budget: CreateBudgetInput) => {
    try {
      await databaseService.upsertBudget(budget);
      const currentMonth = budget.month;
      const budgets = await databaseService.getBudgetsByMonth(currentMonth);
      set({ budgets });
    } catch (error) {
      set({ error: 'Failed to upsert budget' });
    }
  },

  syncCardTransfers: async (accountId: string, dateStr: string) => {
    try {
      set({ isLoading: true });
      await creditCardPaymentService.updateTransferForDate(accountId, dateStr);
      await get().fetchData();
      set({ isLoading: false });
    } catch (error) {
      set({ error: 'Failed to sync transfers', isLoading: false });
    }
  },

  reorderAccounts: async (startIndex: number, endIndex: number) => {
    const { accounts } = get();
    // 現金以外の口座を対象にする
    const cashAccount = accounts.find(a => a.id === 'cash');
    const otherAccounts = accounts.filter(a => a.id !== 'cash');

    const result = Array.from(otherAccounts);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    const updates = result.map((a, index) => ({
      id: a.id,
      displayOrder: index + 1 // 現金が0番目
    }));

    if (cashAccount) {
      updates.unshift({ id: 'cash', displayOrder: 0 });
    }

    await databaseService.updateAccountsOrder(updates);
    await get().fetchData();
  },

  setEditingTransaction: (transaction: Transaction | null) => {
    set({ editingTransaction: transaction });
  },

  // Category Actions
  addMajorCategory: async (major) => {
    await databaseService.addMajorCategory(major);
    await get().fetchData();
  },

  updateMajorCategory: async (major) => {
    await databaseService.updateMajorCategory(major);
    await get().fetchData();
  },

  deleteMajorCategory: async (id) => {
    await databaseService.deleteMajorCategory(id);
    await get().fetchData();
  },

  addMinorCategory: async (minor) => {
    await databaseService.addMinorCategory(minor);
    await get().fetchData();
  },

  updateMinorCategory: async (minor) => {
    await databaseService.updateMinorCategory(minor);
    await get().fetchData();
  },

  deleteMinorCategory: async (id) => {
    await databaseService.deleteMinorCategory(id);
    await get().fetchData();
  },

  reorderMajorCategories: async (type, startIndex, endIndex) => {
    const majors = get().majorCategories.filter(m => m.type === type);
    const otherMajors = get().majorCategories.filter(m => m.type !== type);

    const result = Array.from(majors);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    const updates = result.map((m, index) => ({
      id: m.id,
      display_order: index
    }));

    await databaseService.updateMajorCategoriesOrder(updates);
    await get().fetchData();
  },

  reorderMinorCategories: async (parentId, startIndex, endIndex) => {
    const major = get().majorCategories.find(m => m.id === parentId);
    if (!major) return;

    const result = Array.from(major.subCategories);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    const updates = result.map((m, index) => ({
      id: m.id,
      display_order: index
    }));

    await databaseService.updateMinorCategoriesOrder(updates);
    await get().fetchData();
  },

  deleteAllData: async () => {
    set({ isLoading: true });
    try {
      await databaseService.deleteAllData();
      await get().fetchData();
      try {
        const { useWishlistStore } = require('./useWishlistStore');
        useWishlistStore.getState().fetchWishlist();
      } catch (e) {}
      set({ isLoading: false });
    } catch (error) {
      set({ error: 'Failed to delete all data', isLoading: false });
    }
  },

  getIgnoredPayees: async () => {
    return await databaseService.getIgnoredPayees();
  },

  addIgnoredPayee: async (payee) => {
    await databaseService.addIgnoredPayee(payee);
  },

  removeIgnoredPayee: async (payee) => {
    await databaseService.removeIgnoredPayee(payee);
  },

  fetchCsvAccountMappings: async () => {
    const mappings = await databaseService.getAllCsvAccountMappings();
    set({ csvAccountMappings: mappings });
  },

  setCsvAccountMapping: async (externalName, internalId) => {
    await databaseService.setCsvAccountMapping(externalName, internalId);
    await get().fetchCsvAccountMappings();
  },

  fetchFixedExpenses: async () => {
    try {
      const fixedExpenses = await databaseService.getAllFixedExpenses();
      set({ fixedExpenses });
    } catch (error) {
      console.error('Failed to fetch fixed expenses:', error);
    }
  },

  addFixedExpense: async (input: CreateFixedExpenseInput) => {
    try {
      await databaseService.addFixedExpense(input);
      await get().fetchFixedExpenses();
    } catch (error) {
      console.error('Failed to add fixed expense:', error);
      throw error;
    }
  },

  updateFixedExpense: async (input: UpdateFixedExpenseInput) => {
    try {
      await databaseService.updateFixedExpense(input);
      await get().fetchFixedExpenses();
    } catch (error) {
      console.error('Failed to update fixed expense:', error);
      throw error;
    }
  },

  deleteFixedExpense: async (id: number) => {
    try {
      await databaseService.deleteFixedExpense(id);
      await get().fetchFixedExpenses();
    } catch (error) {
      console.error('Failed to delete fixed expense:', error);
      throw error;
    }
  },

  toggleFixedExpenseActive: async (id: number, isActive: boolean) => {
    try {
      await databaseService.toggleFixedExpenseActive(id, isActive);
      await get().fetchFixedExpenses();
    } catch (error) {
      console.error('Failed to toggle fixed expense:', error);
      throw error;
    }
  },

  recordFixedExpensesForMonth: async (monthStr: string, expenseIds?: number[]) => {
    try {
      const { fixedExpenses, transactions, addTransactions } = get();
      const [yearStr, mStr] = monthStr.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(mStr, 10);
      const daysInMonth = new Date(year, month, 0).getDate();

      const targetExpenses = fixedExpenses.filter(f => {
        if (!f.is_active) return false;
        if (expenseIds && !expenseIds.includes(f.id)) return false;
        return true;
      });

      const existingHashes = new Set(transactions.map(t => t.import_hash).filter(Boolean));
      const toAdd: CreateTransactionInput[] = [];
      let skippedCount = 0;

      for (const expense of targetExpenses) {
        const importHash = `fixed_${expense.id}_${monthStr}`;
        if (existingHashes.has(importHash)) {
          skippedCount++;
          continue;
        }

        const day = Math.min(Math.max(1, expense.payment_day), daysInMonth);
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${yearStr}-${mStr}-${dayStr}`;

        toAdd.push({
          amount: -Math.abs(expense.amount),
          category_id: expense.category_id,
          account_id: expense.account_id,
          date: dateStr,
          payee: expense.payee || expense.name,
          memo: expense.memo ? `[固定費] ${expense.memo}` : `[固定費] ${expense.name}`,
          import_hash: importHash,
          tags: ['固定費'],
          exclude_from_balance: false,
          exclude_from_budget: false,
          is_planned: true,
          auto_delete_date: dateStr,
        });
      }

      if (toAdd.length > 0) {
        await addTransactions(toAdd);
      }

      return { addedCount: toAdd.length, skippedCount };
    } catch (error) {
      console.error('Failed to record fixed expenses:', error);
      throw error;
    }
  },
}));
