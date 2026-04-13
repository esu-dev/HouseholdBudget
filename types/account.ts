export type AccountType = 'cash' | 'bank' | 'card' | 'others';

export type CardType = 'jp_bank' | 'jcb' | 'none';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  cardType?: CardType;
  loginUrl?: string;
};

// バランス計算用のヘルパー型
export type AccountBalance = Account & {
  balance: number;
};
