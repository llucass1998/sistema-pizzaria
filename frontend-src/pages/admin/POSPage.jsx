import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  DollarSign,
  LogOut,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrency } from '../../data/menuData.js';
import {
  OpenShiftModal,
  CloseShiftModal,
  CashTransactionModal,
} from '../../components/admin/ShiftModals.jsx';
import { POSQuickPayModal } from '../../components/admin/POSQuickPayModal.jsx';
import { POSReceiptModal } from '../../components/admin/POSReceiptModal.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function POSPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');
  const { showSuccess, showError } = useToast();

  // Shift Management
  const [currentShift, setCurrentShift] = useState(null);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Busca (F1) e Modals de Pagamento/Cupom
  const [searchQuery, setSearchQuery] = useState('');
  const [isQuickPayModalOpen, setIsQuickPayModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState(null);

  const searchInputRef = useRef(null);
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);

  // Modal State for Product Options
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedCrust, setSelectedCrust] = useState('');

  // Authentication
  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminData = adminDataStr ? JSON.parse(adminDataStr) : null;
  const isShiftOpen = !!currentShift;

  useEffect(() => {
    async function fetchData() {
      try {
        const headers = { Authorization: `Bearer ${adminData?.token}` };

        // Fetch current shift
        const shiftRes = await fetch(`${API_BASE_URL}/admin/pos/shift/current`, { headers });
        if (shiftRes.ok) {
          const shiftData = await shiftRes.json();
          setCurrentShift(shiftData);
          if (!shiftData) setIsOpenShiftModalOpen(true);
        }
        setIsShiftLoading(false);

        const [catRes, prodRes] = await Promise.all([
          fetch(`${API_BASE_URL}/categorias?includeInactive=true`, { headers }),
          fetch(`${API_BASE_URL}/produtos`, { headers }),
        ]);

        if (!catRes.ok || !prodRes.ok) throw new Error('Erro ao carregar cardápio');

        const catData = await catRes.json();
        const prodData = await prodRes.json();

        const activeCats = Array.isArray(catData) ? catData.filter((c) => c.isActive) : [];
        setCategories(activeCats);
        if (activeCats.length > 0) setActiveCategory(activeCats[0].id);

        setProducts(Array.isArray(prodData) ? prodData.filter((p) => p.isAvailable) : []);
      } catch (err) {
        setError('Falha ao carregar cardápio. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Atalhos de teclado e leitor USB (Barcode Scanner)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInputFocused =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) ||
        e.target?.isContentEditable;

      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0 && window.confirm('Limpar carrinho e iniciar nova venda?')) {
          setCart([]);
          setCustomerInfo({ name: '', phone: '' });
        }
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (isInputFocused) return;
        setPaymentMethod('CASH');
        if (cart.length > 0) setIsQuickPayModalOpen(true);
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (isInputFocused) return;
        setPaymentMethod('PIX');
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        if (isInputFocused) return;
        setPaymentMethod('CREDIT_CARD');
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (isInputFocused) return;
        if (cart.length > 0) {
          if (paymentMethod === 'CASH') {
            setIsQuickPayModalOpen(true);
          } else {
            handleCheckout();
          }
        }
        return;
      }

      if (isInputFocused && e.target !== searchInputRef.current) return;

      const now = Date.now();
      if (now - lastKeyTime.current > 100) {
        barcodeBuffer.current = '';
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 3) {
        e.preventDefault();
        const scannedCode = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';

        let foundProduct = products.find((p) => p.barcode === scannedCode);
        let foundVariant = null;

        if (!foundProduct) {
          for (const p of products) {
            const v = p.variants?.find(
              (varItem) => varItem.code === scannedCode || varItem.name === scannedCode,
            );
            if (v) {
              foundProduct = p;
              foundVariant = v;
              break;
            }
          }
        }

        if (foundProduct) {
          if (
            foundProduct.calculatedAvailability &&
            !foundProduct.calculatedAvailability.available
          ) {
            showError(`Produto ${foundProduct.name} indisponivel pelo estoque.`);
            return;
          }
          if (foundVariant) {
            addToCart(foundProduct, foundVariant.id, [], null);
            showSuccess(`${foundProduct.name} (${foundVariant.name}) adicionado!`);
          } else if (foundProduct.variants?.length > 0 || foundProduct.allowSizes) {
            setSelectedProduct(foundProduct);
            setSelectedVariant(foundProduct.variants?.[0]?.id || '');
            setSelectedAddons([]);
            setSelectedCrust('');
            showSuccess(`Selecione o tamanho para ${foundProduct.name}`);
          } else {
            addToCart(foundProduct, null, [], null);
            showSuccess(`${foundProduct.name} adicionado!`);
          }
          if (e.target === searchInputRef.current) {
            setSearchQuery('');
          }
        } else {
          showError(`Código "${scannedCode}" não encontrado no catálogo.`);
        }
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart, paymentMethod, isSubmitting]);

  const displayedProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase() === q ||
          p.variants?.some((v) => v.name?.toLowerCase().includes(q) || v.code?.toLowerCase() === q)
      );
    } else if (activeCategory) {
      list = list.filter((p) => p.categoryId === activeCategory);
    }
    return list;
  }, [products, activeCategory, searchQuery]);

  const getProductDisplayPrice = (product) => {
    const firstVariant = product.variants?.[0];
    return Number(firstVariant?.price ?? product.price);
  };

  const handleProductClick = (product) => {
    if (product.calculatedAvailability && !product.calculatedAvailability.available) {
      showError(product.calculatedAvailability.reasons?.[0] || 'Produto indisponivel por estoque.');
      return;
    }

    if (product.variants?.length > 0 || product.allowSizes) {
      setSelectedProduct(product);
      setSelectedVariant(product.variants?.[0]?.id || '');
      setSelectedAddons([]);
      setSelectedCrust('');
    } else {
      addToCart(product, null, [], null);
    }
  };

  const addToCart = (product, variantId, addonIds, crustId) => {
    const selectedVariantData = variantId
      ? product.variants?.find((v) => v.id === variantId)
      : null;

    const addonArr = addonIds || [];
    const crustVal = crustId || null;

    const existingIndex = cart.findIndex(
      (item) =>
        item.productId === product.id &&
        item.variantId === (variantId || null) &&
        item.crustId === crustVal &&
        JSON.stringify((item.addonIds || []).slice().sort()) === JSON.stringify(addonArr.slice().sort())
    );

    if (existingIndex > -1) {
      setCart((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      const newItem = {
        cartId: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        variantId: variantId || null,
        addonIds: addonArr,
        crustId: crustVal,
        quantity: 1,
        price: Number(selectedVariantData?.price ?? product.price),
        variantName: selectedVariantData?.name ?? '',
      };
      setCart((prev) => [...prev, newItem]);
    }
    setSelectedProduct(null);
  };

  const updateQuantity = (cartId, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartId === cartId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }),
    );
  };

  const removeFromCart = (cartId) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const handleCheckout = async (quickPayData = {}) => {
    if (cart.length === 0) return;
    if (!isShiftOpen) {
      showError('Abra o caixa antes de finalizar vendas no PDV.');
      setIsOpenShiftModalOpen(true);
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        fulfillmentType: 'PICKUP',
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          optionIds: [...item.addonIds, item.crustId].filter(Boolean),
          notes: '',
        })),
        paymentMethod,
        notes: 'Pedido via Balcão',
      };

      const response = await fetch(`${API_BASE_URL}/admin/pos/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData?.token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao finalizar pedido');
      }

      const result = await response.json();
      const completedOrderData = {
        order: result.order || result,
        invoice: result.invoice,
        cartSnapshot: [...cart],
        cartTotal,
        paymentMethod,
        receivedAmount: quickPayData?.receivedAmount || cartTotal,
        changeAmount: quickPayData?.changeAmount || 0,
        date: new Date().toLocaleString('pt-BR'),
        storeName: adminData?.storeName || 'Pizzaria Rio',
      };
      setLastCompletedOrder(completedOrderData);
      setIsReceiptModalOpen(true);
      setIsQuickPayModalOpen(false);

      setCart([]);
      setCustomerInfo({ name: '', phone: '' });
      showSuccess('Pedido gerado com sucesso! Já foi enviado para a cozinha.');
      const shiftRes = await fetch(`${API_BASE_URL}/admin/pos/shift/current`, {
        headers: { Authorization: `Bearer ${adminData?.token}` },
      });
      if (shiftRes.ok) setCurrentShift(await shiftRes.json());
    } catch (err) {
      showError(err.message || 'Erro ao gerar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-full flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Esquerda: Cardápio */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200 dark:border-slate-800">
        {/* Barra de Busca (F1) e Categorias */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-white dark:bg-slate-950 shadow-sm shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nome ou código (F1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 pl-10 text-sm font-medium text-slate-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-red-500 font-bold"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
                  activeCategory === cat.id && !searchQuery
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Produtos */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayedProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-60">
              <Package size={48} className="mb-4 text-slate-400" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                Nenhum produto cadastrado nesta categoria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayedProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  disabled={
                    product.calculatedAvailability && !product.calculatedAvailability.available
                  }
                  className="flex flex-col bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-red-500 dark:hover:border-red-500 transition hover:shadow-lg text-left group disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-24 object-cover rounded-xl mb-3"
                    />
                  ) : (
                    <div className="w-full h-24 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 flex items-center justify-center">
                      <span className="text-slate-400 text-xs">Sem foto</span>
                    </div>
                  )}
                  <span className="font-bold text-slate-800 dark:text-slate-100 truncate w-full text-sm">
                    {product.name}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-black mt-1 text-sm">
                    {formatCurrency(getProductDisplayPrice(product))}
                  </span>
                  {product.calculatedAvailability ? (
                    <span
                      className={`mt-1 line-clamp-2 text-xs font-bold ${
                        product.calculatedAvailability.available
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {product.calculatedAvailability.available
                        ? product.calculatedAvailability.diagnostics?.some(
                            (item) => item.code === 'NO_RECIPE',
                          )
                          ? 'Sem ficha tecnica'
                          : 'Estoque OK'
                        : (product.calculatedAvailability.reasons?.[0] ?? 'Sem estoque')}
                    </span>
                  ) : null}
                  <div className="mt-2 text-xs text-slate-500 flex justify-between w-full opacity-0 group-hover:opacity-100 transition">
                    <span>Adicionar +</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Direita: Carrinho */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-950 flex flex-col shrink-0 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] z-10">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
              <ShoppingCart size={20} className="text-red-600" />
              Carrinho PDV
            </h2>
          </div>

          {isShiftOpen && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsTransactionModalOpen(true)}
                className="flex-1 px-2 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                Sangria / Suprimento
              </button>
              <button
                onClick={() => setIsCloseShiftModalOpen(true)}
                className="flex-1 px-2 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-md hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400 transition"
              >
                Fechar Caixa
              </button>
            </div>
          )}
          {!isShiftOpen && !isShiftLoading && (
            <button
              type="button"
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-black text-white transition hover:bg-red-700"
            >
              Abrir caixa para vender
            </button>
          )}
          {isShiftOpen && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              Caixa aberto: {currentShift.cashRegister?.name || 'Caixa'} | Gaveta esperada:{' '}
              {formatCurrency(currentShift.summary?.expectedClosingCash || 0)}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cart.map((item) => (
                <div
                  key={item.cartId}
                  className="flex gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {item.name}
                    </span>
                    {item.variantName && (
                      <span className="text-xs text-slate-500">Tamanho: {item.variantName}</span>
                    )}
                    <span className="text-red-600 font-black text-sm mt-1">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700 mt-2">
                      <button
                        onClick={() => updateQuantity(item.cartId, -1)}
                        className="p-1 text-slate-600 dark:text-slate-400 hover:text-red-600"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-4 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.cartId, 1)}
                        className="p-1 text-slate-600 dark:text-slate-400 hover:text-green-600"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
          {error && (
            <div className="mb-3 p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between items-end mb-4">
            <span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Total</span>
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {formatCurrency(cartTotal)}
            </span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            {[
              ['CASH', 'Dinheiro (F3)'],
              ['PIX', 'PIX (F4)'],
              ['DEBIT_CARD', 'Debito'],
              ['CREDIT_CARD', 'Credito (F6)'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPaymentMethod(value);
                  if (value === 'CASH' && cart.length > 0) setIsQuickPayModalOpen(true);
                }}
                className={`h-10 rounded-lg border text-sm font-black transition ${
                  paymentMethod === value
                    ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (paymentMethod === 'CASH') {
                setIsQuickPayModalOpen(true);
              } else {
                handleCheckout();
              }
            }}
            disabled={cart.length === 0 || isSubmitting || !isShiftOpen}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-black py-4 rounded-xl text-lg transition flex items-center justify-center gap-2 shadow-lg hover:shadow-green-600/20 active:scale-[0.98]"
          >
            {isSubmitting ? 'Processando...' : paymentMethod === 'CASH' ? 'Troco / Finalizar (F9)' : 'Finalizar Pedido (F9)'}
          </button>
        </div>
      </div>

      {/* Modal Simples de Variações */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-lg">Opções: {selectedProduct.name}</h3>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {selectedProduct.variants?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase">
                    Selecione o Tamanho
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v.id)}
                        className={`p-3 rounded-xl border-2 text-left transition ${selectedVariant === v.id ? 'border-red-600 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        <div className="font-bold">{v.name}</div>
                        <div className="text-red-600 text-sm font-black mt-1">
                          {formatCurrency(v.price)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  addToCart(selectedProduct, selectedVariant, selectedAddons, selectedCrust)
                }
                disabled={selectedProduct.variants?.length > 0 && !selectedVariant}
                className="flex-1 py-3 font-black text-white bg-red-600 rounded-xl disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onOpen={(shift) => {
          setCurrentShift(shift);
          setIsOpenShiftModalOpen(false);
        }}
        adminData={adminData}
      />
      <CloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        currentShift={currentShift}
        adminData={adminData}
        onClosed={(shift) => {
          setCurrentShift(null);
          setIsCloseShiftModalOpen(false);
          showSuccess(
            `Caixa fechado. Diferenca: ${formatCurrency(shift.summary?.difference || 0)}`,
          );
        }}
      />
      <CashTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        currentShift={currentShift}
        adminData={adminData}
        onTransaction={async () => {
          const shiftRes = await fetch(`${API_BASE_URL}/admin/pos/shift/current`, {
            headers: { Authorization: `Bearer ${adminData?.token}` },
          });
          if (shiftRes.ok) setCurrentShift(await shiftRes.json());
          showSuccess('Movimentacao registrada.');
        }}
      />

      {/* Rodapé de Atalhos (não sai na impressão) */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-slate-900 text-slate-300 text-xs px-4 py-1.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 z-20 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold"><strong className="text-red-500">F1</strong> Buscar</span>
          <span className="font-bold"><strong className="text-red-500">F2</strong> Nova Venda</span>
          <span className="font-bold"><strong className="text-red-500">F3</strong> Dinheiro</span>
          <span className="font-bold"><strong className="text-red-500">F4</strong> PIX</span>
          <span className="font-bold"><strong className="text-red-500">F6</strong> Cartão</span>
          <span className="font-bold"><strong className="text-red-500">F9</strong> Finalizar</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>* Bipagem rápida via leitor USB ativa automaticamente</span>
        </div>
      </div>

      <POSQuickPayModal
        isOpen={isQuickPayModalOpen}
        onClose={() => setIsQuickPayModalOpen(false)}
        cartTotal={cartTotal}
        onConfirmPay={(quickPayData) => handleCheckout(quickPayData)}
      />

      <POSReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        orderData={lastCompletedOrder}
      />
    </div>
  );
}
