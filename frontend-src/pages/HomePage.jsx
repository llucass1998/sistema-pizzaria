import { useState, useEffect } from 'react';
import { Flame, MapPin, Phone, ShoppingCart, Sparkles, Star, Timer } from 'lucide-react';
import { ProductSkeleton } from '../components/ui/ProductSkeleton.jsx';
import {
  categories as fallbackCategories,
  formatCurrency,
  getMapsLink,
  getWhatsappLink,
  formatPhoneBR,
  formatItemCount,
  products as fallbackProducts,
  store as defaultStore,
} from '../data/menuData.js';
import rioPizzasLogo from '../assets/rio-pizzas-logo.png';

function getRemoteImage(item) {
  const image = item?.imageUrl || item?.image;
  return typeof image === 'string' && image.startsWith('http') ? image : '';
}

function getCategoryProducts(products, category) {
  return products.filter(
    (product) =>
      product.category === category.slug ||
      product.category === category.id ||
      product.categoryId === category.id,
  );
}

function getCategoryImage(category, products) {
  return (
    getRemoteImage(category) ||
    products.find(
      (product) =>
        product.imageUrl &&
        (product.category === category.slug ||
          product.category === category.id ||
          product.categoryId === category.id),
    )?.imageUrl ||
    ''
  );
}

function getCategorySectionId(category) {
  const slug = String(category.slug || category.id || category.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `category-${slug || category.id}`;
}

function getDisplayPrice(product) {
  return Number(product?.variants?.[0]?.price ?? product?.price ?? 0);
}

function getBestSeller(products, featuredProductId) {
  if (featuredProductId) {
    const featured = products.find((product) => product.id === featuredProductId || product.productId === featuredProductId);
    if (featured) return featured;
  }
  const preferredNames = ['Pizza Calabresa', 'Pizza Margherita', 'Combo Pizza + Refrigerante'];
  const preferredProduct = preferredNames
    .map((name) =>
      products.find((product) =>
        String(product.name ?? '')
          .toLowerCase()
          .includes(name.toLowerCase()),
      ),
    )
    .find(Boolean);

  return (
    preferredProduct ?? products.find((product) => product.category !== 'bebidas') ?? products[0]
  );
}

function CategoryMark({ category, imageUrl, className = 'h-9 w-9 text-lg' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-slate-800 ${className}`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden="true">{category.icon || category.image || '🍽️'}</span>
      )}
    </span>
  );
}

function ProductVisual({ product, compact = false }) {
  if (compact) {
    return (
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800 w-full h-20 min-[390px]:h-24 sm:h-44 lg:h-full lg:min-h-[360px]">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <span className="transition duration-300 group-hover:scale-110 text-4xl min-[390px]:text-5xl sm:text-7xl">
            {product.image}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-16 sm:h-20 pointer-events-none bg-gradient-to-t from-slate-950/30 to-transparent" />
      </div>
    );
  }

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

export default function HomePage({
  products = fallbackProducts,
  categories = fallbackCategories,
  store = defaultStore,
  storeSettings,
  isLoading,
  onAddToCart,
}) {
  const mapsLink = getMapsLink(store);
  const whatsappLink = getWhatsappLink(store);
  const featuredProductId = storeSettings?.featuredProductId ?? store?.featuredProductId;
  const bestSeller = getBestSeller(products, featuredProductId);
  const logoUrl = store.logoUrl || storeSettings?.logoUrl || rioPizzasLogo;
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -60% 0px' }
    );

    const sections = document.querySelectorAll('[id^="category-"]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, [categories]);

  const rawMenuSections = categories
    .filter((category) => category.isActive !== false)
    .map((category) => ({
      category,
      sectionId: getCategorySectionId(category),
      imageUrl: getCategoryImage(category, products),
      products: getCategoryProducts(products, category),
    }))
    .filter(section => section.products.length > 0); // Hide empty categories

  // Promotions first
  const menuSections = [
    ...rawMenuSections.filter(s => s.category.slug === 'promocoes'),
    ...rawMenuSections.filter(s => s.category.slug !== 'promocoes')
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-3 pb-8 pt-4 text-slate-950 dark:text-slate-100 sm:px-4 sm:py-8">
      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-emerald-950/5 dark:border-white/10 dark:bg-slate-950 dark:shadow-black/30 sm:mb-8">
        <div className={`grid ${bestSeller ? 'lg:grid-cols-[1.05fr_0.95fr]' : 'grid-cols-1'}`}>
          <div className="flex flex-col justify-center p-4 sm:p-8 lg:p-10">
            <div className="mb-4 flex items-center gap-3 sm:mb-5 sm:gap-4">
              <div className="min-w-0">
                {store.isOpen !== false ? (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 sm:text-sm">
                    <span className="w-2 h-2 shrink-0 animate-pulse rounded-full bg-emerald-500"></span>
                    <span className="truncate">Aberto para pedidos</span>
                  </div>
                ) : (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-black text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 sm:text-sm">
                    <span className="w-2 h-2 shrink-0 rounded-full bg-red-500"></span>
                    <span className="truncate">Fechado no momento</span>
                  </div>
                )}
                <p className="mt-2 text-sm font-black uppercase text-slate-700 dark:text-slate-300 sm:text-base">
                  Delivery de pizza no Rio
                </p>
              </div>
            </div>
            <h1 className="max-w-3xl text-[2rem] font-black leading-[1.08] text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              {store.name ?? 'Pizzaria'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-700 dark:text-slate-300 sm:mt-4 sm:text-lg sm:leading-7">
              {store.description ?? "Pizzas artesanais, massa leve e recheio caprichado. Escolha a sua favorita e peça em poucos cliques."}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:mt-6 sm:flex sm:flex-wrap">
              <span className="inline-flex min-h-10 w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 sm:w-auto">
                <Timer className="h-4 w-4 shrink-0 text-amber-300" />
                {store.hours}
              </span>
              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 w-full max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-emerald-300/60 dark:hover:text-emerald-200 sm:w-auto"
              >
                <MapPin className="h-4 w-4 shrink-0 text-emerald-300" />
                <span className="truncate">{store.address}</span>
              </a>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 transition hover:border-amber-500 hover:text-amber-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-amber-300/60 dark:hover:text-amber-200 sm:w-auto"
              >
                <Phone className="h-4 w-4 shrink-0 text-amber-300" />
                {formatPhoneBR(store.phone)}
              </a>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap">
              <a
                href="#menu"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 text-lg font-black text-white shadow-sm transition-all duration-200 ease-out hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 sm:w-auto"
              >
                <ShoppingCart className="h-5 w-5" />
                Fazer pedido
              </a>
            </div>
          </div>

          {bestSeller && (
            <div className="relative border-t border-slate-200 bg-slate-950 dark:border-white/10 lg:min-h-[360px] lg:border-l lg:border-t-0">
              <button
                type="button"
                onClick={() => onAddToCart?.(bestSeller)}
                className="group flex h-full w-full flex-col text-left transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.99]"
                aria-label={`Adicionar ${bestSeller.name} ao carrinho`}
              >
                <ProductVisual product={bestSeller} compact />
                <div className="bg-white/95 p-4 sm:p-6 lg:absolute lg:inset-x-4 lg:bottom-4 lg:rounded-xl lg:bg-white/90 lg:shadow-[0_8px_30px_rgb(0,0,0,0.12)] lg:backdrop-blur-md">
                  <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white shadow-sm sm:mb-3">
                    <Flame className="h-4 w-4 shrink-0" />
                    Mais pedido da noite
                  </div>
                  <h2 className="max-w-md text-xl font-black leading-tight text-slate-950 sm:text-2xl md:text-3xl">
                    {bestSeller.name}
                  </h2>
                  <div className="mt-4 grid grid-cols-1 gap-3 min-[380px]:flex min-[380px]:items-center min-[380px]:justify-between">
                    <span className="text-xl font-black text-emerald-700 sm:text-2xl">
                      {formatCurrency(getDisplayPrice(bestSeller))}
                    </span>
                    <span className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white shadow-sm transition-all duration-200 ease-out group-hover:scale-[1.02] group-hover:bg-red-700 min-[380px]:w-auto sm:text-base">
                      <ShoppingCart className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                      Pedir
                    </span>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </section>

      <section id="menu" className="mb-8 scroll-mt-24 sm:mb-12 mt-8 md:mt-12">
        <div className="sticky top-0 z-40 -mx-3 mb-6 max-w-[calc(100%+1.5rem)] border-y border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/95 sm:mx-0 sm:mb-8 sm:rounded-lg sm:border sm:px-4 sm:py-3">
          <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex w-max max-w-none gap-2 pr-3">
            {menuSections.map(({ category, imageUrl, sectionId }) => {

              return (
                <a
                  key={category.id}
                  href={`#${sectionId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`inline-flex h-11 min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-sm font-black shadow-sm transition-all duration-200 ease-out hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 sm:h-12 sm:min-w-0 sm:pr-4 ${
                    activeCategory === sectionId
                      ? 'border-red-600 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-950 dark:hover:text-red-400'
                  }`}
                >
                  <CategoryMark
                    category={category}
                    imageUrl={imageUrl}
                    className="h-8 w-8 text-base"
                  />
                  <span className="whitespace-nowrap">{category.name}</span>
                </a>
              );
            })}
            </div>
          </div>
        </div>

        <div className="space-y-8 sm:space-y-12">
          {menuSections.map(({ category, imageUrl, products: categoryProducts, sectionId }) => (
            <div key={category.id} id={sectionId} className="scroll-mt-[150px]">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-3">
                  <CategoryMark
                    category={category}
                    imageUrl={imageUrl}
                    className="h-12 w-12 text-2xl"
                  />
                  <div>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-slate-50 dark:text-white sm:text-3xl">
                      {category.name}
                    </h3>
                    {category.description ? (
                      <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-400">
                        {category.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <Star className="h-4 w-4 text-slate-400" />
                  {isLoading ? '...' : formatItemCount(categoryProducts.length)}
                </span>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 sm:gap-6 justify-items-center">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <ProductSkeleton key={`sk-${category.id}-${index}`} />
                    ))
                  : categoryProducts.length === 0 ? (
                      <div className="col-span-full w-full rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        Nenhum produto disponivel nesta categoria.
                      </div>
                    )
                  : categoryProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => onAddToCart?.(product)}
                        className="group flex w-full max-w-[280px] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-red-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-900/50"
                        aria-label={`Adicionar ${product.name} ao carrinho`}
                      >
                        <ProductVisual product={product} />
                        <div className="flex flex-1 flex-col items-center p-5">
                          <div className="mb-4 flex-1 w-full">
                            <h4 className="text-lg font-black leading-snug text-slate-950 dark:text-white line-clamp-2">
                              {product.name}
                            </h4>
                            {product.description ? (
                              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                {product.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="mt-auto flex w-full flex-col items-center gap-3">
                            <span className="text-xl font-black leading-none text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(getDisplayPrice(product))}
                            </span>
                            <span className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 font-bold text-white transition-all duration-200 ease-out group-hover:bg-red-600 dark:bg-slate-800">
                              <ShoppingCart className="h-4 w-4 shrink-0" />
                              <span>Adicionar</span>
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
