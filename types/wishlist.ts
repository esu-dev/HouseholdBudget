export type WishlistStatus = 'saving' | 'completed';

export type WishlistItem = {
  id: number;
  name: string;
  target_amount: number;
  saved_amount: number;
  memo: string | null;
  category_id: string | null;
  target_date: string | null; // YYYY-MM-DD
  status: WishlistStatus;
  display_order: number;
  created_at: string;
};

export type CreateWishlistInput = {
  name: string;
  target_amount: number;
  memo?: string | null;
  category_id?: string | null;
  target_date?: string | null;
};

export type UpdateWishlistInput = Partial<CreateWishlistInput> & {
  id: number;
  status?: WishlistStatus;
  display_order?: number;
};

export type WishlistSaving = {
  id: number;
  wishlist_id: number;
  account_id: string;
  amount: number;
  date: string;
  memo: string | null;
  transaction_id: number | null;
  created_at: string;
};

export type AddSavingInput = {
  wishlist_id: number;
  account_id: string;
  amount: number;
  date?: string;
  memo?: string | null;
};
