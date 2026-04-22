import { databaseService } from './database';

export const creditCardPaymentService = {
  /**
   * クレジットカードの取引月に基づいて、翌月の引き落とし日の振替を更新する
   */
  /**
   * クレジットカードの取引日に基づいて、締め日を考慮したサイクル月を特定し、
   * その翌月の引き落とし日の振替を更新する
   */
  async updateTransferForDate(accountId: string, _dateStr?: string): Promise<void> {
    const accounts = await databaseService.getAllAccounts();
    const cardAccount = accounts.find(a => a.id === accountId);

    if (!cardAccount || cardAccount.type !== 'card' || !cardAccount.withdrawalAccountId || cardAccount.withdrawalDay == null) {
      return;
    }

    const userId = '1'; // Placeholder or get from context if multiple users
    const closingDay = cardAccount.closingDay || 0;
    
    // 開始日を YYYY-MM 形式に正規化
    const normalizeYearMonth = (str: string | undefined) => {
      if (!str) return undefined;
      const match = str.match(/(\d{4})[-/年](\d{1,2})/);
      if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}`;
      }
      return str;
    };
    const billingStartDate = normalizeYearMonth(cardAccount.billingStartDate);

    const allTransactions = await databaseService.getAllTransactions();
    
    // 1. 該当アカウントの「通常の取引（振替以外）」のみを抽出
    const cardTransactions = allTransactions.filter(t => 
      t.account_id === accountId && t.category_id !== 'transfer'
    );

    // 2. 取引から「存在するサイクル（YYYY-MM）」を特定
    const memoPattern = `カード引落: ${cardAccount.name}`;
    const cycles = new Map<string, { year: number, month: number, total: number }>();

    // 取引がある月をサイクルとして登録
    cardTransactions.forEach(t => {
      const tDate = new Date(t.date);
      let tYear = tDate.getFullYear();
      let tMonth = tDate.getMonth();
      const tDay = tDate.getDate();

      if (closingDay > 0 && tDay > closingDay) {
        tMonth++;
        if (tMonth > 11) {
          tMonth = 0;
          tYear++;
        }
      }

      const cycleKey = `${tYear}-${String(tMonth + 1).padStart(2, '0')}`;
      
      // 開始日設定がある場合、それより前のサイクルは無視
      if (billingStartDate && cycleKey < billingStartDate) {
        return;
      }

      if (!cycles.has(cycleKey)) {
        cycles.set(cycleKey, { year: tYear, month: tMonth, total: 0 });
      }
      // 支出（負）をプラス、収入（正）をマイナスとして合計
      cycles.get(cycleKey)!.total -= t.amount;
    });

    // 3. 既存の振替取引からもサイクルを特定
    const existingTransfers = allTransactions.filter(t => 
      t.account_id === accountId && 
      t.category_id === 'transfer' && 
      t.memo?.includes(memoPattern)
    );

    existingTransfers.forEach(t => {
      const match = t.memo?.match(/\((\d{4})\/(\d{1,2})分\)/);
      if (match) {
        const y = parseInt(match[1]);
        const m = parseInt(match[2]) - 1;
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        
        // 開始日設定がある場合、それより前のサイクルは無視
        if (billingStartDate && key < billingStartDate) {
          return;
        }

        if (!cycles.has(key)) {
          cycles.set(key, { year: y, month: m, total: 0 });
        }
      }
    });

    // 4. 各サイクルについて振替を更新（または削除）
    for (const [cycleKey, data] of cycles.entries()) {
      const { year, month, total } = data;
      const monthTag = `(${year}/${month + 1}分)`;
      
      const existingTransferTx = existingTransfers.find(t => t.memo?.includes(monthTag));

      // 合計が0以下（収入過多など）の場合は振替不要
      if (total <= 0) {
        if (existingTransferTx && existingTransferTx.transfer_id) {
          await databaseService.deleteTransaction(existingTransferTx.id);
        }
        continue;
      }

      // 引き落とし日を計算 (サイクル月の翌月)
      let withdrawalYear = year;
      let withdrawalMonth = month + 1;
      if (withdrawalMonth > 11) {
        withdrawalYear++;
        withdrawalMonth = 0;
      }

      let wDay = cardAccount.withdrawalDay;
      if (wDay === 0) {
        wDay = new Date(withdrawalYear, withdrawalMonth + 1, 0).getDate();
      }

      const withdrawalDateStr = `${withdrawalYear}-${String(withdrawalMonth + 1).padStart(2, '0')}-${String(wDay).padStart(2, '0')}T00:00:00.000Z`;
      const withdrawalDate = new Date(withdrawalYear, withdrawalMonth, wDay);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // 未来の日付の引き落としは作成しない
      if (withdrawalDate > today) {
        if (existingTransferTx && existingTransferTx.transfer_id) {
          await databaseService.deleteTransaction(existingTransferTx.id);
        }
        continue;
      }

      if (existingTransferTx && existingTransferTx.transfer_id) {
        const transferId = existingTransferTx.transfer_id;
        const relatedTxs = allTransactions.filter(t => t.transfer_id === transferId);

        for (const tx of relatedTxs) {
          if (tx.account_id === accountId) {
            await databaseService.updateTransaction({
              ...tx,
              amount: total,
              date: withdrawalDateStr,
              payee: null,
              to_account_id: cardAccount.withdrawalAccountId
            });
          } else if (tx.account_id === cardAccount.withdrawalAccountId) {
            await databaseService.updateTransaction({
              ...tx,
              amount: -total,
              date: withdrawalDateStr,
              payee: null,
              to_account_id: accountId
            });
          }
        }
      } else {
        // 時刻を含めたユニークなIDを作成
        const transferId = Date.now() + Math.floor(Math.random() * 1000); 
        
        await databaseService.addTransaction({
          amount: -total,
          category_id: 'transfer',
          account_id: cardAccount.withdrawalAccountId,
          to_account_id: accountId,
          date: withdrawalDateStr,
          memo: `${memoPattern} ${monthTag}`,
          payee: null,
          transfer_id: transferId
        });

        await databaseService.addTransaction({
          amount: total,
          category_id: 'transfer',
          account_id: accountId,
          to_account_id: cardAccount.withdrawalAccountId,
          date: withdrawalDateStr,
          memo: `${memoPattern} ${monthTag}`,
          payee: null,
          transfer_id: transferId
        });
      }
    }
  }
};
