import { databaseService } from './database';

export const creditCardPaymentService = {
  /**
   * クレジットカードの取引月に基づいて、翌月の引き落とし日の振替を更新する
   */
  async updateTransferForDate(accountId: string, transactionDateStr: string): Promise<void> {
    const accounts = await databaseService.getAllAccounts();
    const cardAccount = accounts.find(a => a.id === accountId);

    if (!cardAccount) {
      return;
    }

    // withdrawalDay が null または undefined の場合のチェック
    if (cardAccount.type !== 'card' || !cardAccount.withdrawalAccountId || cardAccount.withdrawalDay == null) {
      return;
    }

    const date = new Date(transactionDateStr);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed (0:1月, 3:4月)

    // 対象となる月の文字列 (YYYY-MM)
    const targetMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    // 引き落とし日を計算 (翌月の指定日)
    let withdrawalYear = year;
    let withdrawalMonth = month + 1; // 翌月
    if (withdrawalMonth > 11) {
      withdrawalYear++;
      withdrawalMonth = 0;
    }
    
    // 指定日が0の場合は末日
    let day = cardAccount.withdrawalDay;
    if (day === 0) {
      day = new Date(withdrawalYear, withdrawalMonth + 1, 0).getDate();
    }
    
    const withdrawalDateStr = `${withdrawalYear}-${String(withdrawalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;

    // 取引月内の全取引を取得
    const allTransactions = await databaseService.getAllTransactions();
    const monthlyTransactions = allTransactions.filter(t => {
      const tDate = new Date(t.date);
      const tYear = tDate.getFullYear();
      const tMonth = tDate.getMonth();
      const tMonthStr = `${tYear}-${String(tMonth + 1).padStart(2, '0')}`;
      
      return t.account_id === accountId && 
             tMonthStr === targetMonthStr &&
             t.category_id !== 'transfer'; // 振替自体は除外
    });

    // 合計金額を計算 (支出は負数なので、絶対値の合計が入金額になる)
    const totalAmount = Math.abs(monthlyTransactions.reduce((sum, t) => sum + t.amount, 0));

    // 既存の自動振替を検索
    const memoPattern = `カード引落: ${cardAccount.name}`;
    const monthTag = `(${year}/${month + 1}分)`;
    const existingTransferTx = allTransactions.find(t => 
      t.account_id === accountId && 
      t.category_id === 'transfer' && 
      t.memo?.includes(memoPattern) &&
      t.memo?.includes(monthTag)
    );

    if (totalAmount === 0) {
      if (existingTransferTx && existingTransferTx.transfer_id) {
        await databaseService.deleteTransaction(existingTransferTx.id);
      }
      return;
    }

    const withdrawalAccount = accounts.find(a => a.id === cardAccount.withdrawalAccountId);
    const withdrawalAccountName = withdrawalAccount?.name || '不明な口座';

    if (existingTransferTx && existingTransferTx.transfer_id) {
      const transferId = existingTransferTx.transfer_id;
      const relatedTxs = allTransactions.filter(t => t.transfer_id === transferId);

      for (const tx of relatedTxs) {
        if (tx.account_id === accountId) {
          await databaseService.updateTransaction({
            ...tx,
            amount: totalAmount,
            date: withdrawalDateStr,
            payee: null,
            to_account_id: cardAccount.withdrawalAccountId
          });
        } else if (tx.account_id === cardAccount.withdrawalAccountId) {
          await databaseService.updateTransaction({
            ...tx,
            amount: -totalAmount,
            date: withdrawalDateStr,
            payee: null,
            to_account_id: accountId
          });
        }
      }
    } else {
      const transferId = Date.now();
      
      await databaseService.addTransaction({
        amount: -totalAmount,
        category_id: 'transfer',
        account_id: cardAccount.withdrawalAccountId,
        to_account_id: accountId,
        date: withdrawalDateStr,
        memo: `${memoPattern} ${monthTag}`,
        payee: null,
        transfer_id: transferId
      });

      await databaseService.addTransaction({
        amount: totalAmount,
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
};
