import { create } from 'zustand';
import { MajorCategory, MinorCategory } from '../constants/categories';
import { creditCardPaymentService } from '../services/creditCardPaymentService';
import { databaseService } from '../services/database';
import { Account } from '../types/account';
import { Budget, CreateBudgetInput } from '../types/budget';
import { CreateTransactionInput, Transaction } from '../types/transaction';

interface TransactionState {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  majorCategories: MajorCategory[];
  accountBalances: Record<string, number>;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlyExpensesByCategory: Record<string, number>;
  savingsGoal: number;
  editingTransaction: Transaction | null;
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  fetchBudgets: (month: string) => Promise<void>;
  fetchStatistics: () => Promise<void>;
  updateSavingsGoal: (amount: number) => Promise<void>;
  addTransaction: (transaction: CreateTransactionInput) => Promise<void>;
  addTransactions: (transactions: CreateTransactionInput[]) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  addTransfer: (fromAccountId: string, toAccountId: string, amount: number, date: string, memo: string | null, fee?: number) => Promise<void>;
  addAccount: (account: Omit<Account, 'balance'>) => Promise<void>;
  updateAccount: (account: Omit<Account, 'balance'>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
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
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  accounts: [],
  budgets: [],
  majorCategories: [],
  accountBalances: {},
  averageMonthlyIncome: 0,
  averageMonthlyExpense: 0,
  averageMonthlyExpensesByCategory: {},
  savingsGoal: 0,
  editingTransaction: null,
  isLoading: false,
  error: null,

  fetchData: async () => {
    set({ isLoading: true });
    try {
      const [transactions, accounts, balances, categories, avgIncome, avgExpense, avgExpenses, savingsGoal] = await Promise.all([
        databaseService.getAllTransactions(),
        databaseService.getAllAccounts(),
        databaseService.getAccountBalances(),
        databaseService.getAllMajorCategories(),
        databaseService.getAverageMonthlyIncome(6),
        databaseService.getAverageMonthlyExpense(6),
        databaseService.getAverageMonthlyExpenseByCategory(6),
        databaseService.getSetting('savings_goal'),
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
        savingsGoal: savingsGoal ? parseInt(savingsGoal) : 0,
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

  fetchStatistics: async () => {
    try {
      const avgIncome = await databaseService.getAverageMonthlyIncome(6);
      set({ averageMonthlyIncome: avgIncome });
    } catch (error) {
      set({ error: 'Failed to fetch statistics' });
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
        await databaseService.addTransaction(t);
      }
      // 全て追加した後に、関係する全ての月/口座の振替を更新
      const uniqueUpdates = new Set<string>();
      for (const t of transactions) {
        const dateKey = `${t.account_id}_${t.date.substring(0, 7)}`; // YYYY-MM
        if (!uniqueUpdates.has(dateKey)) {
          await creditCardPaymentService.updateTransferForDate(t.account_id, t.date);
          uniqueUpdates.add(dateKey);
        }
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
      
      // クレジットカード振替の更新 (変更前後の日付と口座に対して)
      if (oldTx) {
        await creditCardPaymentService.updateTransferForDate(oldTx.account_id, oldTx.date);
        if (oldTx.account_id !== transaction.account_id || oldTx.date.substring(0, 7) !== transaction.date.substring(0, 7)) {
          await creditCardPaymentService.updateTransferForDate(transaction.account_id, transaction.date);
        }
      } else {
        await creditCardPaymentService.updateTransferForDate(transaction.account_id, transaction.date);
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
      
      // アカウント情報（引き落とし日など）が変更された可能性があるため、
      // 全取引の振替を再計算（または最近の取引のみ）
      // ここでは簡略化のため、当月と前月、翌月の振替を更新
      const now = new Date();
      await creditCardPaymentService.updateTransferForDate(account.id, now.toISOString());
      
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      await creditCardPaymentService.updateTransferForDate(account.id, lastMonth.toISOString());

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
}));
