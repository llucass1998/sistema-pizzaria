import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { formatCurrency } from '../../data/menuData.js';
import { useEffect, useRef, useState } from 'react';

export function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  cartTotal,
  onUpdateCartItemQuantity,
  onRemoveCartItem,
  store,
}) {
  const hasItems = cartItems?.length > 0;
  const isClosed = store?.isOpen === false;
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(isOpen);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    let firstFrame;
    let secondFrame;
    let restoreFocusTimer;

    if (isOpen) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIsRendered(true);
      document.body.style.overflow = 'hidden';
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          setIsAnimating(true);
          closeButtonRef.current?.focus();
        });
      });
    } else {
      setIsAnimating(false);
      document.body.style.overflow = '';
      const timer = setTimeout(() => setIsRendered(false), 300);
      restoreFocusTimer = setTimeout(() => {
        if (openerRef.current && document.contains(openerRef.current)) {
          openerRef.current.focus();
        }
      }, 0);
      return () => {
        clearTimeout(timer);
        clearTimeout(restoreFocusTimer);
      };
    }

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      clearTimeout(restoreFocusTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isRendered) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, onClose]);

  if (!isOpen && !isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-[250] flex justify-end ${
        isAnimating ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Seu Carrinho"
      ref={dialogRef}
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-[260] flex h-dvh w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-900 ${
          isAnimating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 sm:px-6">
          <h2 className="flex min-w-0 items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100 sm:text-xl">
            <ShoppingCart size={24} className="text-red-600" />
            Seu Carrinho
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-full bg-white p-2 text-slate-500 shadow-sm transition-all duration-200 ease-out hover:scale-105 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-300"
            aria-label="Fechar carrinho"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!hasItems ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ShoppingCart size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Seu carrinho está vazio</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Volte ao cardápio e adicione pizzas deliciosas!
              </p>
              <button
                onClick={onClose}
                className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-bold uppercase text-white shadow-md transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95"
              >
                Ver cardápio
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors duration-200 ease-out hover:border-red-200 dark:border-slate-800 dark:hover:border-red-900 sm:grid-cols-[auto_1fr_auto] sm:gap-4 sm:p-4"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-950 text-3xl">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <span>{item.image}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="line-clamp-2 font-bold text-slate-900 dark:text-slate-100">{item.name}</h4>
                    {item.customizations && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {item.customizations}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => onUpdateCartItemQuantity(item.id, item.qty - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all duration-200 ease-out hover:scale-105 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        aria-label="Diminuir"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-5 text-center text-base font-bold">{item.qty}</span>
                      <button
                        onClick={() => onUpdateCartItemQuantity(item.id, item.qty + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all duration-200 ease-out hover:scale-105 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        aria-label="Aumentar"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
                    <button
                      onClick={() => onRemoveCartItem(item.id)}
                      className="-ml-2 p-2 text-slate-400 transition-all duration-200 ease-out hover:scale-105 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95"
                      aria-label="Remover item"
                    >
                      <Trash2 size={20} />
                    </button>
                    <p className="break-words text-right font-black text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.price * item.qty)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasItems && (
          <footer className="border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold text-slate-600 dark:text-slate-400">Subtotal</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(cartTotal)}</span>
            </div>
            <a
              href={isClosed ? '#' : '#/checkout'}
              onClick={(e) => {
                if (isClosed) {
                  e.preventDefault();
                  return;
                }
                onClose();
              }}
              className={`flex w-full items-center justify-center rounded-xl py-4 font-black uppercase tracking-wide text-white shadow-lg transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                isClosed
                  ? 'cursor-not-allowed bg-slate-400'
                  : 'bg-red-600 hover:scale-[1.01] hover:bg-red-700 active:scale-95'
              }`}
            >
              {isClosed ? 'Loja Fechada' : 'Finalizar Pedido'}
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}
