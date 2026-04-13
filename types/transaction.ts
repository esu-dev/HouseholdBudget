export type Transaction = {
  id: number;
  amount: number; // 正:収入 / 負:支出
  category_id: string;
  account_id: string;
  date: string; // ISO8601 string
  memo: string | null;
  payee: string | null;
};

export type CreateTransactionInput = {
  amount: number;
  category_id: string;
  account_id: string;
  date: string;
  memo: string | null;
  payee: string | null;
};
