import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { CATEGORIES, MajorCategory, MinorCategory } from '../constants/categories';
import { Account } from '../types/account';
import { Budget, CreateBudgetInput } from '../types/budget';
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
      login_url TEXT,
      closing_day INTEGER,
      withdrawal_day INTEGER,
      withdrawal_account_id TEXT,
      display_order INTEGER DEFAULT 0,
      billing_start_date TEXT,
      exclude_from_net_worth INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      last_imported_at TEXT,
      last_email_imported_at TEXT,
      initial_balance INTEGER DEFAULT 0,
      FOREIGN KEY (withdrawal_account_id) REFERENCES accounts(id)
    );
    
    CREATE TABLE IF NOT EXISTS major_categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      type TEXT NOT NULL,
      display_order INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS minor_categories (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      label TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES major_categories(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      to_account_id TEXT,
      date TEXT NOT NULL,
      memo TEXT,
      payee TEXT,
      transfer_id INTEGER,
      fee INTEGER DEFAULT 0,
      import_hash TEXT UNIQUE,
      is_deferred INTEGER DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS csv_category_mappings (
      external_name TEXT PRIMARY KEY,
      internal_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS csv_account_mappings (
      external_name TEXT PRIMARY KEY,
      internal_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payee_category_mappings (
      payee TEXT PRIMARY KEY,
      category_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      UNIQUE(month, category_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ignored_payees (
      payee TEXT PRIMARY KEY
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

  // Migration: Add closing_day to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN closing_day INTEGER');
  } catch (e) {}

  // Migration: Add withdrawal_day to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN withdrawal_day INTEGER');
  } catch (e) {}

  // Migration: Add withdrawal_account_id to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN withdrawal_account_id TEXT');
  } catch (e) {}

  // Migration: Add transfer_id to transactions if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN transfer_id INTEGER');
  } catch (e) {}

  // Migration: Add fee to transactions if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN fee INTEGER DEFAULT 0');
  } catch (e) {}

  // Migration: Add to_account_id to transactions if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN to_account_id TEXT');
  } catch (e) {}
  
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN display_order INTEGER DEFAULT 0');
  } catch (e) {}

  try {
    await db.execAsync('ALTER TABLE major_categories ADD COLUMN display_order INTEGER DEFAULT 0');
  } catch (e) {}

  try {
    await db.execAsync('ALTER TABLE minor_categories ADD COLUMN display_order INTEGER DEFAULT 0');
  } catch (e) {}

  // Migration: Add import_hash to transactions if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN import_hash TEXT');
    await db.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_import_hash ON transactions(import_hash)');
  } catch (e) {}

  // Migration: Add is_deferred to transactions if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN is_deferred INTEGER DEFAULT 0');
  } catch (e) {}

  // Migration: Add billing_start_date to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN billing_start_date TEXT');
  } catch (e) {}

  // Migration: Add exclude_from_net_worth to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN exclude_from_net_worth INTEGER DEFAULT 0');
  } catch (e) {}

  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN is_hidden INTEGER DEFAULT 0');
  } catch (e) {}

  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN last_imported_at TEXT');
  } catch (e) {}

  // Migration: Add last_email_imported_at to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN last_email_imported_at TEXT');
  } catch (e) {}

  // Migration: Add initial_balance to accounts if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN initial_balance INTEGER DEFAULT 0');
  } catch (e) {}
  
  // Insert default accounts if empty
  const accountCount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM accounts');
  if (!accountCount || accountCount.count === 0) {
    await db.execAsync(`
      INSERT INTO accounts (id, name, type, display_order) VALUES ('cash', '現金', 'cash', 0);
    `);
  }

  // Seed categories if empty
  const majorCount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM major_categories');
  if (!majorCount || majorCount.count === 0) {
    for (const major of CATEGORIES) {
      await db.runAsync(
        'INSERT INTO major_categories (id, label, icon, color, type, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        major.id, major.label, major.icon, major.color, major.type, major.displayOrder
      );
      for (const minor of major.subCategories) {
        await db.runAsync(
          'INSERT INTO minor_categories (id, parent_id, label, display_order) VALUES (?, ?, ?, ?)',
          minor.id, major.id, minor.label, minor.displayOrder
        );
      }
    }
  }

  // Ensure 'transfer' category exists for existing databases
  await db.runAsync(
    'INSERT OR IGNORE INTO minor_categories (id, parent_id, label) VALUES (?, ?, ?)',
    'transfer', 'others_group', '振替'
  );
  
  return db;
};

export const databaseService = {
  // Payee - Category Mappings
  async upsertPayeeCategoryMapping(payee: string, categoryId: string): Promise<void> {
    if (!payee || !categoryId) return;
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT OR REPLACE INTO payee_category_mappings (payee, category_id) VALUES (?, ?)',
      payee,
      categoryId
    );
  },

  async getCategoryByPayee(payee: string): Promise<string | null> {
    if (!payee) return null;
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const result = await db.getFirstAsync<{category_id: string}>(
      'SELECT category_id FROM payee_category_mappings WHERE payee = ?',
      payee
    );
    return result ? result.category_id : null;
  },

  async getAllPayeeCategoryMappings(): Promise<Record<string, string>> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const rows = await db.getAllAsync<{payee: string, category_id: string}>(
      'SELECT * FROM payee_category_mappings'
    );
    const mapping: Record<string, string> = {};
    rows.forEach(row => {
      mapping[row.payee] = row.category_id;
    });
    return mapping;
  },

  async deletePayeeCategoryMapping(payee: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM payee_category_mappings WHERE payee = ?', payee);
  },

  async getIgnoredPayees(): Promise<string[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const rows = await db.getAllAsync<{payee: string}>(
      'SELECT payee FROM ignored_payees'
    );
    return rows.map(row => row.payee);
  },

  async addIgnoredPayee(payee: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT OR IGNORE INTO ignored_payees (payee) VALUES (?)',
      payee
    );
    // 学習済みの対応関係があれば削除
    await db.runAsync(
      'DELETE FROM payee_category_mappings WHERE payee = ?',
      payee
    );
  },

  async removeIgnoredPayee(payee: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'DELETE FROM ignored_payees WHERE payee = ?',
      payee
    );
  },

  async isPayeeIgnored(payee: string): Promise<boolean> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const result = await db.getFirstAsync<{payee: string}>(
      'SELECT payee FROM ignored_payees WHERE payee = ?',
      payee
    );
    return !!result;
  },

  async getDatabasePath(): Promise<string> {
    return `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
  },

  // Transactions
  async addTransaction(transaction: CreateTransactionInput): Promise<number> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const result = await db.runAsync(
      'INSERT INTO transactions (amount, category_id, account_id, to_account_id, date, memo, payee, transfer_id, fee, import_hash, is_deferred) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      transaction.amount,
      transaction.category_id,
      transaction.account_id,
      transaction.to_account_id ?? null,
      transaction.date,
      transaction.memo ?? null,
      transaction.payee ?? null,
      transaction.transfer_id ?? null,
      transaction.fee ?? 0,
      transaction.import_hash ?? null,
      transaction.is_deferred ? 1 : 0
    );

    if (transaction.payee) {
      const isIgnored = await this.isPayeeIgnored(transaction.payee);
      if (!isIgnored) {
        await this.upsertPayeeCategoryMapping(transaction.payee, transaction.category_id);
      }
    }

    return result.lastInsertRowId;
  },

  async updateTransaction(transaction: Transaction): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE transactions SET amount = ?, category_id = ?, account_id = ?, to_account_id = ?, date = ?, memo = ?, payee = ?, transfer_id = ?, fee = ?, import_hash = ?, is_deferred = ? WHERE id = ?',
      transaction.amount,
      transaction.category_id,
      transaction.account_id,
      transaction.to_account_id ?? null,
      transaction.date,
      transaction.memo ?? null,
      transaction.payee ?? null,
      transaction.transfer_id ?? null,
      transaction.fee ?? 0,
      transaction.import_hash ?? null,
      transaction.is_deferred ? 1 : 0,
      transaction.id
    );

    if (transaction.payee) {
      const isIgnored = await this.isPayeeIgnored(transaction.payee);
      if (!isIgnored) {
        await this.upsertPayeeCategoryMapping(transaction.payee, transaction.category_id);
      }
    }
  },

  async getAllTransactions(): Promise<Transaction[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const rows = await db.getAllAsync<any>(
      'SELECT t.* FROM transactions t JOIN accounts a ON t.account_id = a.id ORDER BY t.date DESC'
    );
    return rows.map(row => ({
      ...row,
      is_deferred: row.is_deferred === 1
    }));
  },

  async deleteTransaction(id: number): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    // Check if it's a transfer
    const transaction = await db.getFirstAsync<{transfer_id: number | null}>(
      'SELECT transfer_id FROM transactions WHERE id = ?',
      id
    );

    if (transaction?.transfer_id) {
      // If it's a transfer, delete both linked transactions
      await db.runAsync('DELETE FROM transactions WHERE transfer_id = ?', transaction.transfer_id);
    } else {
      await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
    }
  },

  // Accounts
  async getAllAccounts(): Promise<Account[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const rows = await db.getAllAsync<any>('SELECT * FROM accounts ORDER BY display_order ASC');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      cardType: row.card_type,
      loginUrl: row.login_url,
      closingDay: row.closing_day,
      withdrawalDay: row.withdrawal_day,
      withdrawalAccountId: row.withdrawal_account_id,
      displayOrder: row.display_order,
      billingStartDate: row.billing_start_date,
      excludeFromNetWorth: row.exclude_from_net_worth === 1,
      isHidden: row.is_hidden === 1,
      lastImportedAt: row.last_imported_at,
      lastEmailImportedAt: row.last_email_imported_at,
      initialBalance: row.initial_balance || 0
    }));
  },

  async updateAccountsOrder(accounts: { id: string, displayOrder: number }[]): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      for (const account of accounts) {
        await db.runAsync(
          'UPDATE accounts SET display_order = ? WHERE id = ?',
          account.displayOrder, account.id
        );
      }
      await db.execAsync('COMMIT;');
    } catch (e) {
      await db.execAsync('ROLLBACK;');
      throw e;
    }
  },

  async deleteAccount(id: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      await db.runAsync('DELETE FROM transactions WHERE account_id = ? OR to_account_id = ?', id, id);
      await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
      await db.execAsync('COMMIT;');
    } catch (e) {
      await db.execAsync('ROLLBACK;');
      throw e;
    }
  },

  async deleteAllTransactionsForAccount(accountId: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM transactions WHERE account_id = ? OR to_account_id = ?', accountId, accountId);
  },

  async addAccount(account: Omit<Account, 'balance'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT INTO accounts (id, name, type, card_type, login_url, closing_day, withdrawal_day, withdrawal_account_id, display_order, billing_start_date, exclude_from_net_worth, is_hidden, last_imported_at, last_email_imported_at, initial_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      account.id,
      account.name,
      account.type,
      account.cardType ?? 'none',
      account.loginUrl ?? null,
      account.closingDay ?? null,
      account.withdrawalDay ?? null,
      account.withdrawalAccountId ?? null,
      account.displayOrder ?? 0,
      account.billingStartDate ?? null,
      account.excludeFromNetWorth ? 1 : 0,
      account.isHidden ? 1 : 0,
      account.lastImportedAt ?? null,
      account.lastEmailImportedAt ?? null,
      account.initialBalance ?? 0
    );
  },

  async updateAccount(account: Omit<Account, 'balance'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE accounts SET name = ?, type = ?, card_type = ?, login_url = ?, closing_day = ?, withdrawal_day = ?, withdrawal_account_id = ?, display_order = ?, billing_start_date = ?, exclude_from_net_worth = ?, is_hidden = ?, last_imported_at = ?, last_email_imported_at = ?, initial_balance = ? WHERE id = ?',
      account.name,
      account.type,
      account.cardType ?? 'none',
      account.loginUrl ?? null,
      account.closingDay ?? null,
      account.withdrawalDay ?? null,
      account.withdrawalAccountId ?? null,
      account.displayOrder ?? 0,
      account.billingStartDate ?? null,
      account.excludeFromNetWorth ? 1 : 0,
      account.isHidden ? 1 : 0,
      account.lastImportedAt ?? null,
      account.lastEmailImportedAt ?? null,
      account.initialBalance ?? 0,
      account.id
    );
  },

  async updateLastImportedAt(accountId: string, date: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE accounts SET last_imported_at = ? WHERE id = ?',
      date,
      accountId
    );
  },

  async updateLastEmailImportedAt(accountId: string, date: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE accounts SET last_email_imported_at = ? WHERE id = ?',
      date,
      accountId
    );
  },

  async getAccountBalances(): Promise<{account_id: string, balance: number}[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    // 取引の合計 + アカウントの初期残高
    return await db.getAllAsync<{account_id: string, balance: number}>(
      'SELECT a.id as account_id, (COALESCE(SUM(t.amount), 0) + a.initial_balance) as balance FROM accounts a LEFT JOIN transactions t ON a.id = t.account_id GROUP BY a.id'
    );
  },

  // Categories
  async getAllMajorCategories(): Promise<MajorCategory[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const majors = await db.getAllAsync<any>('SELECT * FROM major_categories ORDER BY display_order ASC');
    const result: MajorCategory[] = [];
    
    for (const major of majors) {
      const minors = await db.getAllAsync<any>(
        'SELECT id, label, display_order FROM minor_categories WHERE parent_id = ? ORDER BY display_order ASC',
        major.id
      );
      result.push({
        id: major.id,
        label: major.label,
        icon: major.icon,
        color: major.color,
        type: major.type,
        displayOrder: major.display_order,
        subCategories: minors.map(m => ({
          id: m.id,
          label: m.label,
          displayOrder: m.display_order
        }))
      });
    }
    return result;
  },

  async addMajorCategory(major: Omit<MajorCategory, 'subCategories'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT INTO major_categories (id, label, icon, color, type, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      major.id, major.label, major.icon, major.color, major.type, major.displayOrder
    );
  },

  async updateMajorCategory(major: Omit<MajorCategory, 'subCategories'>): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE major_categories SET label = ?, icon = ?, color = ?, type = ?, display_order = ? WHERE id = ?',
      major.label, major.icon, major.color, major.type, major.displayOrder, major.id
    );
  },

  async deleteMajorCategory(id: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM major_categories WHERE id = ?', id);
  },

  async addMinorCategory(minor: MinorCategory & { parent_id: string }): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT INTO minor_categories (id, parent_id, label, display_order) VALUES (?, ?, ?, ?)',
      minor.id, minor.parent_id, minor.label, minor.displayOrder
    );
  },

  async updateMinorCategory(minor: MinorCategory): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'UPDATE minor_categories SET label = ?, display_order = ? WHERE id = ?',
      minor.label, minor.displayOrder, minor.id
    );
  },

  async updateMajorCategoriesOrder(majors: { id: string, display_order: number }[]): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      for (const major of majors) {
        await db.runAsync(
          'UPDATE major_categories SET display_order = ? WHERE id = ?',
          major.display_order, major.id
        );
      }
      await db.execAsync('COMMIT;');
    } catch (e) {
      await db.execAsync('ROLLBACK;');
      throw e;
    }
  },

  async updateMinorCategoriesOrder(minors: { id: string, display_order: number }[]): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      for (const minor of minors) {
        await db.runAsync(
          'UPDATE minor_categories SET display_order = ? WHERE id = ?',
          minor.display_order, minor.id
        );
      }
      await db.execAsync('COMMIT;');
    } catch (e) {
      await db.execAsync('ROLLBACK;');
      throw e;
    }
  },

  async deleteMinorCategory(id: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM minor_categories WHERE id = ?', id);
  },

  // CSV Mappings
  async getCsvCategoryMappings(): Promise<Record<string, string>> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const rows = await db.getAllAsync<{external_name: string, internal_id: string}>(
      'SELECT * FROM csv_category_mappings'
    );
    const mapping: Record<string, string> = {};
    rows.forEach(row => {
      mapping[row.external_name] = row.internal_id;
    });
    return mapping;
  },

  async updateCsvCategoryMapping(externalName: string, internalId: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT OR REPLACE INTO csv_category_mappings (external_name, internal_id) VALUES (?, ?)',
      externalName, internalId
    );
  },

  async getCsvAccountMappings(): Promise<Record<string, string>> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const rows = await db.getAllAsync<{external_name: string, internal_id: string}>(
      'SELECT * FROM csv_account_mappings'
    );
    const mapping: Record<string, string> = {};
    rows.forEach(row => {
      mapping[row.external_name] = row.internal_id;
    });
    return mapping;
  },

  async updateCsvAccountMapping(externalName: string, internalId: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT OR REPLACE INTO csv_account_mappings (external_name, internal_id) VALUES (?, ?)',
      externalName, internalId
    );
  },

  async deleteCsvCategoryMapping(externalName: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM csv_category_mappings WHERE external_name = ?', externalName);
  },

  async deleteCsvAccountMapping(externalName: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM csv_account_mappings WHERE external_name = ?', externalName);
  },

  async isImportHashExists(hash: string): Promise<boolean> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const result = await db.getFirstAsync<{count: number}>(
      'SELECT COUNT(*) as count FROM transactions WHERE import_hash = ?',
      hash
    );
    return (result?.count ?? 0) > 0;
  },

  // Budgets
  async getBudgetsByMonth(month: string): Promise<Budget[]> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    return await db.getAllAsync<Budget>(
      'SELECT * FROM budgets WHERE month = ?',
      month
    );
  },

  async upsertBudget(budget: CreateBudgetInput): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT INTO budgets (month, category_id, amount) VALUES (?, ?, ?) ON CONFLICT(month, category_id) DO UPDATE SET amount = EXCLUDED.amount',
      budget.month,
      budget.category_id,
      budget.amount
    );
  },

  async deleteBudget(id: number): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
  },

  // Settings
  async getSetting(key: string): Promise<string | null> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const result = await db.getFirstAsync<{value: string}>(
      'SELECT value FROM settings WHERE key = ?',
      key
    );
    return result ? result.value : null;
  },

  async updateSetting(key: string, value: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      key,
      value
    );
  },

  // Statistics
  async getAverageMonthlyIncome(monthsCount: number, categoryIds?: string[], baseDate?: string): Promise<number> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    const referenceDate = baseDate || 'now';

    let query = `
      SELECT 
        strftime('%Y-%m', t.date) as month,
        SUM(t.amount) as total
      FROM transactions t
      JOIN minor_categories min ON t.category_id = min.id
      JOIN major_categories maj ON min.parent_id = maj.id
      WHERE maj.type = 'income'
        AND t.amount > 0 
        AND t.to_account_id IS NULL
        AND t.transfer_id IS NULL
        AND t.date >= date(?, 'start of month', '-' || ? || ' months')
        AND t.date < date(?, 'start of month')
    `;

    const params: any[] = [referenceDate, monthsCount, referenceDate];

    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(',');
      query += ` AND maj.id IN (${placeholders})`;
      params.push(...categoryIds);
    }

    query += ` GROUP BY month`;

    const result = await db.getAllAsync<{month: string, total: number}>(query, ...params);

    if (result.length === 0) return 0;
    
    const totalSum = result.reduce((acc, row) => acc + row.total, 0);
    // データがある月数で割ることで、6ヶ月に満たない期間でも妥当な平均値を出す
    return Math.round(totalSum / result.length);
  },

  async getAverageMonthlyExpenseByCategory(monthsCount: number, baseDate?: string): Promise<Record<string, number>> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    const referenceDate = baseDate || 'now';

    const rows = await db.getAllAsync<{major_id: string, month: string, total: number}>(`
      SELECT 
        maj.id as major_id,
        strftime('%Y-%m', t.date) as month,
        SUM(ABS(t.amount)) as total
      FROM transactions t
      JOIN minor_categories min ON t.category_id = min.id
      JOIN major_categories maj ON min.parent_id = maj.id
      WHERE maj.type = 'expense'
        AND t.amount < 0
        AND t.transfer_id IS NULL
        AND t.date >= date(?, 'start of month', '-' || ? || ' months')
        AND t.date < date(?, 'start of month')
      GROUP BY major_id, month
    `, referenceDate, monthsCount, referenceDate);

    const categoryMonthlyTotals: Record<string, number[]> = {};
    rows.forEach(row => {
      if (!categoryMonthlyTotals[row.major_id]) {
        categoryMonthlyTotals[row.major_id] = [];
      }
      categoryMonthlyTotals[row.major_id].push(row.total);
    });

    const averages: Record<string, number> = {};
    Object.entries(categoryMonthlyTotals).forEach(([id, totals]) => {
      const sum = totals.reduce((a, b) => a + b, 0);
      // データがある月数で割る（incomeと同様のロジック）
      averages[id] = Math.round(sum / totals.length);
    });

    return averages;
  },

  async getAverageMonthlyExpense(monthsCount: number, baseDate?: string): Promise<number> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    const referenceDate = baseDate || 'now';

    const result = await db.getAllAsync<{month: string, total: number}>(`
      SELECT 
        strftime('%Y-%m', t.date) as month,
        SUM(ABS(t.amount)) as total
      FROM transactions t
      JOIN minor_categories min ON t.category_id = min.id
      JOIN major_categories maj ON min.parent_id = maj.id
      WHERE maj.type = 'expense'
        AND t.amount < 0 
        AND t.to_account_id IS NULL
        AND t.transfer_id IS NULL
        AND t.date >= date(?, 'start of month', '-' || ? || ' months')
        AND t.date < date(?, 'start of month')
      GROUP BY month
    `, referenceDate, monthsCount, referenceDate);

    if (result.length === 0) return 0;
    
    const totalSum = result.reduce((acc, row) => acc + row.total, 0);
    return Math.round(totalSum / result.length);
  },

  async deleteAllData(): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    // トランザクション内で実行して整合性を保つ
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      // 全テーブルのデータを削除
      await db.execAsync('DELETE FROM transactions;');
      await db.execAsync('DELETE FROM budgets;');
      await db.execAsync('DELETE FROM settings;');
      await db.execAsync('DELETE FROM payee_category_mappings;');
      await db.execAsync('DELETE FROM csv_category_mappings;');
      await db.execAsync('DELETE FROM csv_account_mappings;');
      await db.execAsync('DELETE FROM accounts;');
      await db.execAsync('DELETE FROM minor_categories;');
      await db.execAsync('DELETE FROM major_categories;');
      
      // シーディング（初期データの再投入）
      // アカウント
      await db.execAsync(`
        INSERT INTO accounts (id, name, type, display_order) VALUES ('cash', '現金', 'cash', 0);
      `);

      // カテゴリ
      for (const major of CATEGORIES) {
        await db.runAsync(
          'INSERT INTO major_categories (id, label, icon, color, type, display_order) VALUES (?, ?, ?, ?, ?, ?)',
          major.id, major.label, major.icon, major.color, major.type, major.displayOrder
        );
        for (const minor of major.subCategories) {
          await db.runAsync(
            'INSERT INTO minor_categories (id, parent_id, label, display_order) VALUES (?, ?, ?, ?)',
            minor.id, major.id, minor.label, minor.displayOrder
          );
        }
      }

      // 振替カテゴリの保証
      await db.runAsync(
        'INSERT OR IGNORE INTO minor_categories (id, parent_id, label) VALUES (?, ?, ?)',
        'transfer', 'others_group', '振替'
      );

      await db.execAsync('COMMIT;');
    } catch (e) {
      await db.execAsync('ROLLBACK;');
      throw e;
    }
  },

  async getAllCsvAccountMappings(): Promise<Record<string, string>> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const result = await db.getAllAsync<{external_name: string, internal_id: string}>('SELECT external_name, internal_id FROM csv_account_mappings');
    const mappings: Record<string, string> = {};
    result.forEach(r => {
      mappings[r.external_name] = r.internal_id;
    });
    return mappings;
  },

  async setCsvAccountMapping(externalName: string, internalId: string): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    if (!internalId) {
      await db.runAsync('DELETE FROM csv_account_mappings WHERE external_name = ?', externalName);
    } else {
      await db.runAsync(
        'INSERT OR REPLACE INTO csv_account_mappings (external_name, internal_id) VALUES (?, ?)',
        externalName, internalId
      );
    }
  }
};
