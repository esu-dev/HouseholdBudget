export type AccountType = 'cash' | 'bank' | 'card' | 'emoney' | 'others';

export type CardType = 'jp_bank' | 'jcb' | 'paypay' | 'none';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  cardType?: CardType;
  loginUrl?: string;
  closingDay?: number;
  withdrawalDay?: number;
  withdrawalAccountId?: string;
  displayOrder: number;
  billingStartDate?: string;
  excludeFromNetWorth?: boolean;
  isHidden?: boolean;
  lastImportedAt: string | undefined;
  lastEmailImportedAt?: string;
  initialBalance: number;
};

// バランス計算用のヘルパー型
export type AccountBalance = Account & {
  balance: number;
};
