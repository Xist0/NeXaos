import { create } from "zustand";
import useAuthStore from "./authStore";
import {
  syncCart as syncCartRequest,
  updateRemoteCart,
  clearRemoteCart,
} from "../services/cart.service";

const STORAGE_KEY = "nexaos_cart_items";
const COOKIE_KEY = "nexaos_cart";

const safeParse = (value, fallback = []) => {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
};

const readCookieCart = () => {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(
    new RegExp(`(?:^| )${COOKIE_KEY}=([^;]+)(?:;|$)`)
  );
  if (!match) return [];
  return safeParse(decodeURIComponent(match[1]));
};

const readLocalCart = () => {
  if (typeof window === "undefined") return [];
  const fromStorage = safeParse(localStorage.getItem(STORAGE_KEY));
  if (fromStorage.length) return fromStorage;
  return readCookieCart();
};

const persistCart = (items) => {
  if (typeof document === "undefined") return;
  const payload = JSON.stringify(items);
  localStorage.setItem(STORAGE_KEY, payload);
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(
    payload
  )}; path=/; max-age=${60 * 60 * 24 * 14}`;
};

const initialItems = readLocalCart();

const useCartStore = create((set, get) => ({
  items: initialItems,
  syncing: false,

  addItem: async (product, quantity = 1) => {
    set((state) => {
      const existing = state.items.find((item) => item.id === product.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, 99);
        return { items: [...state.items] };
      }
      return {
        items: [
          ...state.items,
          {
            id: product.id,
            name: product.name,
            price: product.final_price || product.price || 0,
            image: product.image || product.preview_url || product.image_url,
            sku: product.sku,
            quantity,
          },
        ],
      };
    });
    persistCart(get().items);
    await get().syncWithAccount();
  },

  updateQuantity: async (id, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
      ),
    }));
    persistCart(get().items);
    await get().syncWithAccount();
  },

  removeItem: async (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    persistCart(get().items);
    await get().syncWithAccount();
  },

  clearCart: async () => {
    set({ items: [] });
    persistCart([]);
    const token = useAuthStore.getState().token;
    if (token) {
      try {
        await clearRemoteCart();
      } catch (error) {
        console.warn("Failed to clear remote cart", error);
      }
    }
  },

  syncWithAccount: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const items = get().items;
    set({ syncing: true });
    try {
      const response = await syncCartRequest(items);
      if (response?.items) {
        set({ items: response.items });
        persistCart(response.items);
      } else {
        await updateRemoteCart(items);
      }
    } catch (error) {
      console.warn("Cart sync failed", error);
    } finally {
      set({ syncing: false });
    }
  },
}));

useAuthStore.subscribe(
  (state) => state.token,
  (token, previousToken) => {
    if (token && !previousToken) {
      useCartStore.getState().syncWithAccount();
    }
  }
);

export default useCartStore;

