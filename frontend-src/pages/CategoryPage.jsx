import { ArrowLeft, ShoppingCart, Star } from 'lucide-react';
import { ProductSkeleton } from '../components/ui/ProductSkeleton.jsx';
import {
  categories as fallbackCategories,
  formatCurrency,
  getCategory,
  getProductsByCategory,
} from '../data/menuData.js';

function getRemoteImage(item) {
  const image = item?.imageUrl || item?.image;
  return typeof image === 'string' && image.startsWith('http') ? image : '';
}

function getDisplayPrice(product) {
  return Number(product?.variants?.[0]?.price ?? product?.price ?? 0);
}

function getAvailabilityMessage(product) {
  const availability = product?.calculatedAvailability;
  if (!availability) return '';
  if (!availability.available) {
    return availability.reasons?.[0] || 'Produto indisponivel por estoque.';
  }
  if (availability.diagnostics?.some((diagnostic) => diagnostic.code === 'NO_RECIPE')) {
    return 'Vendavel sem ficha tecnica';
  }
  return 'Disponivel por estoque';
}

function isUnavailableByStock(product) {
  return Boolean(product?.calculatedAvailability && !product.calculatedAvailability.available);
}

function ProductVisual({ product }) {
  return (
    <div className="flex w-full shrink-0 items-center justify-center pt-6 pb-2">
      <div className="relative flex h-[160px] w-[160px] items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-md ring-4 ring-slate-50 dark:ring-slate-800/50 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-6xl transition duration-300 group-hover:scale-110">
            {product.image}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CategoryPage({
  categoryId,
  categories = fallbackCategories,
  isLoading,
  onAddToCart,
  products: catalogProducts,
}) {
  const category =
    categories.find((item) => item.id === categoryId || item.slug === categoryId) ??
    getCategory(categoryId);
  const products =
    catalogProducts?.filter(
      (product) =>
        product.category === categoryId ||
        product.category === category?.slug ||
        product.category === category?.id,
    ) ?? getProductsByCategory(categoryId);
  const categoryImageUrl =
    getRemoteImage(category) || products.find((product) => product.imageUrl)?.imageUrl;

  if (!category) {
    window.location.hash = '/';
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-7xl overflow-x-clip px-3 py-5 text-slate-950 dark:text-slate-100 sm:px-4 sm:py-8">
      <a
        href="#/"
        className="back-to-menu-button mb-6 inline-flex h-11 max-w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 font-black text-slate-800 shadow-sm transition-all duration-200 ease-out hover:scale-[1.02] hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-95 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-300 dark:hover:text-amber-200"
      >
        <ArrowLeft className="h-5 w-5" />
        Voltar ao cardápio
      </a>

      <section className="mb-8 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-emerald-950/5 dark:border-white/10 dark:bg-slate-950 dark:shadow-black/30">
        <div className="grid md:grid-cols-[280px_1fr]">
          <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800 sm:min-h-[260px]">
            {categoryImageUrl ? (
              <img
                src={categoryImageUrl}
                alt={category.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-8xl">{category.image}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/90 to-transparent md:hidden" />
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-8">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-200">
              <Star className="h-4 w-4" />
              {products.length || 0} itens
            </div>
            <h1 className="text-3xl font-black leading-tight text-slate-950 dark:text-white sm:text-5xl">
              {category.name}
            </h1>
            {category.description ? (
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-700 dark:text-slate-300">
                {category.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 sm:gap-6 justify-items-center">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, index) => <ProductSkeleton key={`sk-${index}`} />)
        ) : products.length === 0 ? (
          <div className="col-span-full w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white p-8 text-center font-bold text-slate-700 dark:border-white/15 dark:bg-slate-900/80 dark:text-slate-300">
            Nenhum produto disponivel nesta categoria.
          </div>
        ) : (
          products.map((product) =>
            (() => {
              const unavailable = isUnavailableByStock(product);
              const availabilityMessage = getAvailabilityMessage(product);

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => !unavailable && onAddToCart?.(product)}
                  disabled={unavailable}
                  className={`group flex w-full max-w-[280px] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 ${
                    unavailable
                      ? 'cursor-not-allowed opacity-70'
                      : 'hover:-translate-y-1 hover:border-red-300 hover:shadow-xl active:scale-[0.99] dark:hover:border-red-900/50'
                  }`}
                  aria-label={
                    unavailable
                      ? `${product.name} indisponivel`
                      : `Adicionar ${product.name} ao carrinho`
                  }
                >
                  <ProductVisual product={product} />
                  <div className="flex flex-1 flex-col items-center p-5">
                    <div className="mb-4 flex-1 w-full">
                      <h3 className="text-lg font-black leading-snug text-slate-950 dark:text-white line-clamp-2">
                        {product.name}
                      </h3>
                      {product.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          {product.description}
                        </p>
                      ) : null}
                      {availabilityMessage ? (
                        <p
                          className={`mt-3 rounded-lg px-3 py-2 text-xs font-black ${
                            unavailable
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                          }`}
                        >
                          {availabilityMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-auto flex w-full flex-col items-center gap-3">
                      <span className="text-xl font-black leading-none text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(getDisplayPrice(product))}
                      </span>
                      <span
                        className={`inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 font-bold text-white transition-all duration-200 ease-out dark:bg-slate-800 ${
                          unavailable ? 'bg-slate-500' : 'bg-slate-900 group-hover:bg-red-600'
                        }`}
                      >
                        <ShoppingCart className="h-4 w-4 shrink-0" />
                        <span>{unavailable ? 'Indisponivel' : 'Adicionar'}</span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })(),
          )
        )}
      </section>
    </main>
  );
}
