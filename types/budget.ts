export type Budget = {
  id: number;
  month: string; // YYYY-MM
  category_id: string; // Major Category ID or Minor Category ID, we'll decide. Let's start with Minor Category.
  amount: number;
};

export type CreateBudgetInput = {
  month: string;
  category_id: string;
  amount: number;
};
