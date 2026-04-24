import { databaseService } from '../services/database';
import { useTransactionStore } from '../store/useTransactionStore';
import { emailParserService } from './emailParserService';
import { gmailService } from './gmailService';

export const emailImportService = {
  async importFromGmail(token: string) {
    if (token === 'mock_token') {
      // 開発者用シミュレーションモード
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockEmailBody = `田中　太郎 様
カード名称　：　【ＯＳ】ＪＣＢカードＷ　ＮＬ

いつも【ＯＳ】ＪＣＢカードＷ　ＮＬをご利用いただきありがとうございます。
JCBカードのご利用がありましたのでご連絡します。


【ご利用日時(日本時間)】　2026/04/23 11:57
【ご利用金額】　331円
【ご利用先】　オ－ケ－チヨウフテン

▼ご留意点
　・国内の加盟店の場合、【ご利用先】はすべてカタカナ表示となります。（例：一休→イツキユウ）
　・加盟店から売上到着前の情報のため、利用明細に表示される利用先名称と異なる場合があります。`;

      const from = 'mail@qa.jcb.co.jp';
      const msgId = 'mock_msg_jcb_123';

      console.log('Mock mode started');
      const parsed = emailParserService.parseEmail(from, mockEmailBody, msgId);
      console.log('Parsed result:', parsed);
      const store = useTransactionStore.getState();

      if (parsed) {
        console.log('Adding transaction for mock...');
        // モックモードでは重複チェックをスルーして毎回追加できるようにする（テスト用）
        let accountId = 'card';
        const accounts = store.accounts;
        const mappedId = await databaseService.getSetting('gmail_account_id_jcb');
        console.log('Mapped Account ID for JCB:', mappedId);

        if (mappedId && accounts.some(a => a.id === mappedId)) {
          accountId = mappedId;
        } else {
          accountId = accounts.find(a => a.name.includes('JCB'))?.id || 'card';
        }
        console.log('Target Account ID:', accountId);

        await store.addTransaction({
          amount: parsed.amount,
          date: parsed.date,
          payee: parsed.payee,
          category_id: 'others',
          account_id: accountId,
          memo: 'Gmail自動インポート(Mock)',
          import_hash: `mock_${Date.now()}`, // 重複回避のため毎回変える
        });
        console.log('Mock transaction added successfully');

        return { total: 1, imported: 1, skipped: 0, failed: 0 };
      }
      console.log('Parsing failed for mock email');
      return { total: 1, imported: 0, skipped: 0, failed: 1 };
    }

    const results = {
      total: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
    };

    // クレジットカードごとに検索クエリを実行
    // 今回は例として「楽天カード」と「三井住友カード」のクエリをハードコード
    // 将来的には設定画面から変更可能にする
    const queries = [
      'from:info@mail.rakuten-card.co.jp subject:"カード利用のお知らせ"',
      'from:mail@vpass.ne.jp subject:"【三井住友カード】ご利用のお知らせ"',
      'from:mail@qa.jcb.co.jp subject:"JCBカード／ショッピングご利用のお知らせ"',
    ];

    for (const query of queries) {
      try {
        const messages = await gmailService.listMessages(token, query);
        results.total += messages.length;

        for (const msg of messages) {
          try {
            // 重複チェック (import_hash = gmail_message_id)
            const exists = await databaseService.isImportHashExists(msg.id);
            if (exists) {
              results.skipped++;
              continue;
            }

            // メッセージ本文取得
            const fullMsg = await gmailService.getMessage(token, msg.id);

            // パース実行
            const parsed = emailParserService.parseEmail(fullMsg.from, fullMsg.body, fullMsg.id);

            if (parsed) {
              // 取引を追加
              // 口座IDは暫定的に「card」グループのものを探すか、
              // カード会社ごとに紐付ける設定が必要
              // ここでは簡易的に「楽天カード」なら特定のID、「三井住友」なら特定のIDとする
              // 実際の運用ではアカウント設定に「Gmail連携用のアドレス」を持たせるのが理想

              let accountId = 'card'; // デフォルト
              const store = useTransactionStore.getState();
              const accounts = store.accounts;

              // データベースからマッピングを取得
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
                // マッピングがない場合は名前で推測（フォールバック）
                if (fullMsg.from.includes('rakuten-card')) {
                  accountId = accounts.find(a => a.name.includes('楽天'))?.id || 'card';
                } else if (fullMsg.from.includes('vpass')) {
                  accountId = accounts.find(a => a.name.includes('三井住友'))?.id || 'card';
                } else if (fullMsg.from.includes('jcb.co.jp')) {
                  accountId = accounts.find(a => a.name.includes('JCB'))?.id || 'card';
                }
              }

              await store.addTransaction({
                amount: parsed.amount,
                date: parsed.date,
                payee: parsed.payee,
                category_id: 'others', // カテゴリは後で自動学習または手動修正
                account_id: accountId,
                memo: 'Gmail自動インポート',
                import_hash: parsed.gmail_message_id,
              });

              results.imported++;
            } else {
              results.failed++;
            }
          } catch (e) {
            console.error(`Failed to process message ${msg.id}:`, e);
            results.failed++;
          }
        }
      } catch (e) {
        console.error(`Failed to list messages for query "${query}":`, e);
      }
    }

    return results;
  }
};
