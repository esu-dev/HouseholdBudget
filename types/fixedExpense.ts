export type FixedExpense = {
  id: number;
  name: string;
  amount: number;
  category_id: string;
  account_id: string;
  payment_day: number;
  payee?: string | null;
  memo?: string | null;
  is_active: boolean;
  created_at: string;
};

export type CreateFixedExpenseInput = {
  name: string;
  amount: number;
  category_id: string;
  account_id: string;
  payment_day: number;
  payee?: string | null;
  memo?: string | null;
  is_active?: boolean;
};

export type UpdateFixedExpenseInput = Partial<CreateFixedExpenseInput> & {
  id: number;
};

