import { toByteArray } from 'base64-js';
import * as Encoding from 'encoding-japanese';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { CardType } from '../types/account';
import { CreateTransactionInput } from '../types/transaction';

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

      return new Promise((resolve, reject) => {
        Papa.parse(unicodeArray, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const transactions = this.mapCsvToTransactions(results.data as string[][], cardType, accountId);
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

  mapCsvToTransactions(data: string[][], cardType: CardType, accountId: string): CreateTransactionInput[] {
    const transactions: CreateTransactionInput[] = [];

    // Skip header if needed
    // JP BANK: 1:Date, 2:Payee, 3:Amount
    // JCB (Example): 1:Date, 2:Payee, 3:Amount
    
    // Check if the first row is a header or metadata
    let startIndex = 0;
    
    if (cardType === 'jp_bank') {
        // JP BANK CSV has personal info (name, card number) in the first row
        startIndex = 1;
    }

    if (data.length > startIndex) {
        const checkRow = data[startIndex];
        // If the current row contains non-numeric text in an amount column, it's likely a header
        const amountVal = checkRow[2]?.replace(/[,円]/g, '');
        if (!amountVal || isNaN(Number(amountVal))) {
            startIndex++;
        }
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 3) continue;

      let date = '';
      let payee = '';
      let amountStr = '';

      if (cardType === 'jp_bank') {
        // JP BANK: 1:Date, 2:Payee, 3:Amount
        date = this.normalizeDate(row[0]);
        payee = row[1] || '';
        amountStr = row[2] || '0';
      } else if (cardType === 'jcb') {
        // JCB (Example): 1:Date, 2:Payee, 3:Amount
        // Using same columns for simplicity in this example
        date = this.normalizeDate(row[0]);
        payee = row[1] || '';
        amountStr = row[2] || '0';
      } else {
        continue;
      }

      const cleanAmount = amountStr.replace(/[,円]/g, '');
      const amount = -Math.abs(Number(cleanAmount)); // Credit card payments are expenses (negative)

      if (!isNaN(amount) && date) {
        transactions.push({
          amount,
          category_id: 'others', // Default category
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
