import { toByteArray } from 'base64-js';
import * as Encoding from 'encoding-japanese';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { CardType } from '../types/account';
import { CreateTransactionInput } from '../types/transaction';
import { databaseService } from './database';

export interface CsvImportResult {
  transactions: CreateTransactionInput[];
  missingMappings: string[];
  rawData?: string[][];
  cardType?: CardType;
  accountId?: string;
}

export const csvImportService = {
  async pickAndParseCsv(cardType: CardType, accountId: string): Promise<CsvImportResult> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { transactions: [], missingMappings: [] };
      }

      return this.parseCsvFromUri(result.assets[0].uri, cardType, accountId);
    } catch (error) {
      console.error('CSV pick and parse error:', error);
      throw error;
    }
  },

  async parseCsvFromUri(fileUri: string, cardType: CardType, accountId: string): Promise<CsvImportResult> {
    try {
      // Read as Base64 to handle different encodings (like Shift-JIS)
      const base64Content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Content) {
        console.error('Failed to read CSV content or file is empty');
        return { transactions: [], missingMappings: [] };
      }

      // Convert Base64 to Uint8Array
      const uint8Array = toByteArray(base64Content);

      // Detect encoding and convert to Unicode (UTF-8)
      const detected = Encoding.detect(uint8Array);

      const unicodeArray = Encoding.convert(uint8Array, {
        to: 'UNICODE',
        from: detected || 'SJIS', // Fallback to SJIS for JP BANK
        type: 'string',
      }) as unknown as string;

      // Fetch all payee-category mappings for auto-categorization
      const mappings = await databaseService.getAllPayeeCategoryMappings();

      // Fetch existing transactions to prevent duplicates
      const existingTransactions = await databaseService.getAllTransactions();

      return new Promise((resolve, reject) => {
        Papa.parse(unicodeArray, {
          header: false,
          skipEmptyLines: true,
          complete: async (results) => {
            try {
              // Fetch account mappings
              const accountMappings = await databaseService.getAllCsvAccountMappings();

              const data = results.data as string[][];
              const { transactions, missingMappings } = this.mapCsvToTransactions(
                data,
                cardType,
                accountId,
                mappings,
                existingTransactions,
                accountMappings
              );
              resolve({
                transactions,
                missingMappings,
                rawData: data,
                cardType,
                accountId
              });
            } catch (error) {
              console.error('CSV parse error:', error);
              reject(error);
            }
          },
          error: (error: any) => {
            reject(error);
          },
        });
      });
    } catch (error) {
      console.error('CSV parse from URI error:', error);
      throw error;
    }
  },

  mapCsvToTransactions(
    data: string[][],
    cardType: CardType,
    accountId: string,
    mappings: Record<string, string> = {},
    existingTransactions: any[] = [],
    accountMappings: Record<string, string> = {}
  ): { transactions: CreateTransactionInput[], missingMappings: string[] } {
    const transactions: CreateTransactionInput[] = [];
    const missingMappings = new Set<string>();

    // Filter existing transactions once for this account to speed up comparison
    const accountTransactions = existingTransactions.filter(t => t.account_id === accountId);

    // Check if the first row is a header or metadata
    let startIndex = 0;
    let amountIdx = 2; // Default for jp_bank v1
    let jpBankFormat: 'v1' | 'v2' = 'v1';

    if (cardType === 'jp_bank') {
      // JP BANK CSV check
      const firstRow = data[0];
      if (firstRow && firstRow.length >= 7) {
        // New format: at least 7 columns
        jpBankFormat = 'v2';
        amountIdx = 6;
        // Check if the first row is already data
        if (this.normalizeDate(firstRow[0])) {
          startIndex = 0;
        } else {
          startIndex = 1;
        }
      } else {
        // Existing format: metadata on first row
        jpBankFormat = 'v1';
        startIndex = 1;
        amountIdx = 2;
      }
    } else if (cardType === 'jcb') {
      amountIdx = 4;
      startIndex = 0;
    } else if (cardType === 'paypay') {
      amountIdx = 1; // 出金金額
      startIndex = 0;
    }

    if (data.length > startIndex) {
      const checkRow = data[startIndex];
      // If the current row contains non-numeric text in an amount column, it's likely a header
      const amountVal = checkRow[amountIdx]?.replace(/[,円]/g, '');
      if (!amountVal || isNaN(Number(amountVal))) {
        startIndex++;
      }
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      const minLength = cardType === 'jcb' ? 5 : (cardType === 'paypay' ? 13 : 3);
      if (!row || row.length < minLength) continue;

      let date = '';
      let payee = '';
      let amountStr = '';

      if (cardType === 'jp_bank') {
        if (jpBankFormat === 'v1') {
          // JP BANK v1: 1:Date, 2:Payee, 3:Amount
          date = this.normalizeDate(row[0]);
          payee = (row[1] || '').trim();
          amountStr = row[2] || '0';
        } else {
          // JP BANK v2: 1:Date, 2:Payee, 7:Amount
          date = this.normalizeDate(row[0]);
          payee = (row[1] || '').trim();
          amountStr = row[6] || '0';
        }
      } else if (cardType === 'jcb') {
        // JCB: 3:利用日, 4:利用先, 5:利用金額 (0-indexed: 2, 3, 4)
        date = this.normalizeDate(row[2].slice(1));
        payee = (row[3] || '').trim();
        amountStr = row[4] || '0';
      } else if (cardType === 'paypay') {
        // PayPay: 1:取引日, 2:出金金額, 3:入金金額, 9:取引先, 13:取引番号
        date = this.normalizeDate(row[0]);
        payee = (row[8] || '').trim();
        const withdrawal = row[1] ? Number(row[1].replace(/[,円]/g, '')) : 0;
        const deposit = row[2] ? Number(row[2].replace(/[,円]/g, '')) : 0;

        if (withdrawal > 0) {
          amountStr = (-withdrawal).toString();
        } else if (deposit > 0) {
          amountStr = deposit.toString();
        } else {
          amountStr = '0';
        }

        const transactionId = (row[12] || '').trim();
        if (transactionId) {
          const isDuplicateInDb = existingTransactions.some(t => 
            t.import_hash === transactionId || 
            (t.import_hash && t.import_hash.startsWith(transactionId + '_'))
          );
          const isDuplicateInBatch = transactions.some(t => 
            t.import_hash === transactionId || 
            (t.import_hash && t.import_hash.startsWith(transactionId + '_'))
          );
          
          if (isDuplicateInDb || isDuplicateInBatch) {
            console.log(`Skipping duplicate by hash: ${transactionId}`);
            continue;
          }
        }

        // Skip PayPay points transactions as they don't affect cash balance
        const methodStr = (row[9] || '').trim();
        if (methodStr === 'PayPayポイント') {
          console.log('Skipping point transaction');
          continue;
        }

        const typeStr = (row[7] || '').trim();
        // Also skip rows that are just point acquisitions without cash movement
        if (typeStr === 'ポイント、残高の獲得' && withdrawal === 0 && deposit === 0) {
          console.log('Skipping point acquisition without cash movement');
          continue;
        }

        // Special handling for PayPay "Charge" (チャージ)
        if (typeStr === 'チャージ') {
          const externalAccountName = (row[9] || '').trim();
          const sourceAccountId = accountMappings[externalAccountName];

          if (sourceAccountId) {
            const amount = Number(deposit || withdrawal);
            const transferId = Date.now() + i;

            // Side 1: Destination (PayPay)
            transactions.push({
              amount: Math.abs(amount),
              category_id: 'transfer',
              account_id: accountId,
              to_account_id: sourceAccountId,
              date,
              memo: `PayPayチャージ (${externalAccountName})`,
              payee: externalAccountName,
              import_hash: transactionId ? `${transactionId}_dest` : null,
              transfer_id: transferId
            });

            // Side 2: Source (Bank)
            transactions.push({
              amount: -Math.abs(amount),
              category_id: 'transfer',
              account_id: sourceAccountId,
              to_account_id: accountId,
              date,
              memo: `PayPayチャージ`,
              payee: 'PayPay',
              import_hash: transactionId ? `${transactionId}_src` : null,
              transfer_id: transferId
            });

            continue; // Skip standard processing for this row
          } else {
            // Mapping missing
            missingMappings.add(externalAccountName);
          }
        }
      } else {
        continue;
      }

      const cleanAmount = amountStr.replace(/[,円]/g, '');
      let amount = Number(cleanAmount);
      if (cardType !== 'paypay') {
        amount = -Math.abs(amount); // Credit card payments are expenses (negative)
      }

      console.log(row[2]);
      console.log(date);
      if (!isNaN(amount) && date) {
        console.log("check");
        // Check for duplicates (Date, Payee, Amount)
        const isDuplicate = accountTransactions.some(t => {
          // Compare date part only (YYYY-MM-DD)
          const tDate = t.date.split('T')[0];
          const importDate = date.split('T')[0];
          return tDate === importDate && t.payee === payee && t.amount === amount;
        });

        if (isDuplicate) {
          console.log(`Skipping duplicate: ${date}, ${payee}, ${amount}`);
          continue;
        }

        // Use mapping if exists, otherwise default to 'others'
        const category_id = mappings[payee] || 'others';
        console.log("push");
        transactions.push({
          amount,
          category_id,
          account_id: accountId,
          date,
          memo: `${cardType.toUpperCase()} CSVインポート`,
          payee,
          import_hash: cardType === 'paypay' ? (row[12] || '').trim() : null,
        });
      }
    }

    return { transactions, missingMappings: Array.from(missingMappings) };
  },

  normalizeDate(dateStr: string): string {
    // Expected formats: YYYY/MM/DD, YYYY-MM-DD, YYYYMMDD
    if (!dateStr) return '';
    let normalized = dateStr.replace(/\//g, '-');

    // If YYYYMMDD
    if (/^\d{8}$/.test(normalized)) {
      normalized = `${normalized.substring(0, 4)}-${normalized.substring(4, 6)}-${normalized.substring(6, 8)}`;
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  }
};
