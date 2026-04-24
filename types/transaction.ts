export type Transaction = {
  id: number;
  amount: number; // 正:収入 / 負:支出
  category_id: string;
  account_id: string;
  to_account_id: string | null;
  date: string; // ISO8601 string
  memo: string | null;
  payee: string | null;
  transfer_id: number | null;
  fee: number;
  import_hash: string | null;
  is_deferred: boolean;
};

export type CreateTransactionInput = {
  amount: number;
  category_id: string;
  account_id: string;
  to_account_id?: string | null;
  date: string;
  memo: string | null;
  payee: string | null;
  transfer_id?: number | null;
  fee?: number;
  import_hash?: string | null;
  is_deferred?: boolean;
};
