import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { databaseService } from './database';

export const dataManagementService = {
  // CSV Export
  async exportToCsv(): Promise<void> {
    try {
      const transactions = await databaseService.getAllTransactions();
      const accounts = await databaseService.getAllAccounts();
      const majorCategories = await databaseService.getAllMajorCategories();

      // ヘッダー (最新の取引データ構造に対応)
      let csvContent = 'ID,日付,支払先,カテゴリ,大カテゴリ,カテゴリID,金額,口座,口座ID,振替先,振替先口座ID,手数料,メモ,タグ,後払い・繰越,残高計算から除外,予算計算から除外,インポートID\n';

      for (const tx of transactions) {
        const id = tx.id;
        const date = tx.date;
        const payee = tx.payee || '';
        
        // カテゴリ名取得
        let minorLabel = '不明';
        let majorLabel = '不明';
        for (const maj of majorCategories) {
          const min = maj.subCategories.find(s => s.id === tx.category_id);
          if (min) {
            minorLabel = min.label;
            majorLabel = maj.label;
            break;
          }
        }

        const categoryId = tx.category_id || '';
        const amount = tx.amount;
        const account = accounts.find(a => a.id === tx.account_id)?.name || tx.account_id;
        const accountId = tx.account_id || '';
        const memo = tx.memo || '';
        const toAccount = tx.to_account_id ? (accounts.find(a => a.id === tx.to_account_id)?.name || tx.to_account_id) : '';
        const toAccountId = tx.to_account_id || '';
        const fee = tx.fee || 0;
        const tagsStr = tx.tags && Array.isArray(tx.tags) && tx.tags.length > 0 ? tx.tags.join(', ') : '';
        const isDeferred = tx.is_deferred ? 1 : 0;
        const excludeFromBalance = tx.exclude_from_balance ? 1 : 0;
        const excludeFromBudget = tx.exclude_from_budget ? 1 : 0;
        const importHash = tx.import_hash || '';

        // カンマや改行をエスケープ
        const escape = (str: any) => {
          if (str === null || str === undefined) return '';
          const s = String(str);
          if (s.includes(',') || s.includes('\n') || s.includes('\r') || s.includes('"')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        };

        csvContent += `${id},${escape(date)},${escape(payee)},${escape(minorLabel)},${escape(majorLabel)},${escape(categoryId)},${amount},${escape(account)},${escape(accountId)},${escape(toAccount)},${escape(toAccountId)},${fee},${escape(memo)},${escape(tagsStr)},${isDeferred},${excludeFromBalance},${excludeFromBudget},${escape(importHash)}\n`;
      }

      const fileName = `household_budget_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        throw new Error('Sharing is not available');
      }
    } catch (error) {
      console.error('CSV Export Error:', error);
      throw error;
    }
  },

  // DB Backup
  async backupDatabase(): Promise<void> {
    try {
      const dbPath = await databaseService.getDatabasePath();
      const backupName = `household_budget_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      const backupPath = `${FileSystem.cacheDirectory}${backupName}`;

      await FileSystem.copyAsync({
        from: dbPath,
        to: backupPath
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupPath);
      } else {
        throw new Error('Sharing is not available');
      }
    } catch (error) {
      console.error('Backup Error:', error);
      throw error;
    }
  },

  // DB Restore
  async restoreDatabase(): Promise<void> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // .db ファイルを指定したいが、環境によって異なるため全指定
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const selectedFile = result.assets[0];
      if (!selectedFile.name.endsWith('.db')) {
        throw new Error('Please select a .db file');
      }

      const dbPath = await databaseService.getDatabasePath();
      
      // 既存のDBを上書きする前に一時的にバックアップを取るか、直接上書き
      // SQLiteがオープン中の場合はエラーになる可能性があるため注意
      // expo-sqliteの新APIは動的にクローズできないため、コピー後にリロードを促す
      
      await FileSystem.copyAsync({
        from: selectedFile.uri,
        to: dbPath
      });

      // 復元後はアプリの再起動が必要な場合が多い
    } catch (error) {
      console.error('Restore Error:', error);
      throw error;
    }
  }
};
