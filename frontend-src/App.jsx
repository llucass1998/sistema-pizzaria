import { useEffect, useMemo, useState } from 'react';
import { LogOut, LogIn, Moon, ShoppingCart, Sun, User, X } from 'lucide-react';
import AccountPage from './pages/AccountPage.jsx';
import CategoryPage from './pages/CategoryPage.jsx';
import HomePage from './pages/HomePage.jsx';
import { LoginPage } from './pages/admin/LoginPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import { AdminLayout } from './pages/admin/AdminLayout.jsx';
import { DashboardPage } from './pages/admin/DashboardPage.jsx';
import { OrdersPage } from './pages/admin/OrdersPage.jsx';
import { ProductsPage } from './pages/admin/ProductsPage.jsx';
import { CategoriesPage } from './pages/admin/CategoriesPage.jsx';
import { OptionsPage } from './pages/admin/OptionsPage.jsx';
import { CRMPage } from './pages/admin/CRMPage.jsx';
import { CouponsPage } from './pages/admin/CouponsPage.jsx';
import { SettingsPage } from './pages/admin/SettingsPage.jsx';
import { InventoryPage } from './pages/admin/InventoryPage.jsx';
import { RecipesPage } from './pages/admin/RecipesPage.jsx';
import { AdminsPage } from './pages/admin/AdminsPage.jsx';
import { POSPage } from './pages/admin/POSPage.jsx';
import { DispatchPage } from './pages/admin/DispatchPage.jsx';
import { KDSPage } from './pages/admin/KDSPage.jsx';
import MockPaymentPage from './pages/MockPaymentPage.jsx';
import OrderStatusPage from './pages/OrderStatusPage.jsx';
import Purchases from './pages/ERP/Purchases.jsx';
import Quotes from './pages/ERP/Quotes.jsx';
import AccountsReceivable from './pages/ERP/AccountsReceivable.jsx';
import OnboardingPage from './pages/SaaS/OnboardingPage.jsx';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthModal } from './components/AuthModal.jsx';
import { BottomNav } from './components/ui/BottomNav.jsx';
import { CartDrawer } from './components/ui/CartDrawer.jsx';
import { FloatingCartButton } from './components/ui/FloatingCartButton.jsx';
import { PublicFooter } from './components/public/PublicFooter.jsx';
import { FloatingWhatsApp } from './components/public/FloatingWhatsApp.jsx';
import { BackToTopButton } from './components/ui/BackToTopButton.jsx';
import { useCartStore } from './store/useCartStore.js';
import pizzariaLogo from './assets/rio-pizzas-logo.png';
import {
  categories as fallbackCategories,
  formatCurrency,
  getStoreFromSettings,
  products,
  store,
} from './data/menuData.js';
import {
  DEFAULT_NAVBAR_COLOR,
  applyVisualIdentity,
  getContrastTextColor,
  isDarkHexColor,
  normalizeHexColor,
} from './utils/visualIdentity.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');
const savedCustomerKey = 'pizzaria-customer';
const savedThemeKey = 'pizzaria-theme';
const savedCartKey = 'pizzaria-cart';
const addonOptions = [
  {
    id: 'borda-catupiry',
    name: 'Borda recheada de catupiry',
    price: 6,
  },
  {
    id: 'extra-cheese',
    name: 'Queijo extra',
    price: 4,
  },
];

function getAddonTotal(addons) {
  return addons.reduce((total, addon) => total + addon.price, 0);
}

function getCartItemId(product, addons, variant, halfAndHalf) {
  const productId = product.productId ?? product.id;
  const variantKey = variant?.id ?? 'sem-tamanho';
  const halfKey = halfAndHalf?.secondProductId
    ? `${halfAndHalf.secondProductId}-${halfAndHalf.secondVariantId ?? 'sem-tamanho'}`
    : 'inteira';
  const addonKey =
    addons
      .map((addon) => addon.id)
      .sort()
      .join('-') || 'sem-adicional';
  return `${productId}__${variantKey}__${halfKey}__${addonKey}`;
}

function getCustomizationText({ variant, addons, halfAndHalf }) {
  return [
    halfAndHalf?.secondProductName
      ? `Meia-meia: ${halfAndHalf.firstProductName} / ${halfAndHalf.secondProductName}`
      : '',
    variant?.name ? `Tamanho: ${variant.name}` : '',
    ...addons.map((addon) => `${addon.name} (+${formatCurrency(addon.price)})`),
  ]
    .filter(Boolean)
    .join(', ');
}

function normalizeCatalogCategory(category) {
  return {
    ...category,
    id: category.id,
    slug: category.slug ?? category.id,
    name: category.name,
    description: category.description ?? '',
    icon: category.icon ?? category.image ?? '',
    image: category.icon ?? category.image ?? category.imageUrl ?? '',
    imageUrl: category.imageUrl ?? '',
    sortOrder: Number(category.sortOrder ?? 0),
    isActive: category.isActive ?? true,
    allowSizes: Boolean(category.allowSizes),
    allowHalfAndHalf: Boolean(category.allowHalfAndHalf),
    halfAndHalfGroup: category.halfAndHalfGroup ?? '',
  };
}

function normalizeCatalogProduct(product) {
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

  return {
    id: product.id,
    productId: product.productId ?? product.id,
    name: product.name,
    categoryId: product.categoryId ?? null,
    category: product.category ?? 'pizzas',
    categoryName: product.categoryName ?? product.category ?? '',
    description: product.description ?? '',
    price: Number(product.price ?? 0),
    image: product.image ?? '🍕',
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable ?? true,
    variants,
    optionGroups: Array.isArray(product.optionGroups) ? product.optionGroups : [],
    allowSizes: Boolean(product.allowSizes || variants.length > 0),
    allowHalfAndHalf: Boolean(product.allowHalfAndHalf),
    halfAndHalfGroup: product.halfAndHalfGroup ?? '',
  };
}

function findMatchingVariant(product, selectedVariant) {
  if (!product || !selectedVariant) return null;

  return (
    product.variants?.find((variant) => variant.code && variant.code === selectedVariant.code) ??
    product.variants?.find((variant) => variant.name === selectedVariant.name) ??
    null
  );
}

const routes = {
  '/': { Component: HomePage },
  '/conta': { Component: AccountPage },
  '/pizzas': { Component: CategoryPage, categoryId: 'pizzas' },
  '/pizzas-especiais': { Component: CategoryPage, categoryId: 'especiais' },
  '/promocoes': { Component: CategoryPage, categoryId: 'promocoes' },
  '/bebidas': { Component: CategoryPage, categoryId: 'bebidas' },
  '/sobremesas': { Component: CategoryPage, categoryId: 'sobremesas' },
  '/combos': { Component: CategoryPage, categoryId: 'combos' },
  '/checkout': { Component: CheckoutPage },
  '/mock-payment': { Component: MockPaymentPage },
};

function getRoute(path) {
  if (path.startsWith('/order/')) return { Component: OrderStatusPage };
  return routes[path];
}

function getHashPath() {
  const path = window.location.hash.replace('#', '');
  return path || '/';
}

function getInitialDarkMode() {
  const savedTheme = window.localStorage.getItem(savedThemeKey);

  if (savedTheme) {
    return savedTheme === 'dark';
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function getSavedCartItems() {
  try {
    const savedCart = JSON.parse(window.localStorage.getItem(savedCartKey) ?? '[]');

    if (!Array.isArray(savedCart)) {
      return [];
    }

    return savedCart
      .map((item) => ({
        ...item,
        price: Number(item.price ?? 0),
        basePrice: Number(item.basePrice ?? item.price ?? 0),
        qty: Math.max(1, Number(item.qty ?? 1)),
      }))
      .filter((item) => item.id && item.name && Number.isFinite(item.price));
  } catch {
    return [];
  }
}

export default function PizzariaApp() {
  const [path, setPath] = useState(getHashPath);
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);

  // -- Tenant States
  const [tenant, setTenant] = useState(null);
  const [isResolvingTenant, setIsResolvingTenant] = useState(true);
  const [tenantResolveError, setTenantResolveError] = useState(null);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState(() => {
    const savedCustomer = window.localStorage.getItem(savedCustomerKey);
    return savedCustomer ? JSON.parse(savedCustomer) : null;
  });
  const cartItems = useCartStore((state) => state.items);
  const cartSetItems = useCartStore((state) => state.setItems);
  const cartAddItem = useCartStore((state) => state.addItem);
  const cartUpdateItemQuantity = useCartStore((state) => state.updateItemQuantity);
  const cartRemoveItem = useCartStore((state) => state.removeItem);
  const cartClear = useCartStore((state) => state.clearCart);
  const cartTotal = useCartStore((state) => state.getSubtotal());
  const cartItemCount = useMemo(
    () => cartItems.reduce((total, item) => total + Math.max(1, Number(item.qty ?? 1)), 0),
    [cartItems],
  );

  const isCartOpen = useCartStore((state) => state.isCartOpen);
  const openCart = useCartStore((state) => state.openCart);
  const closeCart = useCartStore((state) => state.closeCart);
  const toggleCart = useCartStore((state) => state.toggleCart);

  const [catalogProducts, setCatalogProducts] = useState(products.map(normalizeCatalogProduct));
  const [catalogCategories, setCatalogCategories] = useState(
    fallbackCategories.map(normalizeCatalogCategory),
  );
  const [storeSettings, setStoreSettings] = useState(null);
  const [productToCustomize, setProductToCustomize] = useState(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [isHalfAndHalf, setIsHalfAndHalf] = useState(false);
  const [selectedHalfProductId, setSelectedHalfProductId] = useState('');

  const currentStore = useMemo(() => getStoreFromSettings(storeSettings ?? store), [storeSettings]);
  const navbarColor = normalizeHexColor(currentStore.navbarColor, DEFAULT_NAVBAR_COLOR);
  const navbarTextColor = getContrastTextColor(navbarColor);
  const isNavbarDark = isDarkHexColor(navbarColor);
  const navOverlayClass = isNavbarDark
    ? 'bg-white/10 hover:bg-white/20'
    : 'bg-black/10 hover:bg-black/[0.14]';
  const navLogoSrc = currentStore.logoUrl || pizzariaLogo;
  const toggleDarkMode = () => setIsDarkMode((current) => !current);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    window.localStorage.setItem(savedThemeKey, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    applyVisualIdentity(currentStore);
  }, [currentStore]);

  useEffect(() => {
    const hasSavedCart = Boolean(window.localStorage.getItem(savedCartKey));
    const isLegacyDemoCart =
      !hasSavedCart &&
      cartItems.length === 2 &&
      cartItems.every((item) => ['Pizza Margherita', 'Coca-Cola lata 350ml'].includes(item.name));

    if (isLegacyDemoCart) {
      cartClear();
      return;
    }
  }, [cartItems]);

  useEffect(() => {
    async function resolveTenant() {
      try {
        setTenantResolveError(null);
        const host = window.location.hostname;
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('tenant') || '';

        const res = await fetch(
          `${API_BASE_URL}/public/resolve-store?host=${encodeURIComponent(host)}&slug=${encodeURIComponent(slug)}`,
        );
        if (!res.ok) {
          if (res.status === 404) {
            setTenantResolveError({
              type: 'not-found',
              title: 'Loja não encontrada',
              message: 'Verifique o endereço ou URL acessada.',
            });
          } else {
            setTenantResolveError({
              type: 'server',
              title: 'Servidor temporariamente indisponível',
              message: 'Tente novamente em instantes.',
            });
          }
          return;
        }

        const data = await res.json();
        setTenant(data);
        setStoreSettings(data);

        // Patch global fetch to ALWAYS inject x-tenant-id
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          const [resource, config] = args;
          const newConfig = config || {};
          newConfig.headers = {
            ...newConfig.headers,
            'x-tenant-id': data.id,
          };
          return originalFetch(resource, newConfig);
        };

        // Apply some visuals from tenant immediately
        if (data.storeName) {
          document.title = data.storeName;
        }
      } catch (err) {
        console.error('Error resolving tenant:', err);
        setTenantResolveError({
          type: 'network',
          title: 'Não foi possível conectar ao servidor',
          message: 'Confira sua conexão e tente novamente.',
        });
      } finally {
        setIsResolvingTenant(false);
      }
    }

    resolveTenant();
  }, []);

  useEffect(() => {
    function handleHashChange() {
      setPath(getHashPath());
      setIsAccountMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isResolvingTenant || !tenant) return;
    let isMounted = true;

    async function loadCatalogData() {
      try {
        const [categoryResponse, productResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/categorias`),
          fetch(`${API_BASE_URL}/pizzas`),
        ]);
        const categoryData = await categoryResponse.json().catch(() => []);
        const productData = await productResponse.json().catch(() => []);

        if (
          isMounted &&
          categoryResponse.ok &&
          Array.isArray(categoryData) &&
          categoryData.length > 0
        ) {
          setCatalogCategories(
            categoryData
              .filter((category) => category.isActive !== false)
              .map(normalizeCatalogCategory)
              .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
          );
        }

        if (
          isMounted &&
          productResponse.ok &&
          Array.isArray(productData) &&
          productData.length > 0
        ) {
          setCatalogProducts(
            productData
              .filter((product) => product.isAvailable)
              .map((product) => ({
                id: product.id,
                productId: product.id,
                name: product.name,
                category: product.category ?? 'pizzas',
                categoryId: product.categoryId ?? null,
                categoryName: product.categoryName ?? product.category ?? '',
                description: product.description ?? '',
                price: Number(product.price ?? 0),
                image: '🍕',
                imageUrl: product.imageUrl,
                variants: Array.isArray(product.variants)
                  ? product.variants
                      .filter((variant) => variant.isAvailable !== false)
                      .map((variant) => ({
                        ...variant,
                        price: Number(variant.price ?? 0),
                        sortOrder: Number(variant.sortOrder ?? 0),
                      }))
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                  : [],
                optionGroups: Array.isArray(product.optionGroups) ? product.optionGroups : [],
                allowSizes: Boolean(
                  product.allowSizes ||
                  (Array.isArray(product.variants) && product.variants.length > 0),
                ),
                allowHalfAndHalf: Boolean(product.allowHalfAndHalf),
                halfAndHalfGroup: product.halfAndHalfGroup ?? '',
              })),
          );
        }
      } catch {
        // Mantem o cardapio local quando a API ainda nao estiver aberta.
      }
    }

    loadCatalogData();

    return () => {
      isMounted = false;
    };
  }, [isResolvingTenant, tenant]);

  useEffect(() => {
    if (isResolvingTenant || !tenant) return;
    let isMounted = true;

    async function loadStoreSettings() {
      try {
        const response = await fetch(`${API_BASE_URL}/configuracoes`);
        const data = await response.json().catch(() => null);

        if (isMounted && response.ok && data) {
          setStoreSettings(data);
        }
      } catch {
        // Mantem os dados padrao quando a API ainda nao estiver aberta.
      }
    }

    loadStoreSettings();

    return () => {
      isMounted = false;
    };
  }, [isResolvingTenant, tenant]);

  const selectedAddons = useMemo(() => {
    const allOptions = [...addonOptions];
    if (productToCustomize?.optionGroups) {
      for (const group of productToCustomize.optionGroups) {
        if (group.options) {
          allOptions.push(...group.options);
        }
      }
    }
    return allOptions.filter((opt) => selectedAddonIds.includes(opt.id));
  }, [selectedAddonIds, productToCustomize]);
  const selectedVariant = useMemo(
    () => productToCustomize?.variants?.find((variant) => variant.id === selectedVariantId) ?? null,
    [productToCustomize, selectedVariantId],
  );
  const halfAndHalfCandidates = useMemo(() => {
    if (!productToCustomize?.allowHalfAndHalf || !selectedVariant) return [];

    const group = productToCustomize.halfAndHalfGroup || productToCustomize.category;
    return catalogProducts.filter((product) => {
      if (
        (product.productId ?? product.id) ===
        (productToCustomize.productId ?? productToCustomize.id)
      ) {
        return false;
      }

      const sameGroup = (product.halfAndHalfGroup || product.category) === group;
      return (
        product.allowHalfAndHalf &&
        sameGroup &&
        Boolean(findMatchingVariant(product, selectedVariant))
      );
    });
  }, [catalogProducts, productToCustomize, selectedVariant]);
  const selectedHalfProduct = useMemo(
    () =>
      halfAndHalfCandidates.find(
        (product) => (product.productId ?? product.id) === selectedHalfProductId,
      ) ??
      halfAndHalfCandidates[0] ??
      null,
    [halfAndHalfCandidates, selectedHalfProductId],
  );
  const selectedHalfVariant = useMemo(
    () => findMatchingVariant(selectedHalfProduct, selectedVariant),
    [selectedHalfProduct, selectedVariant],
  );
  const halfAndHalfData =
    isHalfAndHalf && selectedHalfProduct && selectedHalfVariant
      ? {
          firstProductId: productToCustomize?.productId ?? productToCustomize?.id,
          firstProductName: productToCustomize?.name,
          firstVariantId: selectedVariant?.id ?? null,
          firstVariantName: selectedVariant?.name ?? '',
          secondProductId: selectedHalfProduct.productId ?? selectedHalfProduct.id,
          secondProductName: selectedHalfProduct.name,
          secondVariantId: selectedHalfVariant.id,
          secondVariantName: selectedHalfVariant.name,
          priceRule: 'HIGHER_HALF_PRICE',
        }
      : null;
  const customizationBasePrice = halfAndHalfData
    ? Math.max(
        Number(selectedVariant?.price ?? productToCustomize?.price ?? 0),
        Number(selectedHalfVariant?.price ?? 0),
      )
    : Number(selectedVariant?.price ?? productToCustomize?.price ?? 0);
  const customizationTotal = customizationBasePrice + getAddonTotal(selectedAddons);

  const isAdminRoute = path.startsWith('/admin');
  const isSaasRoute = path.startsWith('/saas');
  const route = isAdminRoute || isSaasRoute ? { hideNav: true } : (getRoute(path) ?? routes['/']);
  const Page = route.Component;
  const isLoggedIn = Boolean(currentCustomer);

  function openAuthModal(mode = 'login') {
    setAuthMode(mode);
    setAuthError('');
    setShowLoginModal(true);
  }

  async function submitAuthRequest(pathname, body) {
    const response = await fetch(`${API_BASE_URL}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message ?? 'Nao foi possivel concluir a operacao.');
    }

    return data;
  }

  function finishAuth(customer) {
    setCurrentCustomer(customer);
    window.localStorage.setItem(savedCustomerKey, JSON.stringify(customer));
    setShowLoginModal(false);
    setIsAccountMenuOpen(false);
    setAuthError('');
    setEmail('');
    setPassword('');
  }

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setIsAuthLoading(true);
      setAuthError('');
      const result = await submitAuthRequest('/login', { email, password });

      if (result.role === 'ADMIN') {
        // Salva a sessao do administrador e redireciona
        window.localStorage.setItem(
          'pizzaria-admin',
          JSON.stringify({ admin: result.admin, token: result.token }),
        );
        setShowLoginModal(false);
        setIsAccountMenuOpen(false);
        setAuthError('');
        setEmail('');
        setPassword('');
        window.location.hash = '/admin';
      } else {
        finishAuth(result);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Erro ao entrar.');
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    try {
      setIsAuthLoading(true);
      setAuthError('');
      const customer = await submitAuthRequest('/register', {
        name: registerName,
        email,
        password,
      });

      finishAuth(customer);
      setRegisterName('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Erro ao cadastrar.');
    } finally {
      setIsAuthLoading(false);
    }
  }

  function handleLogout() {
    setCurrentCustomer(null);
    window.localStorage.removeItem(savedCustomerKey);
    setIsAccountMenuOpen(false);

    if (getHashPath() === '/conta') {
      window.location.hash = '/';
    }
  }

  function addToCart(product) {
    if (product?.calculatedAvailability && !product.calculatedAvailability.available) {
      window.alert(
        product.calculatedAvailability.reasons?.[0] || 'Produto indisponivel por estoque.',
      );
      return;
    }

    setProductToCustomize(product);
    setSelectedAddonIds([]);
    setSelectedVariantId(product.variants?.[0]?.id ?? '');
    setIsHalfAndHalf(false);
    setSelectedHalfProductId('');
  }

  function toggleAddon(addonId, group) {
    if (group && group.maxChoices === 1) {
      setSelectedAddonIds((currentIds) => {
        // Remove all options from this group first
        const groupOptionIds = group.options.map((opt) => opt.id);
        const filtered = currentIds.filter((id) => !groupOptionIds.includes(id));
        return [...filtered, addonId];
      });
      return;
    }
    setSelectedAddonIds((currentIds) =>
      currentIds.includes(addonId)
        ? currentIds.filter((id) => id !== addonId)
        : [...currentIds, addonId],
    );
  }

  function closeCustomizationModal() {
    setProductToCustomize(null);
    setSelectedAddonIds([]);
    setSelectedVariantId('');
    setIsHalfAndHalf(false);
    setSelectedHalfProductId('');
  }

  function confirmAddToCart() {
    if (!productToCustomize) {
      return;
    }

    if (productToCustomize.variants?.length > 0 && !selectedVariant) {
      return;
    }

    if (isHalfAndHalf && !halfAndHalfData) {
      return;
    }

    const itemId = getCartItemId(
      productToCustomize,
      selectedAddons,
      selectedVariant,
      halfAndHalfData,
    );
    const customizations = getCustomizationText({
      variant: selectedVariant,
      addons: selectedAddons,
      halfAndHalf: halfAndHalfData,
    });
    const itemName = halfAndHalfData
      ? `Meia-meia: ${halfAndHalfData.firstProductName} / ${halfAndHalfData.secondProductName}`
      : productToCustomize.name;

    cartAddItem({
      id: itemId,
      productId: productToCustomize.productId ?? productToCustomize.id,
      name: itemName,
      basePrice: customizationBasePrice,
      price: customizationTotal,
      qty: 1,
      category: productToCustomize.category,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? '',
      halfAndHalf: halfAndHalfData,
      image: productToCustomize.image,
      imageUrl: productToCustomize.imageUrl,
      addons: selectedAddons,
      customizations,
    });

    closeCustomizationModal();
  }

  function updateCartItemQuantity(itemId, nextQuantity) {
    cartUpdateItemQuantity(itemId, nextQuantity);
  }

  function removeCartItem(itemId) {
    cartRemoveItem(itemId);
  }

  function handleOrderCreated(order) {
    cartClear();
    window.localStorage.removeItem(savedCartKey);

    if (!currentCustomer) {
      return;
    }

    const updatedCustomer = {
      ...currentCustomer,
      orders: [order, ...(currentCustomer.orders ?? [])],
    };

    setCurrentCustomer(updatedCustomer);
    window.localStorage.setItem(savedCustomerKey, JSON.stringify(updatedCustomer));
  }

  if (isResolvingTenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center animate-pulse">
          <div className="h-16 w-16 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Carregando loja...</p>
        </div>
      </div>
    );
  }

  if (!tenant && !isResolvingTenant) {
    const errorContent = tenantResolveError || {
      type: 'not-found',
      title: 'Loja não encontrada',
      message: 'O link que você acessou não corresponde a nenhuma loja ativa.',
    };

    if (isSaasRoute) {
      // Deixa prosseguir para renderizar a rota /saas
    } else {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-center p-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {errorContent.title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">{errorContent.message}</p>
            {errorContent.type === 'not-found' ? (
              <p className="mt-6">
                <a
                  href="#/saas/onboarding"
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  Quero criar minha loja (SaaS)
                </a>
              </p>
            ) : null}
          </div>
        </div>
      );
    }
  }

  const isMaintenance = tenant?.isMaintenance === true;

  if (isMaintenance && !isAdminRoute && !isSaasRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-center p-4">
        <div className="max-w-md w-full">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800">
            <svg
              className="w-10 h-10 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              ></path>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              ></path>
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-4">
            Loja em manutenção
          </h1>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
            {tenant?.maintenanceMessage ||
              'Voltamos em breve! Estamos realizando melhorias na loja.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-slate-50 pb-[env(safe-area-inset-bottom)] transition-colors duration-200 dark:bg-slate-950">
        {!route.hideNav && (
          <header
            className="transition-colors duration-200"
            style={{
              backgroundColor: navbarColor,
              borderBottom: `1px solid ${isNavbarDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              color: navbarTextColor,
            }}
          >
            <div className="relative mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-2 px-3 py-2 md:min-h-[96px] md:px-4 md:py-2">
              <a
                href="#/"
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:gap-4"
              >
                <img
                  src={navLogoSrc}
                  alt="Rio de Janeiro Pizzas"
                  className={`site-logo h-[56px] w-[56px] shrink-0 rounded-full object-contain transition-all duration-200 ease-out group-hover:scale-105 md:h-[80px] md:w-[80px] ${isNavbarDark ? 'bg-white/10' : 'bg-white/80'}`}
                />
                <div className="min-w-0 truncate text-sm font-extrabold uppercase leading-tight tracking-wide sm:text-base md:text-xl">
                  {currentStore.name}
                </div>
              </a>

              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                <button
                  onClick={toggleDarkMode}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current active:scale-95 md:h-11 md:w-11 ${navOverlayClass}`}
                  style={{ color: navbarTextColor }}
                  title={isDarkMode ? 'Usar cores' : 'Usar escuro'}
                  type="button"
                  aria-label={isDarkMode ? 'Usar cores' : 'Usar escuro'}
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={toggleCart}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current active:scale-95 md:h-11 md:w-11 ${navOverlayClass}`}
                    style={{ color: navbarTextColor }}
                    title="Ver carrinho"
                    aria-label="Ver carrinho"
                  >
                    <ShoppingCart size={20} />
                    {cartItemCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                        {cartItemCount}
                      </span>
                    )}
                  </button>
                </div>

                {isLoggedIn ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsAccountMenuOpen((current) => !current)}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current active:scale-95 md:h-11 md:w-11 ${navOverlayClass}`}
                      style={{ color: navbarTextColor }}
                      aria-expanded={isAccountMenuOpen}
                      aria-label="Abrir perfil"
                      title="Abrir perfil"
                    >
                      <User size={20} />
                    </button>

                    {isAccountMenuOpen && (
                      <div className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:top-14">
                        <a
                          href="#/conta"
                          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-950"
                        >
                          <User size={16} />
                          Ver conta
                        </a>
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                          type="button"
                        >
                          <LogOut size={16} />
                          Sair
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => openAuthModal('login')}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current active:scale-95 md:h-11 md:w-11 ${navOverlayClass}`}
                    style={{ color: navbarTextColor }}
                    aria-label="Entrar na conta"
                    title="Entrar na conta"
                  >
                    <User size={20} />
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {isAdminRoute || isSaasRoute ? (
          <HashRouter>
            <Routes>
              <Route path="/saas/onboarding" element={<OnboardingPage />} />
              <Route
                path="/admin/login"
                element={<LoginPage isDarkMode={isDarkMode} onToggleTheme={toggleDarkMode} />}
              />
              <Route path="/mock-payment" element={<MockPaymentPage />} />
              <Route
                path="/admin"
                element={<AdminLayout isDarkMode={isDarkMode} onToggleTheme={toggleDarkMode} />}
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="options" element={<OptionsPage />} />
                <Route path="crm" element={<CRMPage />} />
                <Route path="coupons" element={<CouponsPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="recipes" element={<RecipesPage />} />
                <Route path="users" element={<AdminsPage />} />
                <Route path="pos" element={<POSPage />} />
                <Route path="kds" element={<KDSPage />} />
                <Route path="dispatch" element={<DispatchPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="quotes" element={<Quotes />} />
                <Route path="receivables" element={<AccountsReceivable />} />
              </Route>
            </Routes>
          </HashRouter>
        ) : (
          <Page
            categoryId={route?.categoryId}
            isLoggedIn={isLoggedIn}
            customer={currentCustomer}
            apiBaseUrl={API_BASE_URL}
            store={currentStore}
            storeSettings={storeSettings}
            products={catalogProducts}
            categories={catalogCategories}
            cartItems={cartItems}
            cartTotal={cartTotal}
            onAddToCart={addToCart}
            onLoginClick={() => openAuthModal('login')}
            onLogout={handleLogout}
            onUpdateCartItemQuantity={updateCartItemQuantity}
            onRemoveCartItem={removeCartItem}
            onOrderCreated={handleOrderCreated}
            onStoreSettingsChange={setStoreSettings}
          />
        )}

        <CartDrawer
          isOpen={isCartOpen}
          onClose={closeCart}
          cartItems={cartItems}
          cartTotal={cartTotal}
          onUpdateCartItemQuantity={updateCartItemQuantity}
          onRemoveCartItem={removeCartItem}
          store={currentStore}
        />

        {productToCustomize && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4">
            <section className="w-full max-w-md flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
              <div className="flex items-start gap-4 border-b border-slate-100 p-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-950 text-4xl">
                  {productToCustomize.imageUrl ? (
                    <img
                      src={productToCustomize.imageUrl}
                      alt={productToCustomize.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{productToCustomize.image}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {productToCustomize.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Escolha tamanho, meia-meia e adicionais antes de colocar no carrinho.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCustomizationModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all duration-200 ease-out hover:scale-105 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  aria-label="Fechar adicionais"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 p-4 flex-1 overflow-y-auto">
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span>Preço base</span>
                    <div className="h-px flex-1 border-t border-dashed border-slate-300 dark:border-slate-700"></div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(customizationBasePrice)}
                    </span>
                  </div>
                </div>

                {productToCustomize.variants?.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <h3 className="mb-2 text-sm font-black text-slate-900 dark:text-white">
                      Tamanho
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {productToCustomize.variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => {
                            setSelectedVariantId(variant.id);
                            setSelectedHalfProductId('');
                          }}
                          className={`rounded-lg border-2 p-3 text-left transition ${
                            selectedVariantId === variant.id
                              ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-red-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          <span className="block text-sm font-black">{variant.name}</span>
                          <span className="mt-1 block text-xs font-bold">
                            {formatCurrency(variant.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {productToCustomize.allowHalfAndHalf && productToCustomize.variants?.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <label className="flex cursor-pointer items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm font-black text-slate-900 dark:text-white">
                          Montar meia-meia
                        </span>
                        <span className="block text-xs font-semibold text-slate-500">
                          Cobra o maior valor entre as duas metades.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={isHalfAndHalf}
                        onChange={(event) => {
                          setIsHalfAndHalf(event.target.checked);
                          setSelectedHalfProductId('');
                        }}
                        className="h-5 w-5 accent-red-600"
                      />
                    </label>

                    {isHalfAndHalf && (
                      <div className="mt-3">
                        {halfAndHalfCandidates.length === 0 ? (
                          <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            Não há outro sabor compatível neste tamanho.
                          </p>
                        ) : (
                          <select
                            value={selectedHalfProduct?.productId ?? selectedHalfProduct?.id ?? ''}
                            onChange={(event) => setSelectedHalfProductId(event.target.value)}
                            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          >
                            {halfAndHalfCandidates.map((product) => {
                              const halfVariant = findMatchingVariant(product, selectedVariant);
                              return (
                                <option
                                  key={product.productId ?? product.id}
                                  value={product.productId ?? product.id}
                                >
                                  {product.name} -{' '}
                                  {formatCurrency(halfVariant?.price ?? product.price)}
                                </option>
                              );
                            })}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {productToCustomize?.category !== 'bebidas' &&
                productToCustomize?.optionGroups &&
                productToCustomize.optionGroups.length > 0
                  ? productToCustomize.optionGroups.map((group) => (
                      <div key={group.id} className="mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">
                          {group.name}
                        </h3>
                        <div className="space-y-2">
                          {group.options?.map((addon) => (
                            <label
                              key={addon.id}
                              className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border-2 border-slate-100 bg-white p-3 transition-all duration-200 ease-out hover:scale-[1.01] hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-950"
                            >
                              <span className="flex items-center gap-3">
                                <input
                                  type={group.maxChoices === 1 ? 'radio' : 'checkbox'}
                                  name={`group_${group.id}`}
                                  checked={selectedAddonIds.includes(addon.id)}
                                  onChange={() => toggleAddon(addon.id, group)}
                                  className="h-4 w-4 accent-red-600"
                                />
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {addon.name}
                                </span>
                              </span>
                              <span className="font-black text-red-600">
                                + {formatCurrency(addon.price)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  : productToCustomize.category === 'pizzas' ||
                      productToCustomize.category === 'pizzas-especiais'
                    ? addonOptions.map((addon) => (
                        <label
                          key={addon.id}
                          className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border-2 border-slate-100 bg-white p-3 transition-all duration-200 ease-out hover:scale-[1.01] hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-950"
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedAddonIds.includes(addon.id)}
                              onChange={() => toggleAddon(addon.id)}
                              className="h-4 w-4 accent-red-600"
                            />
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {addon.name}
                            </span>
                          </span>
                          <span className="font-black text-red-600">
                            + {formatCurrency(addon.price)}
                          </span>
                        </label>
                      ))
                    : null}

                <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-lg font-black text-slate-900 dark:text-slate-100">
                  <span>Total do item</span>
                  <span className="text-red-600">{formatCurrency(customizationTotal)}</span>
                </div>

                <button
                  type="button"
                  onClick={confirmAddToCart}
                  disabled={
                    (productToCustomize.variants?.length > 0 && !selectedVariant) ||
                    (isHalfAndHalf && !halfAndHalfData)
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 py-3 font-black text-white transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart size={20} />
                  Adicionar ao carrinho
                </button>
              </div>
            </section>
          </div>
        )}

        <AuthModal
          isOpen={showLoginModal}
          authMode={authMode}
          email={email}
          password={password}
          registerName={registerName}
          authError={authError}
          isAuthLoading={isAuthLoading}
          onClose={() => setShowLoginModal(false)}
          onModeChange={(nextMode) => {
            setAuthMode(nextMode);
            setAuthError('');
          }}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onRegisterNameChange={setRegisterName}
          onSubmit={authMode === 'login' ? handleLogin : handleRegister}
        />

        <FloatingCartButton
          cartItemCount={cartItemCount}
          isCartOpen={isCartOpen}
          currentPath={path}
          onCartClick={openCart}
        />

        {!route.hideNav && (
          <BottomNav
            cartItemCount={cartItemCount}
            currentPath={path}
            isCartOpen={isCartOpen}
            onCartClick={openCart}
          />
        )}

        {!route.hideNav && <PublicFooter store={currentStore} navbarColor={navbarColor} />}
        {!route.hideNav && <FloatingWhatsApp store={currentStore} />}
        {!route.hideNav && <BackToTopButton />}
      </div>
    </div>
  );
}
