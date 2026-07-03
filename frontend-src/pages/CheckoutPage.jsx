import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Copy,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  Receipt,
  Trash2,
  Truck,
  ShoppingCart,
  Check,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider.jsx';
import { useEffect, useMemo, useState } from 'react';
import { store as defaultStore } from '../data/menuData.js';
import {
  calculateCheckoutSummary,
  cleanPhone,
  formatCurrencySafe,
  formatPhoneBR,
  isValidPhoneBR,
  safeNumber,
} from '../utils/checkout.js';
import {
  buildPixPayload,
  createPixQrCodeDataUrl,
  isPixKeyConfigured as hasConfiguredPixKey,
} from '../utils/pix.js';

const defaultDeliveryFee = 5;
const defaultServiceFee = 2;
const paymentMethods = [
  {
    id: 'PIX',
    label: 'PIX',
    description: 'QR Code e copia e cola',
    Icon: QrCode,
  },
  {
    id: 'CASH',
    label: 'Dinheiro',
    description: 'Pagamento na hora',
    Icon: Banknote,
  },
  {
    id: 'DEBIT_CARD',
    label: 'Débito',
    description: 'Cartão de débito',
    Icon: CreditCard,
  },
  {
    id: 'CREDIT_CARD',
    label: 'Crédito',
    description: 'Cartão de crédito',
    Icon: CreditCard,
  },
];

const cardPaymentModes = [
  {
    id: 'ONLINE',
    label: 'Cartão online',
    description: 'Enviar link de pagamento',
  },
  {
    id: 'ON_DELIVERY',
    label: 'Pagar na hora',
    description: 'Maquininha na entrega ou retirada',
  },
];

const deliveryTrackingSteps = [
  {
    key: 'PENDING',
    title: 'Pedido feito',
    description: 'Recebemos o pedido e ele entrou na fila da cozinha.',
    Icon: Receipt,
  },
  {
    key: 'PREPARING',
    title: 'Pagamento confirmado',
    description: 'Pagamento registrado para o pedido.',
    Icon: CreditCard,
  },
  {
    key: 'OUT_FOR_DELIVERY',
    title: 'Pedido enviado',
    description: 'O pedido já está a caminho do endereço informado.',
    Icon: Truck,
  },
  {
    key: 'DELIVERED',
    title: 'Pedido entregue',
    description: 'Pedido finalizado e entregue ao cliente.',
    Icon: CheckCircle2,
  },
];

const pickupTrackingSteps = [
  {
    key: 'PENDING',
    title: 'Pedido feito',
    description: 'Recebemos o pedido e ele entrou na fila da cozinha.',
    Icon: Receipt,
  },
  {
    key: 'PREPARING',
    title: 'Pagamento confirmado',
    description: 'Pagamento registrado para o pedido.',
    Icon: CreditCard,
  },
  {
    key: 'READY',
    title: 'Pronto para retirada',
    description: 'O pedido esta pronto para ser retirado na loja.',
    Icon: PackageCheck,
  },
  {
    key: 'DELIVERED',
    title: 'Pedido retirado',
    description: 'Pedido finalizado e entregue ao cliente no balcao.',
    Icon: CheckCircle2,
  },
];

function getFulfillmentLabel(fulfillmentType) {
  return fulfillmentType === 'PICKUP' ? 'Retirada na loja' : 'Entrega / envio';
}

function getTrackingSteps(fulfillmentType) {
  return fulfillmentType === 'PICKUP' ? pickupTrackingSteps : deliveryTrackingSteps;
}

function parseCurrencyInput(value) {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace('.', '')
    .replace(',', '.');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function getPaymentMethodLabel(paymentMethod) {
  return paymentMethods.find((method) => method.id === paymentMethod)?.label ?? paymentMethod;
}

function getPaymentSummary(paymentMethod, cardPaymentMode, cashChangeFor) {
  if (paymentMethod === 'PIX') {
    return 'PIX via QR Code';
  }

  if (paymentMethod === 'CASH') {
    return cashChangeFor.trim()
      ? `Dinheiro - troco para ${formatCurrencySafe(parseCurrencyInput(cashChangeFor) ?? 0)}`
      : 'Dinheiro - sem troco informado';
  }

  const methodLabel = getPaymentMethodLabel(paymentMethod);
  const modeLabel =
    cardPaymentMode === 'ONLINE'
      ? 'cartao online por link de pagamento'
      : 'pagar na hora com maquininha';

  return `${methodLabel} - ${modeLabel}`;
}

function getOrderDisplayNumber(order) {
  const numericId = String(order?.id ?? '').replace(/\D/g, '');

  if (numericId) {
    return numericId.slice(-4);
  }

  return String(order?.id ?? '')
    .slice(0, 8)
    .toUpperCase();
}

function normalizeOrder(order, fallbackItems, fallbackTotal) {
  const createdAt = order?.createdAt ?? new Date().toISOString();
  const items =
    order?.items?.map((item) => ({
      id: item.id,
      name: item.displayName ?? item.product?.name ?? item.name ?? 'Item do pedido',
      image: item.product?.image ?? item.image ?? '',
      imageUrl: item.imageUrl ?? item.product?.imageUrl ?? null,
      customizations: item.customizations ?? '',
      quantity: item.quantity,
      total: safeNumber(item.total),
    })) ??
    fallbackItems.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.image,
      imageUrl: item.imageUrl,
      customizations: item.customizations ?? '',
      quantity: item.qty,
      total: safeNumber(item.price) * safeNumber(item.qty),
    }));

  return {
    id: order?.id ?? `PED-${Date.now()}`,
    status: order?.status ?? 'PREPARING',
    fulfillmentType: order?.fulfillmentType ?? 'DELIVERY',
    total: safeNumber(order?.total, fallbackTotal),
    createdAt,
    items,
    pixQrCode: order?.pixQrCode,
    pixQrCodeBase64: order?.pixQrCodeBase64,
    paymentUrl: order?.paymentUrl,
    paymentStatus: order?.paymentStatus || 'PENDING',
    paymentMethod: order?.paymentMethod,
  };
}

export default function CartPage({
  apiBaseUrl,
  cartItems,
  cartTotal,
  customer,
  isLoggedIn,
  onLoginClick,
  onLogout,
  onRemoveCartItem,
  onUpdateCartItemQuantity,
  onOrderCreated,
  store = defaultStore,
  storeSettings,
}) {
  const { showSuccess, showError, showInfo } = useToast();
  const [activeTab, setActiveTab] = useState('CART');
  const [lastOrder, setLastOrder] = useState(null);
  const [fulfillmentType, setFulfillmentType] = useState('DELIVERY');
  const [customerName, setCustomerName] = useState(customer?.name ?? '');
  const [customerWhatsApp, setCustomerWhatsApp] = useState(formatPhoneBR(customer?.phone ?? ''));
  const [street, setStreet] = useState(customer?.street ?? '');
  const [number, setNumber] = useState('');
  const [zipCode, setZipCode] = useState(customer?.zipCode ?? '');
  const [neighborhood, setNeighborhood] = useState(customer?.neighborhood ?? '');
  const [complement, setComplement] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [cardPaymentMode, setCardPaymentMode] = useState('ON_DELIVERY');
  const [cashChangeFor, setCashChangeFor] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [pixQrCodeDataUrl, setPixQrCodeDataUrl] = useState('');
  const [pixQrCodeError, setPixQrCodeError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [useLoyaltyBalance, setUseLoyaltyBalance] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [deliveryFeeResult, setDeliveryFeeResult] = useState({
    fee: safeNumber(store?.deliveryFee, defaultDeliveryFee),
    available: true,
    message: '',
  });

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(customer?.token ? { Authorization: `Bearer ${customer.token}` } : {}),
    }),
    [customer?.token],
  );

  async function handleZipCodeBlur() {
    const cep = zipCode.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro);
          setNeighborhood(data.bairro);
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      }
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    if (!customer?.token) {
      setCouponError('Entre para validar cupom ou finalize sem cupom.');
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError('');
    try {
      const response = await fetch(`${apiBaseUrl}/carrinho/validate-coupon`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ code: couponCode, cartTotal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Cupom inválido');
      setAppliedCoupon(data);
      setCouponError('');
      showSuccess('Cupom aplicado com sucesso.');
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Cupom invalido ou expirado.');
      setAppliedCoupon(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  useEffect(() => {
    setCustomerName(customer?.name ?? '');
    setCustomerWhatsApp(formatPhoneBR(customer?.phone ?? ''));
    setStreet(customer?.street ?? '');
    setZipCode(customer?.zipCode ?? '');
    setNeighborhood(customer?.neighborhood ?? '');
  }, [customer]);

  useEffect(() => {
    if (!customer?.id) return;
    const timer = setTimeout(() => {
      fetch(`${apiBaseUrl}/carrinho/sync`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ items: cartItems, total: cartTotal }),
      }).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cartItems, cartTotal, customer?.id, apiBaseUrl, authHeaders]);

  useEffect(() => {
    if (fulfillmentType !== 'DELIVERY') return;

    let isActive = true;
    async function checkFee() {
      try {
        const res = await fetch(`${apiBaseUrl}/checkout/calculate-delivery-fee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            neighborhood,
            subtotal: cartTotal,
            distanceKm: null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (isActive) {
            setDeliveryFeeResult({
              fee: data.deliveryFee,
              available: data.available,
              message: data.message,
            });
          }
        }
      } catch (err) {
        console.error('Failed to calc delivery fee:', err);
      }
    }

    const timeout = setTimeout(checkFee, 500);
    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [neighborhood, cartTotal, fulfillmentType, apiBaseUrl]);

  const hasItems = cartItems.length > 0;
  const cartSubtotal = safeNumber(cartTotal);
  const configuredServiceFee = hasItems ? safeNumber(store?.serviceFee, defaultServiceFee) : 0;
  const rawDeliveryFeeAmount =
    fulfillmentType === 'DELIVERY' && hasItems ? safeNumber(deliveryFeeResult.fee) : 0;
  const {
    checkoutTotal,
    couponDiscountAmount,
    loyaltyDiscountAmount,
    deliveryFeeAmount,
  } = useMemo(
    () =>
      calculateCheckoutSummary({
        subtotal: cartSubtotal,
        serviceFee: configuredServiceFee,
        deliveryFee: rawDeliveryFeeAmount,
        coupon: appliedCoupon,
        loyaltyBalance: customer?.loyaltyBalance,
        useLoyaltyBalance,
      }),
    [
      cartSubtotal,
      configuredServiceFee,
      rawDeliveryFeeAmount,
      appliedCoupon,
      useLoyaltyBalance,
      customer?.loyaltyBalance,
    ],
  );
  const isCardPayment = paymentMethod === 'DEBIT_CARD' || paymentMethod === 'CREDIT_CARD';
  const isPixKeyConfigured = hasConfiguredPixKey(store);
  const pixPayload = useMemo(
    () => (isPixKeyConfigured ? buildPixPayload(checkoutTotal, store) : ''),
    [checkoutTotal, isPixKeyConfigured, store],
  );
  const paymentSummary = useMemo(
    () => getPaymentSummary(paymentMethod, cardPaymentMode, cashChangeFor),
    [cardPaymentMode, cashChangeFor, paymentMethod],
  );

  useEffect(() => {
    let isActive = true;

    async function generatePixQrCode() {
      setPixQrCodeError('');
      setPixQrCodeDataUrl('');

      if (!pixPayload) {
        return;
      }

      try {
        const dataUrl = await createPixQrCodeDataUrl(pixPayload);
        if (isActive) {
          setPixQrCodeDataUrl(dataUrl);
        }
      } catch {
        if (isActive) {
          setPixQrCodeError('Nao foi possivel exibir o QR Code. Use o codigo copia e cola.');
        }
      }
    }

    generatePixQrCode();

    return () => {
      isActive = false;
    };
  }, [pixPayload]);

  const [orderQrCodeUrl, setOrderQrCodeUrl] = useState('');
  const [orderPaymentStatus, setOrderPaymentStatus] = useState('PENDING');

  useEffect(() => {
    if (!lastOrder) return;
    setOrderPaymentStatus(lastOrder.paymentStatus || 'PENDING');
    if (lastOrder.pixQrCodeBase64) {
      setOrderQrCodeUrl(
        lastOrder.pixQrCodeBase64.startsWith('data:image')
          ? lastOrder.pixQrCodeBase64
          : `data:image/png;base64,${lastOrder.pixQrCodeBase64}`,
      );
    } else if (lastOrder.pixQrCode) {
      createPixQrCodeDataUrl(lastOrder.pixQrCode)
        .then((url) => setOrderQrCodeUrl(url))
        .catch(() => setOrderQrCodeUrl(''));
    }
  }, [lastOrder]);

  useEffect(() => {
    if (!lastOrder?.id || orderPaymentStatus === 'PAID' || orderPaymentStatus === 'COMPLETED') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/pedidos/rastrear/${lastOrder.id}`);
        if (res.ok) {
          const updated = await res.json();
          const st = updated.paymentStatus || updated.financialStatus || updated.status;
          if (st === 'PAID' || st === 'COMPLETED' || updated.status === 'PREPARING' || updated.status === 'READY') {
            setOrderPaymentStatus('PAID');
            showSuccess('🎉 Pagamento PIX confirmado com sucesso!');
          }
        }
      } catch (e) {
        // ignorar falha temporária no polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastOrder?.id, orderPaymentStatus, apiBaseUrl]);

  const canCheckout = useMemo(() => {
    if (!hasItems || store?.isOpen === false) {
      return false;
    }

    if (fulfillmentType === 'DELIVERY' && !deliveryFeeResult.available) {
      return false;
    }

    if (!customerName.trim() || !isValidPhoneBR(customerWhatsApp)) {
      return false;
    }

    if (
      fulfillmentType === 'DELIVERY' &&
      (!street.trim() || !number.trim() || !neighborhood.trim())
    ) {
      return false;
    }

    if (paymentMethod === 'PIX' && !isPixKeyConfigured) {
      return false;
    }

    return Boolean(paymentMethod);
  }, [
    customerWhatsApp,
    customerName,
    deliveryFeeResult,
    fulfillmentType,
    hasItems,
    isPixKeyConfigured,
    neighborhood,
    number,
    paymentMethod,
    store?.isOpen,
    street,
  ]);

  async function copyPixPayload() {
    if (!pixPayload) {
      showInfo('Pagamento via PIX temporariamente indisponivel. Escolha outra forma de pagamento.');
      return;
    }

    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopyFeedback('Código PIX copiado');
    } catch (error) {
      setCopyFeedback('Copie o código manualmente');
    }

    window.setTimeout(() => setCopyFeedback(''), 2500);
  }

  function handlePhoneChange(value) {
    setCustomerWhatsApp(formatPhoneBR(value));
    setFieldErrors((current) => ({ ...current, customerWhatsApp: '' }));
  }

  function validateCheckout() {
    const errors = {};

    if (store?.isOpen === false) {
      showError(
        'A loja esta fechada no momento. Volte durante o horario de atendimento para fazer seu pedido.',
      );
      return false;
    }

    if (!hasItems) {
      showError('Adicione itens ao carrinho antes de finalizar.');
      return false;
    }

    if (!customerName.trim()) {
      errors.customerName = 'Informe seu nome.';
    }

    if (!isValidPhoneBR(customerWhatsApp)) {
      errors.customerWhatsApp = 'Informe um WhatsApp valido.';
    }

    if (fulfillmentType === 'DELIVERY') {
      if (!street.trim()) errors.street = 'Informe o endereco de entrega.';
      if (!number.trim()) errors.number = 'Informe o numero.';
      if (!neighborhood.trim()) errors.neighborhood = 'Informe o bairro.';
    }

    if (!paymentMethod) {
      errors.paymentMethod = 'Escolha uma forma de pagamento.';
    }

    if (paymentMethod === 'PIX' && !isPixKeyConfigured) {
      errors.paymentMethod =
        'Pagamento via PIX temporariamente indisponivel. Escolha outra forma de pagamento.';
    }

    if (fulfillmentType === 'DELIVERY' && !deliveryFeeResult.available) {
      errors.delivery =
        deliveryFeeResult.message || 'Entrega indisponivel para as informacoes fornecidas.';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      showError(errors.paymentMethod || errors.delivery || 'Verifique os campos obrigatorios.');
      return false;
    }

    return true;
  }

  async function handleCheckout(event) {
    event.preventDefault();

    if (!validateCheckout()) {
      return;
    }

    if (store?.isOpen === false) {
      showError('A loja está fechada no momento.');
      return;
    }

    if (!hasItems) {
      showError('Adicione itens ao carrinho antes de finalizar.');
      return;
    }

    if (!canCheckout) {
      showError('Informe nome e WhatsApp para finalizar.');
      return;
    }

    if (
      fulfillmentType === 'DELIVERY' &&
      (!street.trim() || !number.trim() || !neighborhood.trim())
    ) {
      showError('Para entrega, informe rua, número e bairro.');
      return;
    }

    if (fulfillmentType === 'DELIVERY' && !deliveryFeeResult.available) {
      showError(deliveryFeeResult.message || 'Entrega indisponivel para as informacoes fornecidas.');
      return;
    }

    if (paymentMethod === 'PIX' && !isPixKeyConfigured) {
      showError('Pagamento via PIX temporariamente indisponivel. Escolha outra forma de pagamento.');
      return;
    }

    if (paymentMethod === 'CASH' && cashChangeFor.trim()) {
      const changeFor = parseCurrencyInput(cashChangeFor);

      if (!changeFor || changeFor < checkoutTotal) {
        showError('O valor para troco precisa ser maior que o total do pedido.');
        return;
      }
    }

    if (!customer?.token) {
      showInfo('Entre ou cadastre-se para finalizar seu pedido.');
      onLoginClick?.();
      return;
    }

    const payload = {
      fulfillmentType,
      deliveryFee: deliveryFeeAmount,
      serviceFee: configuredServiceFee,
      customerId: customer?.id,
      customer: {
        name: customerName.trim(),
        phone: cleanPhone(customerWhatsApp),
      },
      address:
        fulfillmentType === 'DELIVERY'
          ? {
              street,
              number,
              neighborhood,
              complement,
            }
          : undefined,
      notes: [
        `Tipo: ${getFulfillmentLabel(fulfillmentType)}`,
        notes,
        `Pagamento: ${paymentSummary}`,
        paymentMethod === 'PIX' && pixPayload ? `PIX copia e cola: ${pixPayload}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
      paymentMethod,
      cardPaymentMode: isCardPayment ? cardPaymentMode : undefined,
      couponCode: couponCode || undefined,
      useLoyaltyBalance: useLoyaltyBalance || undefined,
      items: cartItems.map((item) => ({
        productId: String(item.productId ?? item.id),
        name: item.name,
        displayName: item.name,
        category: item.category,
        variantId: item.variantId,
        halfAndHalf: item.halfAndHalf,
        optionIds: item.optionIds,
        addonIds: item.addonIds,
        crustId: item.crustId,
        customizations: item.customizations,
        basePrice: item.basePrice ?? item.price,
        imageUrl: item.imageUrl,
        price: item.price,
        quantity: item.qty,
      })),
    };

    try {
      setIsSubmitting(true);
      const response = await fetch(`${apiBaseUrl}/pedidos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Nao foi possivel finalizar o pedido.');
      }

      const order = normalizeOrder(data, cartItems, checkoutTotal);

      setLastOrder(order);

      const isMockUrl = data.paymentUrl && data.paymentUrl.includes('/mock-payment');
      const isProd = import.meta.env.PROD;
      if (
        data.paymentUrl &&
        !data.pixQrCode &&
        paymentMethod !== 'PIX' &&
        (!isProd || !isMockUrl)
      ) {
        window.location.href = data.paymentUrl;
        return;
      }

      const orderText = `*Novo Pedido*
Nome: ${customerName}
WhatsApp: ${customerWhatsApp}
Tipo: ${getFulfillmentLabel(fulfillmentType)}
Pagamento: ${paymentSummary}
${fulfillmentType === 'DELIVERY' ? `Endereco: ${street}, ${number} - ${neighborhood} - CEP: ${zipCode}\nComplemento: ${complement}` : ''}
${notes ? `Obs: ${notes}` : ''}

*Itens:*
${cartItems.map((item) => `- ${item.qty}x ${item.name}${item.customizations ? ` - ${item.customizations}` : ''} (${formatCurrencySafe(item.price)})`).join('\n')}

*Total: ${formatCurrencySafe(checkoutTotal)}*`;

      const phoneStr = (store?.phone ?? '').replace(/\D/g, '');
      if (phoneStr) {
        const whatsappUrl = `https://wa.me/55${phoneStr}?text=${encodeURIComponent(orderText)}`;
        window.open(whatsappUrl, '_blank');
      }

      onOrderCreated(order);
      showSuccess('Pedido criado com sucesso!');
    } catch (requestError) {
      showError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível finalizar o pedido.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (lastOrder) {
    const isPixOrder =
      paymentMethod === 'PIX' ||
      lastOrder.pixQrCode ||
      lastOrder.pixQrCodeBase64 ||
      lastOrder.paymentMethod === 'PIX';

    return (
      <main className="mx-auto max-w-4xl px-3 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border-2 border-emerald-200 bg-white p-6 shadow-2xl dark:border-emerald-900/60 dark:bg-slate-900 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Check size={44} strokeWidth={3} />
            </div>
            <span className="rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Pedido Gerado
            </span>
            <h1 className="mt-3 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">
              Pedido #{getOrderDisplayNumber(lastOrder)}
            </h1>
            <p className="mt-2 text-base font-bold text-slate-500 dark:text-slate-400">
              {getFulfillmentLabel(lastOrder.fulfillmentType)} · {formatCurrencySafe(lastOrder.total)}
            </p>
          </div>

          {isPixOrder && (
            <div className="mt-8 rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950 sm:p-8">
              <div className="text-center">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Pagamento PIX via QR Code
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Escaneie o QR Code no seu aplicativo bancário ou use o código Copia e Cola abaixo.
                </p>
              </div>

              {orderPaymentStatus === 'PAID' ? (
                <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 animate-bounce">
                  <p className="text-xl font-black">🎉 Pagamento PIX Confirmado!</p>
                  <p className="mt-1 text-sm font-bold">
                    Recebemos seu pagamento em tempo real. Nossa cozinha já começou a preparar seu pedido!
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-6 flex justify-center">
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-md dark:border-slate-800 dark:bg-slate-900">
                      {orderQrCodeUrl ? (
                        <img
                          src={orderQrCodeUrl}
                          alt="QR Code PIX"
                          className="h-56 w-56 rounded-lg sm:h-64 sm:w-64"
                        />
                      ) : (
                        <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 sm:h-64 sm:w-64">
                          Gerando QR Code...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col items-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      Aguardando confirmação de pagamento...
                    </span>
                  </div>

                  {lastOrder.pixQrCode && (
                    <div className="mt-6">
                      <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                        PIX Copia e Cola
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          readOnly
                          value={lastOrder.pixQrCode}
                          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(lastOrder.pixQrCode);
                            showSuccess('Código PIX copiado para a área de transferência!');
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white transition hover:bg-red-700 shrink-0"
                        >
                          <Copy size={16} />
                          Copiar Código PIX
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`#/order/${lastOrder.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:w-auto"
            >
              Acompanhar meu Pedido
            </a>
            <a
              href="#/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:w-auto"
            >
              <ArrowLeft size={16} />
              Voltar ao Cardápio
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-10">
      <a
        href="#/"
        className="back-to-menu-button mb-6 inline-flex max-w-full items-center justify-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-950 px-4 py-2 font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100"
      >
        <ArrowLeft size={18} />
        Voltar ao cardápio
      </a>

      <section className="mb-6 flex flex-col gap-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">Checkout</h1>
          <p className="text-slate-600 dark:text-slate-400">Preencha seus dados para finalizar o pedido.</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-bold uppercase text-red-600">Total atual</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            {formatCurrencySafe(cartSubtotal)}
          </p>
        </div>
      </section>

      <section className="mb-8 grid items-start gap-5 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <form
          id="checkout-form"
          onSubmit={handleCheckout}
          className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl sm:p-6"
        >
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Finalizar pedido</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                O pedido será enviado diretamente para o nosso WhatsApp.
              </p>
            </div>
          </div>

          <section className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <ShoppingCart size={20} className="text-red-600" />
              Seu pedido
            </h3>
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors duration-200 ease-out dark:border-slate-800 sm:grid-cols-[auto_1fr_auto] sm:gap-4 sm:p-4 bg-slate-50 dark:bg-slate-950"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-3xl">
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
                        type="button"
                        onClick={() => onUpdateCartItemQuantity(item.id, item.qty - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 transition-all duration-200 ease-out hover:scale-105 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateCartItemQuantity(item.id, item.qty + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 transition-all duration-200 ease-out hover:scale-105 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
                    <button
                      type="button"
                      onClick={() => onRemoveCartItem(item.id)}
                      className="-ml-2 p-2 text-slate-400 transition-all duration-200 ease-out hover:scale-105 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                    <p className="break-words text-right font-black text-slate-900 dark:text-slate-100">
                      {formatCurrencySafe(safeNumber(item.price) * safeNumber(item.qty))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Nome</label>
              <input
                value={customerName}
                onChange={(event) => {
                  setCustomerName(event.target.value);
                  setFieldErrors((current) => ({ ...current, customerName: '' }));
                }}
                className={`w-full rounded-lg border-2 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  fieldErrors.customerName
                    ? 'border-red-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
                placeholder="Seu nome"
              />
              {fieldErrors.customerName && (
                <p className="mt-1 text-sm font-semibold text-red-600">{fieldErrors.customerName}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">WhatsApp</label>
              <input
                value={customerWhatsApp}
                onChange={(event) => handlePhoneChange(event.target.value)}
                className={`w-full rounded-lg border-2 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  fieldErrors.customerWhatsApp
                    ? 'border-red-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
                placeholder="(00) 00000-0000"
                type="tel"
              />
              {fieldErrors.customerWhatsApp && (
                <p className="mt-1 text-sm font-semibold text-red-600">{fieldErrors.customerWhatsApp}</p>
              )}
            </div>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setFulfillmentType('DELIVERY')}
              className={`relative flex items-start gap-4 rounded-xl border-2 p-4 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                fulfillmentType === 'DELIVERY'
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/20 shadow-red-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50/30 dark:hover:bg-slate-800/50'
              }`}
              type="button"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12 ${fulfillmentType === 'DELIVERY' ? 'bg-red-500 text-white shadow-md shadow-red-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                <Truck size={24} />
              </div>
              <div className="mt-1 min-w-0 pr-7">
                <span className={`block font-black ${fulfillmentType === 'DELIVERY' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-900 dark:text-slate-100'}`}>
                  Entrega / Envio
                </span>
                <span className="block mt-1 text-sm font-medium text-slate-500">
                  Receber no endereço informado
                </span>
              </div>
              {fulfillmentType === 'DELIVERY' && (
                <div className="absolute right-4 top-4 text-red-500">
                  <Check size={20} strokeWidth={3} />
                </div>
              )}
            </button>
            <button
              onClick={() => setFulfillmentType('PICKUP')}
              className={`relative flex items-start gap-4 rounded-xl border-2 p-4 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                fulfillmentType === 'PICKUP'
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/20 shadow-red-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50/30 dark:hover:bg-slate-800/50'
              }`}
              type="button"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12 ${fulfillmentType === 'PICKUP' ? 'bg-red-500 text-white shadow-md shadow-red-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                <PackageCheck size={24} />
              </div>
              <div className="mt-1 min-w-0 pr-7">
                <span className={`block font-black ${fulfillmentType === 'PICKUP' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-900 dark:text-slate-100'}`}>
                  Retirada na loja
                </span>
                <span className="block mt-1 text-sm font-medium text-slate-500">
                  Buscar no balcão sem taxa
                </span>
              </div>
              {fulfillmentType === 'PICKUP' && (
                <div className="absolute right-4 top-4 text-red-500">
                  <Check size={20} strokeWidth={3} />
                </div>
              )}
            </button>
          </div>

          {fulfillmentType === 'PICKUP' && (
            <div className="mb-5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <p>Retirada escolhida: o pedido será preparado para buscar na loja e não terá taxa de entrega.</p>
              <p className="mt-2 font-bold text-emerald-700 dark:text-emerald-400">
                {store?.address?.trim() || 'Endereço da loja ainda não configurado.'}
              </p>
            </div>
          )}

          <div
            className={`grid gap-4 overflow-hidden transition-all duration-500 ease-in-out ${fulfillmentType === 'DELIVERY' ? 'grid-rows-[1fr] opacity-100 mb-5' : 'grid-rows-[0fr] opacity-0 mb-0'}`}
          >
            <div className="min-h-0">
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">CEP</label>
                    <input
                      value={zipCode}
                      onChange={(event) => setZipCode(event.target.value)}
                      onBlur={handleZipCodeBlur}
                      maxLength={9}
                      className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 font-medium transition-colors focus:border-red-500 focus:bg-white dark:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-red-500/10"
                      placeholder="00000-000"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Rua</label>
                    <input
                      value={street}
                      onChange={(event) => {
                        setStreet(event.target.value);
                        setFieldErrors((current) => ({ ...current, street: '' }));
                      }}
                      className={`w-full rounded-xl border-2 bg-slate-50 px-4 py-3 font-medium transition-colors focus:border-red-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-500/10 dark:bg-slate-900 ${
                        fieldErrors.street ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                      }`}
                      placeholder="Nome da rua, avenida..."
                    />
                    {fieldErrors.street && (
                      <p className="mt-1 text-sm font-semibold text-red-600">{fieldErrors.street}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                  <div className="min-w-0">
                    <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Número</label>
                    <input
                      value={number}
                      onChange={(event) => {
                        setNumber(event.target.value);
                        setFieldErrors((current) => ({ ...current, number: '' }));
                      }}
                      className={`w-full rounded-xl border-2 bg-slate-50 px-4 py-3 font-medium transition-colors focus:border-red-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-500/10 dark:bg-slate-900 ${
                        fieldErrors.number ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                      }`}
                      placeholder="123"
                    />
                    {fieldErrors.number && (
                      <p className="mt-1 text-sm font-semibold text-red-600">{fieldErrors.number}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Bairro</label>
                    <input
                      value={neighborhood}
                      onChange={(event) => {
                        setNeighborhood(event.target.value);
                        setFieldErrors((current) => ({ ...current, neighborhood: '' }));
                      }}
                      className={`w-full rounded-xl border-2 bg-slate-50 px-4 py-3 font-medium transition-colors focus:border-red-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-500/10 dark:bg-slate-900 ${
                        fieldErrors.neighborhood
                          ? 'border-red-500'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                      placeholder="Bairro"
                    />
                    {fieldErrors.neighborhood && (
                      <p className="mt-1 text-sm font-semibold text-red-600">
                        {fieldErrors.neighborhood}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Complemento</label>
                  <input
                    value={complement}
                    onChange={(event) => setComplement(event.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 font-medium transition-colors focus:border-red-500 focus:bg-white dark:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-red-500/10"
                    placeholder="Apto, bloco, casa 2..."
                  />
                </div>
              </div>
            </div>
          </div>

          <section className="mb-5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-red-600">
              <CreditCard size={20} />
              Método de pagamento
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {paymentMethods.map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id)}
                  className={`relative flex items-center gap-4 rounded-xl border-2 p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                    paymentMethod === id
                      ? 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${paymentMethod === id ? 'bg-red-500 text-white shadow-md shadow-red-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 pr-7">
                    <span className="block font-bold text-slate-900 dark:text-slate-100">{label}</span>
                    <span className="block text-sm font-medium text-slate-500">{description}</span>
                  </div>
                  {paymentMethod === id && (
                    <div className="absolute right-3 text-red-500">
                      <Check size={18} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
            {fieldErrors.paymentMethod && (
              <p className="mt-2 text-sm font-semibold text-red-600">
                {fieldErrors.paymentMethod}
              </p>
            )}

            {paymentMethod === 'PIX' && (
              <div className="mt-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 sm:p-4">
                {!isPixKeyConfigured ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    Pagamento via PIX temporariamente indisponivel. Escolha outra forma de pagamento.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="flex items-center justify-center rounded-xl bg-white p-3 dark:bg-slate-900">
                      {pixQrCodeDataUrl ? (
                        <img
                          src={pixQrCodeDataUrl}
                          alt="QR Code PIX"
                          className="h-44 w-44 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:h-52 sm:w-52"
                        />
                      ) : (
                        <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 sm:h-52 sm:w-52">
                          {pixQrCodeError || 'Gerando QR Code PIX...'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 md:pr-6">
                      <div className="mb-3">
                        <p className="text-sm font-bold uppercase text-red-600">Valor</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrencySafe(checkoutTotal)}
                        </p>
                      </div>

                      <button
                        onClick={copyPixPayload}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 sm:w-auto"
                        type="button"
                      >
                        <Copy size={16} />
                        Copiar código PIX
                      </button>
                      {copyFeedback && (
                        <p className="mt-2 text-sm font-semibold text-green-700">{copyFeedback}</p>
                      )}
                      <label className="mt-4 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                        PIX copia e cola
                      </label>
                      <textarea
                        readOnly
                        value={pixPayload}
                        className="mt-2 h-24 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        onFocus={(event) => event.target.select()}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <div className="mt-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Troco para quanto
                </label>
                <input
                  value={cashChangeFor}
                  onChange={(event) => setCashChangeFor(event.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 dark:border-slate-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Ex: 100,00"
                />
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Deixe em branco se não precisar de troco.
                </p>
              </div>
            )}

            {isCardPayment && (
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {cardPaymentModes.filter(mode => mode.id !== 'ONLINE' || storeSettings?.gatewayEnabled).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setCardPaymentMode(mode.id)}
                      className={`relative flex flex-col justify-center rounded-xl border-2 p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                        cardPaymentMode === mode.id
                          ? 'border-red-500 bg-slate-50 dark:bg-slate-950'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <span className="font-bold text-slate-900 dark:text-slate-100 pr-6">{mode.label}</span>
                      <span className="mt-1 block text-sm font-medium text-slate-500">
                        {mode.description}
                      </span>
                      {cardPaymentMode === mode.id && (
                        <div className="absolute right-3 top-3 text-red-500">
                          <Check size={18} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>


          {fulfillmentType === 'DELIVERY' && deliveryFeeResult.message && (
            <p className={`mb-5 text-sm font-semibold ${deliveryFeeResult.available ? 'text-green-600' : 'text-red-600'}`}>
              {deliveryFeeResult.message}
            </p>
          )}

          <div className="mb-5">
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Observações do pedido
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-lg border-2 border-slate-200 dark:border-slate-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={
                fulfillmentType === 'DELIVERY'
                  ? 'Ex: sem cebola, entregar na portaria...'
                  : 'Ex: sem cebola, vou retirar no nome de...'
              }
            />
          </div>
        </form>

        <aside className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl sm:p-6 lg:sticky lg:top-8 lg:col-start-2 lg:row-start-1">
          {lastOrder && (
            <div className="mb-6 rounded-xl border-2 border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100 sm:p-5">
              <p className="text-sm font-black uppercase">Pedido criado com sucesso</p>
              <p className="mt-1 text-2xl font-black">#{getOrderDisplayNumber(lastOrder)}</p>
              <p className="mt-1 text-sm font-semibold">
                {getFulfillmentLabel(lastOrder.fulfillmentType)} - {formatCurrencySafe(lastOrder.total)}
              </p>
            </div>
          )}

          {hasItems && (
            <>
              {/* Cupom de Desconto */}
              <div className="mb-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Cupom de Desconto</h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    placeholder="Digite seu cupom"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 p-2 uppercase focus:border-red-500 focus:outline-none"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={Boolean(appliedCoupon)}
                  />
                  {!appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isApplyingCoupon || !couponCode}
                      className="w-full rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:w-auto"
                    >
                      {isApplyingCoupon ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode('');
                      }}
                      className="w-full rounded-lg bg-slate-200 px-4 py-2 font-bold text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-300 sm:w-auto"
                    >
                      Remover
                    </button>
                  )}
                </div>
                {couponError && (
                  <p className="mt-2 text-sm text-red-600 font-medium">{couponError}</p>
                )}
                {appliedCoupon && (
                  <p className="mt-2 text-sm text-green-600 font-bold">
                    Cupom {appliedCoupon.code} aplicado com sucesso!
                  </p>
                )}
              </div>

              {/* Fidelidade / Cashback */}
              {(customer?.loyaltyBalance || 0) > 0 && (
                <div className="mb-8 rounded-xl border-2 border-green-200 bg-green-50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-green-800">Usar Cashback</h2>
                      <p className="text-sm text-green-700">
                        Saldo atual: {formatCurrencySafe(customer?.loyaltyBalance || 0)}
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={useLoyaltyBalance}
                        onChange={(e) => setUseLoyaltyBalance(e.target.checked)}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white dark:bg-slate-900 after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-green-800"></div>
                    </label>
                  </div>
                </div>
              )}

              <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="bg-slate-50 dark:bg-slate-950 p-5 border-b border-slate-200 dark:border-slate-800 border-dashed">
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Receipt size={22} className="text-red-500" />
                    Resumo financeiro
                  </h2>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <span>Tipo:</span>
                    <span className="text-right font-bold text-slate-900 dark:text-slate-100">
                      {getFulfillmentLabel(fulfillmentType)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <span>Pagamento:</span>
                    <span className="text-right font-bold text-slate-900 dark:text-slate-100">{paymentSummary}</span>
                  </div>

                  <div className="my-4 border-t border-slate-200 dark:border-slate-800 border-dashed"></div>

                  <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrencySafe(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                    <span>Taxa de entrega:</span>
                    <span
                      className={
                        fulfillmentType === 'DELIVERY' ? 'font-medium' : 'font-bold text-green-600'
                      }
                    >
                      {fulfillmentType === 'DELIVERY'
                        ? formatCurrencySafe(deliveryFeeAmount)
                        : 'Sem taxa'}
                    </span>
                  </div>
                  {configuredServiceFee > 0 && (
                    <div className="flex justify-between gap-4 text-slate-600 dark:text-slate-400">
                      <span>Taxa de serviço:</span>
                      <span className="font-medium">{formatCurrencySafe(configuredServiceFee)}</span>
                    </div>
                  )}
                  {couponDiscountAmount > 0 && (
                    <div className="flex justify-between gap-4 font-bold text-green-600">
                      <span>Desconto (Cupom):</span>
                      <span>-{formatCurrencySafe(couponDiscountAmount)}</span>
                    </div>
                  )}
                  {loyaltyDiscountAmount > 0 && (
                    <div className="flex justify-between gap-4 font-bold text-green-600">
                      <span>Cashback utilizado:</span>
                      <span>-{formatCurrencySafe(loyaltyDiscountAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-5 border-t border-slate-200 dark:border-slate-800">
                  <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <span className="text-lg font-bold text-slate-700 dark:text-slate-300">Total:</span>
                    <span className="break-words text-3xl font-black tracking-tight text-red-600 sm:text-right">
                      {formatCurrencySafe(checkoutTotal)}
                    </span>
                  </div>

                  <button
                    form="checkout-form"
                    disabled={!hasItems || store?.isOpen === false || isSubmitting}
                    className="group relative w-full overflow-hidden rounded-xl bg-red-600 py-4 text-lg font-black text-white shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                    type="submit"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <span className="animate-pulse">Finalizando pedido...</span>
                      ) : (
                        <>
                          <CheckCircle2
                            size={22}
                            className="transition-transform group-hover:scale-110"
                          />
                          Finalizar Pedido
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}

        </aside>
      </section>
    </main>
  );
}
