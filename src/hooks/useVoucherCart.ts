import { useState, useCallback } from 'react';

export interface CartItem {
  tempo: string;
  quantity: number;
  type?: 'voucher' | 'ficha';
  fichaType?: 'portaria' | 'comida';
  fichaTexto?: string;
  fichaValor?: number;
}

export function useVoucherCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((tempo: string, options?: { type?: 'voucher' | 'ficha'; fichaType?: 'portaria' | 'comida'; fichaTexto?: string; fichaValor?: number }) => {
    setItems(prev => {
      const existing = prev.find(i => {
        if (options?.fichaType) return i.fichaType === options.fichaType;
        return i.tempo === tempo && !i.fichaType;
      });
      if (existing) {
        return prev.map(i => {
          if (options?.fichaType) return i.fichaType === options.fichaType ? { ...i, quantity: i.quantity + 1 } : i;
          return i.tempo === tempo && !i.fichaType ? { ...i, quantity: i.quantity + 1 } : i;
        });
      }
      return [...prev, { tempo, quantity: 1, type: options?.type || 'voucher', fichaType: options?.fichaType, fichaTexto: options?.fichaTexto, fichaValor: options?.fichaValor }];
    });
  }, []);

  const removeItem = useCallback((tempo: string, fichaType?: string) => {
    setItems(prev => {
      const finder = (i: CartItem) => fichaType ? i.fichaType === fichaType : (i.tempo === tempo && !i.fichaType);
      const existing = prev.find(finder);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter(i => !finder(i));
      }
      return prev.map(i => finder(i) ? { ...i, quantity: i.quantity - 1 } : i);
    });
  }, []);

  const removeAll = useCallback((tempo: string, fichaType?: string) => {
    setItems(prev => prev.filter(i => fichaType ? i.fichaType !== fichaType : !(i.tempo === tempo && !i.fichaType)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, removeItem, removeAll, clearCart, totalItems };
}
