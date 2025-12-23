import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useFavoritesStore = create(
  persist(
    (set, get) => ({
      favorites: [],

      isFavorite: (productId) => {
        return get().favorites.some((item) => item.id === productId);
      },

      toggleFavorite: (product) => {
        const { favorites } = get();
        const isAlreadyFavorite = favorites.some((item) => item.id === product.id);

        if (isAlreadyFavorite) {
          set({ favorites: favorites.filter((item) => item.id !== product.id) });
        } else {
          set({ favorites: [...favorites, product] });
        }
      },

      clearFavorites: () => {
        set({ favorites: [] });
      },
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useFavoritesStore;
