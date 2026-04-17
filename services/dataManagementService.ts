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

      // ヘッダー
      let csvContent = '日付,支払先,カテゴリ,大カテゴリ,金額,口座,メモ,振替先,手数料\n';

      for (const tx of transactions) {
        const date = tx.date.split('T')[0];
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

        const amount = tx.amount;
        const account = accounts.find(a => a.id === tx.account_id)?.name || tx.account_id;
        const memo = tx.memo || '';
        const toAccount = tx.to_account_id ? (accounts.find(a => a.id === tx.to_account_id)?.name || tx.to_account_id) : '';
        const fee = tx.fee || 0;

        // カンマや改行をエスケープ
        const escape = (str: any) => {
          const s = String(str);
          if (s.includes(',') || s.includes('\n') || s.includes('"')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        };

        csvContent += `${date},${escape(payee)},${escape(minorLabel)},${escape(majorLabel)},${amount},${escape(account)},${escape(memo)},${escape(toAccount)},${fee}\n`;
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
