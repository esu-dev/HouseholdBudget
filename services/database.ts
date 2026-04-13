import * as SQLite from 'expo-sqlite';
import { CATEGORIES, MajorCategory, MinorCategory } from '../constants/categories';
import { Account } from '../types/account';
import { CreateTransactionInput, Transaction } from '../types/transaction';

const DATABASE_NAME = 'household_budget.db';

export const initDatabase = async () => {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  
  // Create tables
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      card_type TEXT DEFAULT 'none',
      login_url TEXT
    );
    
    CREATE TABLE IF NOT EXISTS major_categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      type TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS minor_categories (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      label TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES major_categories(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      date TEXT NOT NULL,
      memo TEXT,
      payee TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
  `);

  // Migration: Add account_id to transactions if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN account_id TEXT DEFAULT "cash"');
  } catch (e) {}

  // Migration: Add payee to transactions if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN payee TEXT');
  } catch (e) {}

  // Migration: Add card_type to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN card_type TEXT DEFAULT "none"');
  } catch (e) {}

  // Migration: Add login_url to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN login_url TEXT');
  } catch (e) {}
  
  // Insert default accounts if empty
  const accountCount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM accounts');
  if (!accountCount || accountCount.count === 0) {
    await db.execAsync(`
      INSERT INTO accounts (id, name, type) VALUES ('cash', '現金', 'cash');
      INSERT INTO accounts (id, name, type) VALUES ('bank', '銀行口座', 'bank');
      INSERT INTO accounts (id, name, type) VALUES ('card', 'クレジットカード', 'card');
    `);
  }

  // Seed categories if empty
  const majorCount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM major_categories');
  if (!majorCount || majorCount.count === 0) {
    for (const major of CATEGORIES) {
      await db.runAsync(
        'INSERT INTO major_categories (id, label, icon, color, type) VALUES (?, ?, ?, ?, ?)',
        major.id, major.label, major.icon, major.color, major.type
      );
      for (const minor of major.subCategories) {
        await db.runAsync(
          'INSERT INTO minor_categories (id, parent_id, label) VALUES (?, ?, ?)',
          minor.id, major.id, minor.label
        );
      }
    }
  }
  
  return db;
};

export const databaseService = {
  // Transactions
  async addTransaction(transaction: CreateTransactionInput): Promise<number> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const result = await db.runAsync(
      'INSERT INTO transactions (amount, category_id, account_id, date, memo, payee) VALUES (?, ?, ?, ?, ?, ?)',
      transaction.amount,
      transaction.category_id,
      transaction.account_id,
      transaction.date,
      transaction.memo ?? null,
      transaction.payee ?? null
    );
    return result.lastInsertRowId;
  },

  async updateTransaction(transaction: Transaction): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE transactions SET amount = ?, category_id = ?, account_id = ?, date = ?, memo = ?, payee = ? WHERE id = ?',
      transaction.amount,
      transaction.category_id,
      transaction.account_id,
      transaction.date,
      transaction.memo ?? null,
      transaction.payee ?? null,
      transaction.id
    );
  },

  async getAllTransactions(): Promise<Transaction[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    return await db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC');
  },

  async deleteTransaction(id: number): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
  },

  // Accounts
  async getAllAccounts(): Promise<Account[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const rows = await db.getAllAsync<any>('SELECT * FROM accounts');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      cardType: row.card_type,
      loginUrl: row.login_url
    }));
  },

  async addAccount(account: Omit<Account, 'balance'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT INTO accounts (id, name, type, card_type, login_url) VALUES (?, ?, ?, ?, ?)',
      account.id,
      account.name,
      account.type,
      account.cardType ?? 'none',
      account.loginUrl ?? null
    );
  },

  async updateAccount(account: Omit<Account, 'balance'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE accounts SET name = ?, type = ?, card_type = ?, login_url = ? WHERE id = ?',
      account.name,
      account.type,
      account.cardType ?? 'none',
      account.loginUrl ?? null,
      account.id
    );
  },

  async deleteAccount(id: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
  },

  async getAccountBalances(): Promise<{account_id: string, balance: number}[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    return await db.getAllAsync<{account_id: string, balance: number}>(
      'SELECT account_id, SUM(amount) as balance FROM transactions GROUP BY account_id'
    );
  },

  // Categories
  async getAllMajorCategories(): Promise<MajorCategory[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const majors = await db.getAllAsync<any>('SELECT * FROM major_categories');
    const result: MajorCategory[] = [];
    
    for (const major of majors) {
      const minors = await db.getAllAsync<MinorCategory>(
        'SELECT id, label FROM minor_categories WHERE parent_id = ?',
        major.id
      );
      result.push({
        ...major,
        subCategories: minors
      });
    }
    return result;
  },

  async addMajorCategory(major: Omit<MajorCategory, 'subCategories'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT INTO major_categories (id, label, icon, color, type) VALUES (?, ?, ?, ?, ?)',
      major.id, major.label, major.icon, major.color, major.type
    );
  },

  async updateMajorCategory(major: Omit<MajorCategory, 'subCategories'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE major_categories SET label = ?, icon = ?, color = ?, type = ? WHERE id = ?',
      major.label, major.icon, major.color, major.type, major.id
    );
  },

  async deleteMajorCategory(id: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM major_categories WHERE id = ?', id);
  },

  async addMinorCategory(minor: MinorCategory & { parent_id: string }): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT INTO minor_categories (id, parent_id, label) VALUES (?, ?, ?)',
      minor.id, minor.parent_id, minor.label
    );
  },

  async updateMinorCategory(minor: MinorCategory): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE minor_categories SET label = ? WHERE id = ?',
      minor.label, minor.id
    );
  },

  async deleteMinorCategory(id: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM minor_categories WHERE id = ?', id);
  }
};
