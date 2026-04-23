import { toByteArray } from 'base64-js';
import * as Encoding from 'encoding-japanese';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { CardType } from '../types/account';
import { CreateTransactionInput } from '../types/transaction';
import { databaseService } from './database';

export const csvImportService = {
  async pickAndParseCsv(cardType: CardType, accountId: string): Promise<CreateTransactionInput[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      const fileUri = result.assets[0].uri;

      // Read as Base64 to handle different encodings (like Shift-JIS)
      const base64Content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Content) {
        console.error('Failed to read CSV content or file is empty');
        return [];
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
          complete: (results) => {
            try {
              const transactions = this.mapCsvToTransactions(
                results.data as string[][],
                cardType,
                accountId,
                mappings,
                existingTransactions
              );
              resolve(transactions);
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
      console.error('CSV pick and parse error:', error);
      throw error;
    }
  },

  mapCsvToTransactions(
    data: string[][],
    cardType: CardType,
    accountId: string,
    mappings: Record<string, string> = {},
    existingTransactions: any[] = []
  ): CreateTransactionInput[] {
    const transactions: CreateTransactionInput[] = [];

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
      const minLength = cardType === 'jcb' ? 5 : 3;
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
      } else {
        continue;
      }

      const cleanAmount = amountStr.replace(/[,円]/g, '');
      const amount = -Math.abs(Number(cleanAmount)); // Credit card payments are expenses (negative)

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
        });
      }
    }

    return transactions;
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
