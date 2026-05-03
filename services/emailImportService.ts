import { databaseService } from '../services/database';
import { useTransactionStore } from '../store/useTransactionStore';
import { emailParserService } from './emailParserService';
import { gmailService } from './gmailService';
import { useDeveloperStore } from '../store/useDeveloperStore';

export const emailImportService = {
  async importFromGmail(token: string) {
    // カテゴリマッピングの取得
    const categoryMappings = await databaseService.getAllPayeeCategoryMappings();

    const results = {
      total: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
    };

    if (token === 'mock_token') {
      const logger = useDeveloperStore.getState();
      logger.addLog('info', 'Mock mode started');
      // 開発者用シミュレーションモード
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockEmailBody = `氏名 様
カード名称　：　【ＯＳ】ＪＣＢカードＷ　ＮＬ


　◆ご利用１
　　【ご利用日】　2026/04/29
　　【ご利用金額】　 280円
　　【ご利用先】　豊島屋　瀬戸小路／ＧＭＯＦＧ
　◆ご利用２
　　【ご利用日】　2026/04/29
　　【ご利用金額】　 500円
　　【ご利用先】　豊島屋　本店／ＧＭＯＦＧ

　※本通知は、カードご利用時に通知していないものが対象です。`;

      const from = 'mail@qa.jcb.co.jp';
      const msgId = 'mock_msg_jcb_multi_' + Date.now();

      logger.addLog('debug', `Parsing mock multi-transaction email from ${from}`);
      const parsedTransactions = emailParserService.parseEmail(from, mockEmailBody, msgId);
      logger.addLog('debug', `Parsed ${parsedTransactions.length} transactions`);
      const store = useTransactionStore.getState();

      for (let i = 0; i < parsedTransactions.length; i++) {
        const parsed = parsedTransactions[i];
        logger.addLog('info', `Adding transaction ${i+1}/${parsedTransactions.length}: ${parsed.payee}`);
        
        let accountId = 'card';
        const accounts = store.accounts;
        const mappedId = await databaseService.getSetting('gmail_account_id_jcb');

        if (mappedId && accounts.some(a => a.id === mappedId)) {
          accountId = mappedId;
        } else {
          accountId = accounts.find(a => a.name.includes('JCB'))?.id || 'card';
        }

        const category_id = categoryMappings[parsed.payee] || 'others';

        await store.addTransaction({
          amount: parsed.amount,
          date: parsed.date,
          payee: parsed.payee,
          category_id,
          account_id: accountId,
          memo: 'Gmail自動インポート(Mock)',
          import_hash: `${msgId}_${i}`,
        });
        results.imported++;
      }
      
      const accountId = await databaseService.getSetting('gmail_account_id_jcb') || 'card';
      await databaseService.updateLastEmailImportedAt(accountId, new Date().toISOString());
      logger.addLog('info', 'Mock transactions added successfully');

      return results;
    }

    const logger = useDeveloperStore.getState();
    logger.addLog('info', 'Starting Gmail import...');

    // クレジットカードごとに検索クエリを実行
    const queries = [
      'from:info@mail.rakuten-card.co.jp subject:"カード利用のお知らせ"',
      'from:mail@vpass.ne.jp subject:"【三井住友カード】ご利用のお知らせ"',
      'from:mail@qa.jcb.co.jp subject:"JCBカード／ショッピングご利用のお知らせ"',
    ];

    const affectedAccountIds = new Set<string>();

    for (const query of queries) {
      try {
        logger.addLog('debug', `Searching Gmail with query: ${query}`);
        const messages = await gmailService.listMessages(token, query);
        logger.addLog('info', `Found ${messages.length} messages for query: ${query}`);

        for (const msg of messages) {
          try {
            // メッセージ本文取得
            logger.addLog('debug', `Fetching message details for ${msg.id}...`);
            const fullMsg = await gmailService.getMessage(token, msg.id);
            logger.addLog('debug', `Message from: ${fullMsg.from}`);

            // パース実行
            const parsedTransactions = emailParserService.parseEmail(fullMsg.from, fullMsg.body, fullMsg.id);

            if (parsedTransactions.length > 0) {
              results.total += parsedTransactions.length;
              
              for (let i = 0; i < parsedTransactions.length; i++) {
                const parsed = parsedTransactions[i];
                // 1件のみの場合は従来のハッシュ、複数件の場合はインデックス付き
                const currentHash = parsedTransactions.length > 1 ? `${fullMsg.id}_${i}` : fullMsg.id;
                
                // 重複チェック
                const exists = await databaseService.isImportHashExists(currentHash);
                if (exists) {
                  logger.addLog('debug', `Skipping transaction ${currentHash} (already imported)`);
                  results.skipped++;
                  continue;
                }

                logger.addLog('info', `Parsed transaction: ${parsed.payee}, ${parsed.amount}円`);
                
                let accountId = 'card';
                const store = useTransactionStore.getState();
                const accounts = store.accounts;

                let mappedId = null;
                if (fullMsg.from.includes('rakuten-card')) {
                  mappedId = await databaseService.getSetting('gmail_account_id_rakuten');
                } else if (fullMsg.from.includes('vpass')) {
                  mappedId = await databaseService.getSetting('gmail_account_id_vpass');
                } else if (fullMsg.from.includes('jcb.co.jp')) {
                  mappedId = await databaseService.getSetting('gmail_account_id_jcb');
                }

                if (mappedId && accounts.some(a => a.id === mappedId)) {
                  accountId = mappedId;
                } else {
                  if (fullMsg.from.includes('rakuten-card')) {
                    accountId = accounts.find(a => a.name.includes('楽天'))?.id || 'card';
                  } else if (fullMsg.from.includes('vpass')) {
                    accountId = accounts.find(a => a.name.includes('三井住友'))?.id || 'card';
                  } else if (fullMsg.from.includes('jcb.co.jp')) {
                    accountId = accounts.find(a => a.name.includes('JCB'))?.id || 'card';
                  }
                }

                const category_id = categoryMappings[parsed.payee] || 'others';

                await store.addTransaction({
                  amount: parsed.amount,
                  date: parsed.date,
                  payee: parsed.payee,
                  category_id,
                  account_id: accountId,
                  memo: 'Gmail自動インポート',
                  import_hash: currentHash,
                });

                affectedAccountIds.add(accountId);
                results.imported++;
                logger.addLog('success', `Imported: ${parsed.payee}`);
              }
            } else {
              logger.addLog('warn', `Failed to parse message from ${fullMsg.from}`);
              results.failed++;
              results.total++;
            }
          } catch (e: any) {
            logger.addLog('error', `Failed to process message ${msg.id}: ${e.message}`);
            results.failed++;
            results.total++;
          }
        }

      } catch (e: any) {
        logger.addLog('error', `Failed to list messages for query "${query}": ${e.message}`);
      }
    }

    // 実行されたアカウント（マッピングされているものすべて）の最終読み込み日時を更新
    const now = new Date().toISOString();
    const mappedAccounts = [
      await databaseService.getSetting('gmail_account_id_rakuten'),
      await databaseService.getSetting('gmail_account_id_vpass'),
      await databaseService.getSetting('gmail_account_id_jcb'),
    ].filter(id => id !== null) as string[];

    // 実際に取引があったアカウントも追加（マッピングがない場合のフォールバック等）
    for (const id of affectedAccountIds) {
      if (!mappedAccounts.includes(id)) {
        mappedAccounts.push(id);
      }
    }

    for (const accountId of mappedAccounts) {
      await databaseService.updateLastEmailImportedAt(accountId, now);
    }

    logger.addLog('info', `Import process finished. Results: ${JSON.stringify(results)}`);
    return results;
  }
};
