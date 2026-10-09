import { create } from 'zustand';
import { creditCardPaymentService } from '../services/creditCardPaymentService';
import { databaseService } from '../services/database';
import { AddSavingInput, CreateWishlistInput, UpdateWishlistInput, WishlistItem, WishlistSaving } from '../types/wishlist';
import { useTransactionStore } from './useTransactionStore';

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  error: string | null;
  fetchWishlist: () => Promise<void>;
  createItem: (input: CreateWishlistInput) => Promise<number>;
  updateItem: (input: UpdateWishlistInput) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  addSaving: (input: AddSavingInput) => Promise<void>;
  removeSaving: (savingId: number) => Promise<void>;
  getSavingsForItem: (wishlistId: number) => Promise<WishlistSaving[]>;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchWishlist: async () => {
    set({ isLoading: true });
    try {
      const items = await databaseService.getAllWishlistItems();
      set({ items, isLoading: false, error: null });
    } catch (e: any) {
      set({ error: e.message || 'Failed to fetch wishlist', isLoading: false });
    }
  },

  createItem: async (input: CreateWishlistInput) => {
    try {
      const id = await databaseService.createWishlistItem(input);
      await get().fetchWishlist();
      return id;
    } catch (e: any) {
      set({ error: e.message || 'Failed to create wishlist item' });
      throw e;
    }
  },

  updateItem: async (input: UpdateWishlistInput) => {
    try {
      await databaseService.updateWishlistItem(input);
      await get().fetchWishlist();
    } catch (e: any) {
      set({ error: e.message || 'Failed to update wishlist item' });
      throw e;
    }
  },

  deleteItem: async (id: number) => {
    try {
      const { affectedAccountIds } = await databaseService.deleteWishlistItem(id);
      await get().fetchWishlist();

      // 口座残高を最新化
      await useTransactionStore.getState().fetchData();

      // カード口座の場合は振替の更新も実行
      for (const accId of affectedAccountIds) {
        await creditCardPaymentService.updateTransferForDate(accId);
      }
    } catch (e: any) {
      set({ error: e.message || 'Failed to delete wishlist item' });
      throw e;
    }
  },

  addSaving: async (input: AddSavingInput) => {
    try {
      const { affectedAccountId } = await databaseService.addSavingToWishlist(input);
      await get().fetchWishlist();

      // 口座残高を最新化
      await useTransactionStore.getState().fetchData();

      // カード口座の場合は振替の更新も実行
      await creditCardPaymentService.updateTransferForDate(affectedAccountId);
    } catch (e: any) {
      set({ error: e.message || 'Failed to add saving to wishlist' });
      throw e;
    }
  },

  removeSaving: async (savingId: number) => {
    try {
      const { affectedAccountId } = await databaseService.removeSavingFromWishlist(savingId);
      await get().fetchWishlist();

      // 口座残高を最新化
      await useTransactionStore.getState().fetchData();

      // カード口座の場合は振替の更新も実行
      await creditCardPaymentService.updateTransferForDate(affectedAccountId);
    } catch (e: any) {
      set({ error: e.message || 'Failed to remove saving from wishlist' });
      throw e;
    }
  },

  getSavingsForItem: async (wishlistId: number) => {
    try {
      return await databaseService.getSavingsByWishlistId(wishlistId);
    } catch (e: any) {
      return [];
    }
  },
}));
