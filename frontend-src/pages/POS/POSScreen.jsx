import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Minus,
  MonitorPlay,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Utensils,
  WalletCards,
  X,
} from 'lucide-react';
import ERPLayout from '../../components/ERPLayout.jsx';
import {
  categories as fallbackCategories,
  formatCurrency,
  products as fallbackProducts,
} from '../../data/menuData.js';

const savedAdminKey = 'pizzaria-admin';

const paymentMethods = [
  { id: 'PIX', label: 'PIX', Icon: WalletCards },
  { id: 'CREDIT', label: 'Credito', Icon: CreditCard },
  { id: 'DEBIT', label: 'Debito', Icon: CreditCard },
  { id: 'CASH', label: 'Dinheiro', Icon: Banknote },
];

function getSavedAdminSession() {
  try {
    return JSON.parse(window.localStorage.getItem(savedAdminKey) ?? 'null');
  } catch (error) {
    
    return null;
  }
}

function normalizeProduct(product) {
  const variants = Array.isArray(product.variants)
    ? product.variants
        .filter((variant) => variant.isAvailable !== false)
        .map((variant) => ({
          ...variant,
          price: Number(variant.price ?? 0),
          sortOrder: Number(variant.sortOrder ?? 0),
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  const defaultVariant = variants[0] ?? null;

  return {
    id: product.productId ?? product.id,
    productId: product.productId ?? product.id,
    name: product.name,
    category: product.category ?? 'pizzas',
    price: Number(defaultVariant?.price ?? product.price ?? 0),
    variantId: defaultVariant?.id ?? null,
    variant: defaultVariant,
    variants,
    description: product.description ?? '',
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable ?? true,
  };
}

export default function POSScreen({ apiBaseUrl, products = [], categories = fallbackCategories }) {
  const [session] = useState(getSavedAdminSession);
  const [catalog, setCatalog] = useState(
    (products.length > 0 ? products : fallbackProducts).map(normalizeProduct),
  );
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('pizzas');
  const [tableName, setTableName] = useState('Balcao');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [cashOpening, setCashOpening] = useState('');
  const [shift, setShift] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.token ?? ''}`,
    }),
    [session?.token],
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart],
  );

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return catalog.filter((product) => {
      const matchesCategory = activeCategory === 'todos' || product.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.description, product.category].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(normalizedQuery),
        );

      return product.isAvailable && matchesCategory && matchesQuery;
    });
  }, [catalog, activeCategory, query]);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/produtos`);
      const data = await response.json().catch(() => []);

      if (response.ok && Array.isArray(data) && data.length > 0) {
        setCatalog(data.filter((product) => product.isAvailable).map(normalizeProduct));
      }
    } catch (error) {
      
      // Mantem produtos locais para o PDV continuar usavel em demo.
    }
  }, [apiBaseUrl]);

  const loadShift = useCallback(async () => {
    if (!session?.token) return;

    try {
      const response = await fetch(`${apiBaseUrl}/pos/shift/current`, {
        headers: authHeaders,
      });
      const data = await response.json().catch(() => null);

      if (response.ok) {
        setShift(data);
      }
    } catch (error) {
      
      // Caixa fechado ou API indisponivel nao impede montagem da tela.
    }
  }, [apiBaseUrl, authHeaders, session?.token]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadShift();
  }, [loadShift]);

  useEffect(() => {
    if (!message && !error) return undefined;
    const timeoutId = window.setTimeout(() => {
      setMessage('');
      setError('');
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [message, error]);

  function addToCart(product) {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.productId === product.productId);

      if (existing) {
        return currentCart.map((item) =>
          item.productId === product.productId ? { ...item, qty: item.qty + 1 } : item,
        );
      }

      return [...currentCart, { ...product, qty: 1 }];
    });
  }

  function updateQuantity(productId, delta) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.productId === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item,
        )
        .filter((item) => item.qty > 0),
    );
  }

  async function openShift() {
    setMessage('');
    setError('');

    if (!session?.token) {
      setError('Entre como administrador para abrir o caixa.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/pos/shift/open`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ openingCash: cashOpening || 0 }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Nao foi possivel abrir o caixa.');
      }

      setShift(data);
      setCashOpening('');
      setMessage('Caixa aberto.');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Nao foi possivel abrir o caixa.');
    } finally {
      setIsLoading(false);
    }
  }

  async function submitOrder() {
    setMessage('');
    setError('');

    if (!session?.token) {
      setError('Entre como administrador para finalizar venda.');
      return;
    }

    if (cart.length === 0) {
      setError('Adicione itens ao carrinho.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/pos/orders`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          tableName,
          paymentMethod,
          attendant: session?.admin?.name ?? 'Admin',
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            optionIds: item.optionIds,
            addonIds: item.addonIds,
            crustId: item.crustId,
            quantity: item.qty,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Nao foi possivel finalizar a venda.');
      }

      setCart([]);
      setIsCheckoutOpen(false);
      setMessage(`Pedido #${String(data.order?.id ?? '').slice(0, 8)} enviado para a cozinha.`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Nao foi possivel finalizar a venda.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ERPLayout activeTab="pdv">
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-emerald-300">Point of sale</p>
              <h2 className="mt-1 flex items-center gap-3 text-3xl font-black tracking-tight text-white">
                <MonitorPlay className="text-emerald-300" size={32} />
                PDV touch
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-400">
                Venda rapida por mesa, balcao ou retirada, com pedido integrado ao KDS.
              </p>
            </div>

            <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.06] p-3">
              {shift ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Caixa aberto</p>
                    <p className="text-xs font-bold uppercase text-slate-500">
                      {shift.admin?.name ?? 'Admin'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={cashOpening}
                    onChange={(event) => setCashOpening(event.target.value)}
                    className="h-10 min-w-0 rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 dark:text-slate-400 focus:border-emerald-300/70"
                    placeholder="Fundo inicial"
                  />
                  <button
                    type="button"
                    onClick={openShift}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-slate-950 dark:text-slate-50 transition hover:bg-emerald-300"
                  >
                    <Store size={17} />
                    Abrir caixa
                  </button>
                </div>
              )}
            </div>
          </div>

          {message || error ? (
            <div
              className={`rounded-lg border px-4 py-3 text-sm font-bold ${
                error
                  ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                  : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
              }`}
            >
              {error || message}
            </div>
          ) : null}

          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <label className="relative block">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={18}
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#101421] pl-10 pr-4 text-sm font-semibold text-white outline-none placeholder:text-slate-600 dark:text-slate-400 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15"
                  placeholder="Buscar produto"
                />
              </label>

              <div className="flex gap-2 overflow-x-auto">
                <CategoryButton
                  active={activeCategory === 'todos'}
                  onClick={() => setActiveCategory('todos')}
                  label="Todos"
                />
                {categories.map((category) => (
                  <CategoryButton
                    key={category.id}
                    active={activeCategory === category.id}
                    onClick={() => setActiveCategory(category.id)}
                    label={category.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <button
                key={product.productId}
                type="button"
                onClick={() => addToCart(product)}
                className="group flex min-h-52 flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] text-left shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-300/10 active:scale-[0.98]"
              >
                <div className="relative h-28 overflow-hidden bg-[#111722]">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-300/20 via-sky-300/10 to-emerald-300/20 text-orange-200">
                      <Utensils size={34} />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-black text-white backdrop-blur">
                    {formatCurrency(product.price)}
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-3 p-3">
                  <div>
                    <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
                      {product.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-slate-400">
                      {product.description || 'Produto pronto para lancar no pedido.'}
                    </p>
                  </div>
                  <span className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-400 text-sm font-black text-slate-950 dark:text-slate-50 transition group-hover:bg-emerald-300">
                    <Plus size={17} />
                    Adicionar
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <CartPanel
          cart={cart}
          tableName={tableName}
          setTableName={setTableName}
          cartTotal={cartTotal}
          onIncrement={(id) => updateQuantity(id, 1)}
          onDecrement={(id) => updateQuantity(id, -1)}
          onCheckout={() => setIsCheckoutOpen(true)}
        />

        {isCheckoutOpen ? (
          <CheckoutDrawer
            cart={cart}
            total={cartTotal}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            tableName={tableName}
            onClose={() => setIsCheckoutOpen(false)}
            onSubmit={submitOrder}
            isLoading={isLoading}
          />
        ) : null}
      </div>
    </ERPLayout>
  );
}

function CategoryButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 shrink-0 rounded-lg px-4 text-sm font-black transition ${
        active
          ? 'bg-emerald-400 text-slate-950 dark:text-slate-50 shadow-[0_0_18px_rgba(52,211,153,0.22)]'
          : 'border border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
      }`}
    >
      {label}
    </button>
  );
}

function CartPanel({
  cart,
  tableName,
  setTableName,
  cartTotal,
  onIncrement,
  onDecrement,
  onCheckout,
}) {
  return (
    <aside className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/25 backdrop-blur xl:sticky xl:top-28 xl:h-[calc(100vh-8rem)] xl:min-h-[620px]">
      <div className="border-b border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-white">
              <ShoppingCart size={21} className="text-emerald-300" />
              Comanda
            </h3>
            <p className="text-xs font-bold uppercase text-slate-500">
              {cart.length} itens distintos
            </p>
          </div>
          <ReceiptText className="text-slate-500" size={21} />
        </div>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-black uppercase text-slate-500">
            Mesa / origem
          </span>
          <input
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            className="h-11 w-full rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-black text-white outline-none placeholder:text-slate-600 dark:text-slate-400 focus:border-emerald-300/70"
          />
        </label>
      </div>

      <div className="flex max-h-[75vh] flex-col xl:h-[calc(100%-190px)] xl:max-h-none">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/10 text-center">
              <ShoppingCart size={42} className="mb-3 text-slate-700 dark:text-slate-300" />
              <p className="text-sm font-black uppercase text-slate-600 dark:text-slate-400">Comanda vazia</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.productId}
                className="rounded-lg border border-white/10 bg-[#101421] p-3"
              >
                <div className="flex gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Utensils size={22} className="text-orange-200" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-2 text-sm font-black leading-tight text-white">
                      {item.name}
                    </h4>
                    <p className="mt-1 text-sm font-black text-emerald-300">
                      {formatCurrency(item.price * item.qty)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.productId)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-sm font-black text-white">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.productId)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="text-xs font-bold uppercase text-slate-500">
                    {formatCurrency(item.price)} un.
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/10 bg-black/30 p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <span className="text-sm font-black uppercase text-slate-500">Total</span>
            <span className="break-words text-right text-2xl font-black text-white sm:text-3xl">
              {formatCurrency(cartTotal)}
            </span>
          </div>
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={onCheckout}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-base font-black text-slate-950 dark:text-slate-50 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CreditCard size={21} />
            Pagamento
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function CheckoutDrawer({
  cart,
  total,
  paymentMethod,
  setPaymentMethod,
  tableName,
  onClose,
  onSubmit,
  isLoading,
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar pagamento"
      />
      <section className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#090c14] shadow-2xl shadow-black">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-emerald-300">Checkout</p>
            <h3 className="truncate text-2xl font-black text-white">{tableName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs font-black uppercase text-slate-500">Resumo</p>
            <div className="mt-3 space-y-2">
              {cart.map((item) => (
                <div key={item.productId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-bold text-slate-300">
                    {item.qty}x {item.name}
                  </span>
                  <span className="font-black text-white">
                    {formatCurrency(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-black uppercase text-slate-500">Forma de pagamento</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {paymentMethods.map((method) => {
                const Icon = method.Icon;
                const active = paymentMethod === method.id;

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex h-20 flex-col items-center justify-center gap-2 rounded-lg border text-sm font-black transition ${
                      active
                        ? 'border-emerald-300 bg-emerald-300/15 text-emerald-100'
                        : 'border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    <Icon size={22} />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/30 p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <span className="text-sm font-black uppercase text-slate-500">Total a pagar</span>
            <span className="break-words text-right text-3xl font-black text-white sm:text-4xl">
              {formatCurrency(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-lg font-black text-slate-950 dark:text-slate-50 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <RefreshCw size={21} className="animate-spin" />
            ) : (
              <CheckCircle2 size={21} />
            )}
            Finalizar e enviar
          </button>
        </div>
      </section>
    </div>
  );
}
