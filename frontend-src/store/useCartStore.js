import { create } from 'zustand';

/**
 * Zustand Store para gerenciamento do Carrinho (Cart).
 * Substitui o uso de arrays avulsos e localStorage disperso no App.jsx.
 */
export const useCartStore = create((set, get) => ({
  isCartOpen: false,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
  items: JSON.parse(localStorage.getItem('pizzaria-cart') || '[]'),

  setItems: (newItems) =>
    set(() => {
      localStorage.setItem('pizzaria-cart', JSON.stringify(newItems));
      return { items: newItems };
    }),

  addItem: (item) =>
    set((state) => {
      const existingItem = state.items.find((i) => i.id === item.id);
      let newItems;
      if (existingItem) {
        newItems = state.items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      } else {
        newItems = [...state.items, item];
      }
      localStorage.setItem('pizzaria-cart', JSON.stringify(newItems));
      return { items: newItems };
    }),

  updateItemQuantity: (itemId, nextQuantity) =>
    set((state) => {
      const newItems = state.items
        .map((item) => (item.id === itemId ? { ...item, qty: Math.max(1, nextQuantity) } : item))
        .filter((item) => item.qty > 0);
      localStorage.setItem('pizzaria-cart', JSON.stringify(newItems));
      return { items: newItems };
    }),

  removeItem: (itemId) =>
    set((state) => {
      const newItems = state.items.filter((item) => item.id !== itemId);
      localStorage.setItem('pizzaria-cart', JSON.stringify(newItems));
      return { items: newItems };
    }),

  clearCart: () =>
    set(() => {
      localStorage.removeItem('pizzaria-cart');
      return { items: [] };
    }),

  getSubtotal: () => {
    return get().items.reduce((acc, item) => acc + (item.price * (item.qty || 1)), 0);
  },
}));
