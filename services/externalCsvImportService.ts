import { toByteArray } from 'base64-js';
import * as Encoding from 'encoding-japanese';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { CreateTransactionInput } from '../types/transaction';
import { databaseService } from './database';

export type ExternalCsvType = 'income_expense' | 'transfer';

export interface ImportResult {
  successCount: number;
  skipCount: number;
  duplicateCount: number;
  missingCategories: string[];
  missingAccounts: string[];
}

export const externalCsvImportService = {
  async pickAndParseCsv(): Promise<{ data: string[][], type: ExternalCsvType } | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const fileUri = result.assets[0].uri;
      const base64Content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Content) return null;

      const uint8Array = toByteArray(base64Content);
      const detected = Encoding.detect(uint8Array);
      const unicodeString = Encoding.convert(uint8Array, {
        to: 'UNICODE',
        from: detected || 'SJIS',
        type: 'string',
      }) as unknown as string;

      return new Promise((resolve) => {
        Papa.parse(unicodeString, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as string[][];
            if (data.length === 0) {
              resolve(null);
              return;
            }

            // Determine type based on column count or content
            // Income/Expense: 9+ columns, Transfer: 9+ columns but different structure
            // We'll check the first few rows to guess
            const firstRow = data[0];
            let type: ExternalCsvType = 'income_expense';
            
            // "毎日家計簿" specific detection logic
            // Transfer CSV: Column 2 is "振替元", Column 5 is "振替先" in some cases, or we check column count
            // Actually the user provided structure:
            // Income/Expense: 1:Date, 2:Category, 4:Amount, 7:Account, 9:Memo
            // Transfer: 1:Date, 2:From, 3:OutAmount, 5:To, 6:InAmount, 9:Memo
            
            // Simple check: if column 5 exists and it looks like a transfer
            if (firstRow.length >= 6 && firstRow[2] && firstRow[4]) {
               // This is a bit ambiguous, maybe ask user or check more rows
               // For now let's assume if it has 6 columns and specific headers or data types
               // Actually let's just try to detect based on content later or let user choose
               // But the user said "収支のcsvと振替のcsvの２つを読み込みます"
               // We can try to guess by looking at the 3rd column (Amount vs OutAmount)
            }
            
            // Improved detection for "毎日家計簿"
            // Let's find a row that is not a header to determine the type
            let detectedType: ExternalCsvType = 'income_expense';
            for (const row of data) {
              if (row.length >= 10 && (row[9] === '収' || row[9] === '支')) {
                detectedType = 'income_expense';
                break;
              }
              if (row.length >= 6 && !isNaN(Number(row[2]?.replace(/[,円]/g, ''))) && !isNaN(Number(row[5]?.replace(/[,円]/g, '')))) {
                detectedType = 'transfer';
                break;
              }
            }

            resolve({ data, type: detectedType });
          },
        });
      });
    } catch (error) {
      console.error('External CSV pick and parse error:', error);
      return null;
    }
  },

  async processImport(
    data: string[][], 
    type: ExternalCsvType, 
    categoryMappings: Record<string, string>, 
    accountMappings: Record<string, string>
  ): Promise<ImportResult> {
    const result: ImportResult = {
      successCount: 0,
      skipCount: 0,
      duplicateCount: 0,
      missingCategories: [],
      missingAccounts: [],
    };

    const transactions: CreateTransactionInput[] = [];
    const transferPairs: { from: CreateTransactionInput, to: CreateTransactionInput, fee: number }[] = [];

    // Skip header if it exists (specific check for "日付")
    let startIndex = 0;
    if (data.length > 0 && (data[0][0] === '日付' || data[0][0] === '日')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 4) {
        console.log(`Row ${i} skipped: length too short`, row);
        continue;
      }

      const dateStr = row[0]?.trim();
      const date = this.normalizeDate(dateStr);
      if (!date) {
        console.log(`Row ${i} skipped: invalid date`, dateStr);
        result.skipCount++;
        continue;
      }

      if (type === 'income_expense') {
        const extCategory = row[1]?.trim();
        const amountStr = row[3]?.trim();
        const extAccount = row[6]?.trim();
        const memo = row[8]?.trim() || '';
        const classification = row[9]?.trim() || ''; // 10th column: "収" or "支"

        const internalCategoryId = categoryMappings[extCategory];
        const internalAccountId = accountMappings[extAccount];

        if (!internalCategoryId || !internalAccountId) {
          console.log(`Row ${i} skipped: mapping missing`, { extCategory, extAccount, internalCategoryId, internalAccountId });
          if (extCategory && !internalCategoryId && !result.missingCategories.includes(extCategory)) result.missingCategories.push(extCategory);
          if (extAccount && !internalAccountId && !result.missingAccounts.includes(extAccount)) result.missingAccounts.push(extAccount);
          result.skipCount++;
          continue;
        }

        let amount = Number(amountStr?.replace(/[,円]/g, ''));
        if (isNaN(amount)) {
          console.log(`Row ${i} skipped: invalid amount`, amountStr);
          result.skipCount++;
          continue;
        }

        // Adjust amount based on classification if provided
        if (classification === '支') {
          amount = -Math.abs(amount);
        } else if (classification === '収') {
          amount = Math.abs(amount);
        }

        // Generate hash for duplicate prevention
        const hash = `ext_${date}_${amount}_${internalAccountId}_${memo}`;
        if (await databaseService.isImportHashExists(hash)) {
          console.log(`Row ${i} skipped: duplicate hash`, hash);
          result.duplicateCount++;
          continue;
        }

        transactions.push({
          amount,
          category_id: internalCategoryId,
          account_id: internalAccountId,
          date,
          memo,
          payee: null,
          import_hash: hash
        });
      } else {
        // Transfer logic (already similar logging style could be added)
        // ... (skipping for now to keep the change focused)
        // Actually, let's add it for transfer too.
        const extFromAccount = row[1]?.trim();
        const outAmountStr = row[2]?.trim();
        const extToAccount = row[4]?.trim();
        const inAmountStr = row[5]?.trim();
        const memo = row[8]?.trim() || '';

        const internalFromAccountId = accountMappings[extFromAccount];
        const internalToAccountId = accountMappings[extToAccount];

        if (!internalFromAccountId || !internalToAccountId) {
          console.log(`Row ${i} skipped: transfer mapping missing`, { extFromAccount, extToAccount });
          if (extFromAccount && !internalFromAccountId && !result.missingAccounts.includes(extFromAccount)) result.missingAccounts.push(extFromAccount);
          if (extToAccount && !internalToAccountId && !result.missingAccounts.includes(extToAccount)) result.missingAccounts.push(extToAccount);
          result.skipCount++;
          continue;
        }

        const outAmount = Math.abs(Number(outAmountStr?.replace(/[,円]/g, '')));
        const inAmount = Math.abs(Number(inAmountStr?.replace(/[,円]/g, '')));
        
        if (isNaN(outAmount) || isNaN(inAmount)) {
          console.log(`Row ${i} skipped: invalid transfer amounts`, { outAmountStr, inAmountStr });
          result.skipCount++;
          continue;
        }

        const fee = outAmount - inAmount;

        const hash = `ext_tr_${date}_${outAmount}_${internalFromAccountId}_${internalToAccountId}_${memo}`;
        if (await databaseService.isImportHashExists(hash)) {
          console.log(`Row ${i} skipped: duplicate transfer hash`, hash);
          result.duplicateCount++;
          continue;
        }

        const fromAccountName = (await databaseService.getAllAccounts()).find(a => a.id === internalFromAccountId)?.name;
        const toAccountName = (await databaseService.getAllAccounts()).find(a => a.id === internalToAccountId)?.name;

        const transferId = Date.now() + i;

        const fromTx: CreateTransactionInput = {
          amount: -outAmount,
          category_id: 'transfer',
          account_id: internalFromAccountId,
          to_account_id: internalToAccountId,
          date,
          memo: memo || '振替',
          payee: null,
          transfer_id: transferId,
          import_hash: hash
        };

        const toTx: CreateTransactionInput = {
          amount: inAmount,
          category_id: 'transfer',
          account_id: internalToAccountId,
          to_account_id: internalFromAccountId,
          date,
          memo: memo || '振替',
          payee: null,
          transfer_id: transferId
        };

        let feeTx: CreateTransactionInput | null = null;
        if (fee > 0) {
          feeTx = {
            amount: -fee,
            category_id: 'others',
            account_id: internalFromAccountId,
            date,
            memo: memo ? `${memo} (手数料)` : '振替手数料',
            payee: `振替手数料 (${fromAccountName} → ${toAccountName})`,
            transfer_id: transferId
          };
        }

        await databaseService.addTransaction(fromTx);
        await databaseService.addTransaction(toTx);
        if (feeTx) await databaseService.addTransaction(feeTx);
        
        result.successCount++;
      }
    }

    console.log(`Total normal transactions to add: ${transactions.length}`);
    // Add normal transactions
    for (const tx of transactions) {
      await databaseService.addTransaction(tx);
      result.successCount++;
    }

    console.log('Final import result:', result);
    return result;
  },

  normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    let normalized = dateStr.trim()
      .replace(/\//g, '-')
      .replace(/年|月/g, '-')
      .replace(/日/g, '');
    
    // If YYYYMMDD (8 digits)
    if (/^\d{8}$/.test(normalized)) {
      normalized = `${normalized.substring(0, 4)}-${normalized.substring(4, 6)}-${normalized.substring(6, 8)}`;
    }
    
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  }
};
