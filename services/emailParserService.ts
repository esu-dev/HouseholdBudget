import { useDeveloperStore } from '../store/useDeveloperStore';

export interface ParsedEmailTransaction {
  amount: number;
  date: string;
  payee: string;
  gmail_message_id: string;
}

export interface EmailParser {
  name: string;
  fromAddress: string;
  parse(body: string, messageId: string): ParsedEmailTransaction[];
}

class RakutenCardParser implements EmailParser {
  name = '楽天カード';
  fromAddress = 'info@mail.rakuten-card.co.jp';

  parse(body: string, messageId: string): ParsedEmailTransaction[] {
    const amountMatch = body.match(/利用金額：\s*([\d,]+)\s*円/);
    const dateMatch = body.match(/利用日：\s*(\d{4}\/\d{2}\/\d{2})/);
    const merchantMatch = body.match(/利用先：\s*(.*)/);

    if (amountMatch && dateMatch && merchantMatch) {
      return [{
        amount: -parseInt(amountMatch[1].replace(/,/g, '')),
        date: new Date(dateMatch[1]).toISOString(),
        payee: merchantMatch[1].trim(),
        gmail_message_id: messageId,
      }];
    }
    return [];
  }
}

class VpassParser implements EmailParser {
  name = '三井住友カード (Vpass)';
  fromAddress = 'mail@vpass.ne.jp';

  parse(body: string, messageId: string): ParsedEmailTransaction[] {
    const amountMatch = body.match(/利用金額\s*([\d,]+)円/);
    const dateMatch = body.match(/利用日\s*(\d{4}\/\d{2}\/\d{2})/);
    const merchantMatch = body.match(/利用先\s*(.*)/);

    if (amountMatch && dateMatch && merchantMatch) {
      return [{
        amount: -parseInt(amountMatch[1].replace(/,/g, '')),
        date: new Date(dateMatch[1]).toISOString(),
        payee: merchantMatch[1].trim(),
        gmail_message_id: messageId,
      }];
    }
    return [];
  }
}

class JCBCardWParser implements EmailParser {
  name = 'JCBカードW';
  fromAddress = 'mail@qa.jcb.co.jp';

  parse(body: string, messageId: string): ParsedEmailTransaction[] {
    const transactions: ParsedEmailTransaction[] = [];
    const logger = useDeveloperStore.getState();

    // 複数件ある場合のパターンのチェック (◆ご利用１, ◆ご利用２...)
    const multiPattern = /◆ご利用[0-9１-９]+[\s\S]*?【ご利用先】\s*(.*)/g;
    const multiMatches = body.matchAll(multiPattern);
    
    let matchFound = false;
    for (const match of multiMatches) {
      matchFound = true;
      const block = match[0];
      const amountMatch = block.match(/【ご利用金額】\s*([\d,]+)円/);
      // 日付は「ご利用日」または「ご利用日時(日本時間)」の両方に対応
      const dateMatch = block.match(/【ご利用(?:日|日時\(日本時間\))】\s*(\d{4}\/\d{2}\/\d{2})/);
      const merchantMatch = block.match(/【ご利用先】\s*(.*)/);

      if (amountMatch && dateMatch && merchantMatch) {
        try {
          const amount = -parseInt(amountMatch[1].replace(/,/g, '').trim());
          const dateStr = dateMatch[1].replace(/\//g, '-');
          const date = new Date(dateStr).toISOString();
          
          transactions.push({
            amount,
            date,
            payee: merchantMatch[1].trim(),
            gmail_message_id: messageId,
          });
        } catch (e) {
          logger.addLog('error', `JCB multi-parse error: ${e}`);
        }
      }
    }

    // 複数件パターンが見つからない場合は単一形式を試す
    if (!matchFound) {
      const amountMatch = body.match(/【ご利用金額】\s*([\d,]+)円/);
      const dateMatch = body.match(/【ご利用(?:日|日時\(日本時間\))】\s*(\d{4}\/\d{2}\/\d{2})/);
      const merchantMatch = body.match(/【ご利用先】\s*(.*)/);

      if (amountMatch && dateMatch && merchantMatch) {
        try {
          const amount = -parseInt(amountMatch[1].replace(/,/g, '').trim());
          const dateStr = dateMatch[1].replace(/\//g, '-');
          const date = new Date(dateStr).toISOString();
          
          transactions.push({
            amount,
            date,
            payee: merchantMatch[1].trim(),
            gmail_message_id: messageId,
          });
        } catch (e) {
          logger.addLog('error', `JCB single-parse error: ${e}`);
        }
      }
    }

    logger.addLog('debug', `JCB Parser: Found ${transactions.length} transactions`);
    return transactions;
  }
}

export const emailParserService = {
  parsers: [
    new RakutenCardParser(),
    new VpassParser(),
    new JCBCardWParser(),
  ] as EmailParser[],

  parseEmail(from: string, body: string, messageId: string): ParsedEmailTransaction[] {
    const logger = useDeveloperStore.getState();
    logger.addLog('debug', `Searching parser for: ${from}`);
    const parser = this.parsers.find(p => from.includes(p.fromAddress));
    if (parser) {
      logger.addLog('debug', `Using parser: ${parser.name}`);
      try {
        const results = parser.parse(body, messageId);
        logger.addLog('debug', `Parser result for ${parser.name}: ${results.length} found`);
        return results;
      } catch (e: any) {
        logger.addLog('error', `Parser error in ${parser.name}: ${e.message}`);
        return [];
      }
    }
    logger.addLog('warn', `No matching parser found for sender: ${from}`);
    return [];
  },
};

