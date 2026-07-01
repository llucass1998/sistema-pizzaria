import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Mostrar após rolar 300px
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!isVisible) {
    return null;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Voltar ao topo"
      className="fixed bottom-24 right-4 md:bottom-28 md:right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg shadow-black/20 transition-all duration-300 hover:scale-105 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-slate-700 dark:hover:bg-slate-600 dark:shadow-black/50"
    >
      <ChevronUp className="h-6 w-6" />
    </button>
  );
}
