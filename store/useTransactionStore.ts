import { create } from 'zustand';
import { MajorCategory, MinorCategory } from '../constants/categories';
import { databaseService } from '../services/database';
import { Account } from '../types/account';
import { CreateTransactionInput, Transaction } from '../types/transaction';

interface TransactionState {
  transactions: Transaction[];
  accounts: Account[];
  majorCategories: MajorCategory[];
  accountBalances: Record<string, number>;
  editingTransaction: Transaction | null;
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  addTransaction: (transaction: CreateTransactionInput) => Promise<void>;
  addTransactions: (transactions: CreateTransactionInput[]) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  addAccount: (account: Omit<Account, 'balance'>) => Promise<void>;
  updateAccount: (account: Omit<Account, 'balance'>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setEditingTransaction: (transaction: Transaction | null) => void;
  // Category Actions
  addMajorCategory: (major: Omit<MajorCategory, 'subCategories'>) => Promise<void>;
  updateMajorCategory: (major: Omit<MajorCategory, 'subCategories'>) => Promise<void>;
  deleteMajorCategory: (id: string) => Promise<void>;
  addMinorCategory: (minor: MinorCategory & { parent_id: string }) => Promise<void>;
  updateMinorCategory: (minor: MinorCategory) => Promise<void>;
  deleteMinorCategory: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  accounts: [],
  majorCategories: [],
  accountBalances: {},
  editingTransaction: null,
  isLoading: false,
  error: null,

  fetchData: async () => {
    set({ isLoading: true });
    try {
      const [transactions, accounts, balances, categories] = await Promise.all([
        databaseService.getAllTransactions(),
        databaseService.getAllAccounts(),
        databaseService.getAccountBalances(),
        databaseService.getAllMajorCategories(),
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
        isLoading: false 
      });
    } catch (error) {
      set({ error: 'Failed to fetch data', isLoading: false });
    }
  },

  addTransaction: async (transaction: CreateTransactionInput) => {
    try {
      await databaseService.addTransaction(transaction);
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
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to add transactions' });
    }
  },

  updateTransaction: async (transaction: Transaction) => {
    try {
      await databaseService.updateTransaction(transaction);
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to update transaction' });
    }
  },

  deleteTransaction: async (id: number) => {
    try {
      await databaseService.deleteTransaction(id);
      await get().fetchData();
    } catch (error) {
      set({ error: 'Failed to delete transaction' });
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
}));
