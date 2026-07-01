import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';

export function FloatingCartButton({
  cartItemCount,
  isCartOpen,
  currentPath,
  onCartClick,
}) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 768px)').matches,
  );
  const isBlockedRoute =
    currentPath === '/checkout' || currentPath === '/admin' || currentPath.startsWith('/admin/');
  const shouldShow = isDesktop && cartItemCount > 0 && !isCartOpen && !isBlockedRoute;
  const [isRendered, setIsRendered] = useState(shouldShow);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);

    updateDesktopState();
    mediaQuery.addEventListener('change', updateDesktopState);
    return () => mediaQuery.removeEventListener('change', updateDesktopState);
  }, []);

  useEffect(() => {
    if (shouldShow) {
      setIsRendered(true);
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timer = setTimeout(() => setIsRendered(false), 240);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  if (!isRendered) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onCartClick}
      className={`fixed bottom-6 right-6 z-40 hidden h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl shadow-red-950/25 transition-all duration-300 ease-out hover:scale-105 hover:bg-red-700 hover:shadow-red-950/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-red-600 dark:hover:bg-red-500 dark:focus-visible:ring-red-400 md:flex ${
        isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-90 opacity-0'
      }`}
      aria-label="Abrir carrinho"
    >
      <ShoppingCart className="h-7 w-7" aria-hidden="true" />
      <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border border-red-200 bg-white px-1 text-xs font-black text-red-600 shadow-md dark:border-red-900 dark:bg-slate-950 dark:text-red-300">
        {cartItemCount}
      </span>
    </button>
  );
}
