export interface ParsedEmailTransaction {
  amount: number;
  date: string;
  payee: string;
  gmail_message_id: string;
}

export interface EmailParser {
  name: string;
  fromAddress: string;
  parse(body: string, messageId: string): ParsedEmailTransaction | null;
}

class RakutenCardParser implements EmailParser {
  name = '楽天カード';
  fromAddress = 'info@mail.rakuten-card.co.jp';

  parse(body: string, messageId: string): ParsedEmailTransaction | null {
    const amountMatch = body.match(/利用金額：\s*([\d,]+)\s*円/);
    const dateMatch = body.match(/利用日：\s*(\d{4}\/\d{2}\/\d{2})/);
    const merchantMatch = body.match(/利用先：\s*(.*)/);

    if (amountMatch && dateMatch && merchantMatch) {
      return {
        amount: -parseInt(amountMatch[1].replace(/,/g, '')),
        date: new Date(dateMatch[1]).toISOString(),
        payee: merchantMatch[1].trim(),
        gmail_message_id: messageId,
      };
    }
    return null;
  }
}

class VpassParser implements EmailParser {
  name = '三井住友カード (Vpass)';
  fromAddress = 'mail@vpass.ne.jp';

  parse(body: string, messageId: string): ParsedEmailTransaction | null {
    const amountMatch = body.match(/利用金額\s*([\d,]+)円/);
    const dateMatch = body.match(/利用日\s*(\d{4}\/\d{2}\/\d{2})/);
    const merchantMatch = body.match(/利用先\s*(.*)/);

    if (amountMatch && dateMatch && merchantMatch) {
      return {
        amount: -parseInt(amountMatch[1].replace(/,/g, '')),
        date: new Date(dateMatch[1]).toISOString(),
        payee: merchantMatch[1].trim(),
        gmail_message_id: messageId,
      };
    }
    return null;
  }
}

class JCBCardWParser implements EmailParser {
  name = 'JCBカードW';
  fromAddress = 'mail@qa.jcb.co.jp';

  parse(body: string, messageId: string): ParsedEmailTransaction | null {
    const amountMatch = body.match(/【ご利用金額】\s*([\d,]+)円/);
    const dateMatch = body.match(/【ご利用日時\(日本時間\)】\s*(\d{4}\/\d{2}\/\d{2})/);
    const merchantMatch = body.match(/【ご利用先】\s*(.*)/);

    console.log('JCB Regex Matches:', {
      amount: !!amountMatch,
      date: !!dateMatch,
      merchant: !!merchantMatch
    });

    if (amountMatch && dateMatch && merchantMatch) {
      try {
        const amount = -parseInt(amountMatch[1].replace(/,/g, ''));
        const dateStr = dateMatch[1].replace(/\//g, '-'); // yyyy/mm/dd -> yyyy-mm-dd
        const date = new Date(dateStr).toISOString();
        
        return {
          amount,
          date,
          payee: merchantMatch[1].trim(),
          gmail_message_id: messageId,
        };
      } catch (e) {
        console.error('JCB Parse Error during object creation:', e);
        return null;
      }
    }
    return null;
  }
}

export const emailParserService = {
  parsers: [
    new RakutenCardParser(),
    new VpassParser(),
    new JCBCardWParser(),
  ] as EmailParser[],

  parseEmail(from: string, body: string, messageId: string): ParsedEmailTransaction | null {
    console.log(`Searching parser for: ${from}`);
    const parser = this.parsers.find(p => from.includes(p.fromAddress));
    if (parser) {
      console.log(`Using parser: ${parser.name}`);
      try {
        const result = parser.parse(body, messageId);
        console.log(`Parser result:`, result);
        return result;
      } catch (e) {
        console.error(`Parser error in ${parser.name}:`, e);
        return null;
      }
    }
    console.log('No matching parser found');
    return null;
  },
};
