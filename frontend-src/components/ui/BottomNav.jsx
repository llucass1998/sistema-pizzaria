import React from 'react';
import { Home, ShoppingCart, User } from 'lucide-react';

export function BottomNav({ cartItemCount, currentPath, isCartOpen, onCartClick }) {
  const isMenu = currentPath === '/' || currentPath.startsWith('/categoria');
  const isCart = isCartOpen || currentPath === '/carrinho';
  const isAccount = currentPath === '/conta' || currentPath === '/admin';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_40px_rgba(0,0,0,0.35)] backdrop-blur md:hidden"
      aria-label="Navegacao principal"
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        <a
          href="#/"
          className={`flex h-full w-full flex-col items-center justify-center gap-1 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-95 ${
            isMenu ? 'text-amber-300' : 'text-slate-400 hover:text-amber-200'
          }`}
        >
          <Home size={24} />
          <span className="text-[10px] font-bold uppercase">Cardapio</span>
        </a>

        <button
          type="button"
          onClick={onCartClick}
          className={`relative flex h-full w-full flex-col items-center justify-center gap-1 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-95 ${
            isCart ? 'text-amber-300' : 'text-slate-400 hover:text-amber-200'
          }`}
          aria-label="Abrir carrinho"
        >
          <ShoppingCart size={24} />
          {cartItemCount > 0 && (
            <span className="absolute right-[calc(50%-18px)] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {cartItemCount}
            </span>
          )}
          <span className="text-[10px] font-bold uppercase">Carrinho</span>
        </button>

        <a
          href="#/conta"
          className={`flex h-full w-full flex-col items-center justify-center gap-1 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-95 ${
            isAccount ? 'text-amber-300' : 'text-slate-400 hover:text-amber-200'
          }`}
        >
          <User size={24} />
          <span className="text-[10px] font-bold uppercase">Pedidos</span>
        </a>
      </div>
    </nav>
  );
}
