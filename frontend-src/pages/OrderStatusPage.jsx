import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Clock3,
  MapPin,
  PackageCheck,
  Pizza,
  ReceiptText,
  Search,
  ShoppingBag,
  Store,
  WalletCards,
} from 'lucide-react';
import { formatCurrency } from '../data/menuData.js';
import { useCartStore } from '../store/useCartStore.js';

const DELIVERY_STEPS = [
  { key: 'PENDING', title: 'Pedido recebido', Icon: ReceiptText },
  { key: 'PREPARING', title: 'Em preparo', Icon: ChefHat },
  { key: 'OUT_FOR_DELIVERY', title: 'Saiu para entrega', Icon: Bike },
  { key: 'DELIVERED', title: 'Entregue', Icon: CheckCircle2 },
];

const PICKUP_STEPS = [
  { key: 'PENDING', title: 'Pedido recebido', Icon: ReceiptText },
  { key: 'PREPARING', title: 'Em preparo', Icon: ChefHat },
  { key: 'READY', title: 'Pronto para retirada', Icon: ShoppingBag },
  { key: 'DELIVERED', title: 'Retirado', Icon: CheckCircle2 },
];

const STATUS_LABELS = {
  PENDING: 'Pedido recebido',
  CONFIRMED: 'Pedido confirmado',
  PREPARING: 'Em preparo',
  READY: 'Pronto para retirada',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Concluído',
  CANCELED: 'Cancelado',
};

const STATUS_MESSAGES = {
  PENDING: 'Recebemos seu pedido e estamos aguardando a confirmação do pagamento.',
  CONFIRMED: 'Pedido confirmado! Em breve ele vai para o preparo.',
  PREPARING: 'Sua pizza está sendo preparada com todo cuidado.',
  READY: 'Seu pedido está pronto.',
  OUT_FOR_DELIVERY: 'O entregador saiu para entrega. Fique atento ao telefone.',
  DELIVERED: 'Pedido concluído. Bom apetite!',
  CANCELED: 'Este pedido foi cancelado.',
};

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text && !['undefined', 'null', 'nan'].includes(text.toLowerCase()) ? text : fallback;
}

export function safeMoney(value) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function getTrackingIndex(status) {
  if (status === 'CANCELED') return -1;
  if (status === 'PREPARING') return 1;
  if (status === 'READY' || status === 'OUT_FOR_DELIVERY') return 2;
  if (status === 'DELIVERED') return 3;
  return 0;
}

export function getStatusMessage(order) {
  if (!order) return '';
  if (order.status === 'CANCELED') return STATUS_MESSAGES.CANCELED;
  if (order.paymentStatus === 'PARTIALLY_PAID') {
    return 'Entrada paga. O saldo restante será pago na entrega ou retirada.';
  }
  return STATUS_MESSAGES[order.status] || 'Estamos atualizando o andamento do seu pedido.';
}

function paymentMethodLabel(method) {
  const labels = {
    PIX: 'PIX',
    PIX_ONLINE: 'PIX online',
    MERCADOPAGO: 'Mercado Pago',
    CASH: 'Dinheiro',
    CARD: 'Cartão',
    CREDIT_CARD: 'Cartão de crédito',
    DEBIT_CARD: 'Cartão de débito',
  };
  return labels[safeText(method).toUpperCase()] || safeText(method, 'Não informada');
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatEstimate(order) {
  const value = order?.estimatedDeliveryAt || order?.estimatedAt || order?.deliveryEstimate;
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `Previsão: ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }
  const minutes = Number(order?.prepTimeMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? `Previsão: ${minutes} min` : '';
}

function ItemDetails({ item }) {
  const details = [];
  const variant = safeText(item.variantName || item.sizeName || item.size);
  const customization = safeText(item.customizations);
  const notes = safeText(item.notes || item.observation);

  if (variant) details.push({ label: 'Tamanho', value: variant });
  if (customization) {
    customization
      .split(/\s*[|;\n]\s*/)
      .filter(Boolean)
      .forEach((value, index) => details.push({ label: index === 0 ? 'Detalhes' : '', value }));
  }
  if (notes) details.push({ label: 'Observação', value: notes });

  if (details.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
      {details.map((detail, index) => (
        <p key={`${detail.label}-${detail.value}-${index}`} className="break-words">
          {detail.label && <span className="font-bold text-slate-700 dark:text-slate-200">{detail.label}: </span>}
          {detail.value}
        </p>
      ))}
    </div>
  );
}

function PaymentCard({ order }) {
  const paid = safeMoney(order.amountPaid || order.depositAmount);
  const due = safeMoney(order.amountDue || order.remainingAmount);
  const method = safeText(order.paymentMethod).toUpperCase();
  const destination = order.fulfillmentType === 'DELIVERY' ? 'na entrega' : 'na retirada';

  if (order.paymentStatus === 'PARTIALLY_PAID') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 sm:p-5">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <h3 className="font-black text-amber-950 dark:text-amber-100">Entrada paga</h3>
            <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
              Você já pagou {formatCurrency(paid)}. Falta pagar {formatCurrency(due)} {destination}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (['PAID', 'COMPLETED'].includes(order.paymentStatus)) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
          <div>
            <h3 className="font-black text-emerald-950 dark:text-emerald-100">Pagamento confirmado</h3>
            <p className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-200">Seu pedido está pago.</p>
          </div>
        </div>
      </div>
    );
  }

  const description = ['PIX_ONLINE', 'MERCADOPAGO'].includes(method)
    ? 'Estamos aguardando a confirmação automática do pagamento.'
    : method === 'PIX'
      ? 'Envie o comprovante ou aguarde a confirmação da loja.'
      : 'Assim que o pagamento for confirmado, seu pedido seguirá para o preparo.';

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/60 dark:bg-orange-950/30 sm:p-5">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-6 w-6 shrink-0 text-orange-700 dark:text-orange-300" />
        <div>
          <h3 className="font-black text-orange-950 dark:text-orange-100">Pagamento aguardando confirmação</h3>
          <p className="mt-1 text-sm font-semibold text-orange-900 dark:text-orange-200">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function OrderStatusPage() {
  const [identifier, setIdentifier] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const storeSettings = useCartStore((state) => state.storeSettings);
  const store = useCartStore((state) => state.store);

  async function fetchOrderById(idToSearch) {
    setIsLoading(true);
    setError('');
    try {
      const tenantId = storeSettings?.tenantId || store?.tenantId || '';
      const response = await fetch(`/api/pedidos/rastrear/${encodeURIComponent(idToSearch)}`, tenantId
        ? { headers: { 'x-tenant-id': tenantId } }
        : undefined);
      if (!response.ok) throw new Error('Pedido não encontrado para o número informado.');
      setOrder(await response.json());
    } catch (requestError) {
      setOrder(null);
      setError(requestError?.message || 'Não foi possível buscar o pedido agora. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const hashPath = window.location.hash.replace(/^#/, '') || '/';
    const [pathOnly, queryString = ''] = hashPath.split('?');
    const queryId = new URLSearchParams(queryString).get('id');
    const pathId = pathOnly.startsWith('/order/') ? pathOnly.split('/')[2] : '';
    const id = safeText(pathId || queryId);
    if (id) {
      setIdentifier(id);
      fetchOrderById(id);
    }
  }, []);

  const steps = order?.fulfillmentType === 'PICKUP' ? PICKUP_STEPS : DELIVERY_STEPS;
  const trackingIndex = getTrackingIndex(order?.status);
  const estimate = formatEstimate(order);
  const shortId = safeText(order?.id).slice(-6).toUpperCase();
  const statusMessage = getStatusMessage(order);
  const items = Array.isArray(order?.items) ? order.items : [];
  const statusLabel = STATUS_LABELS[order?.status] || 'Pedido em andamento';
  const isPickup = order?.fulfillmentType === 'PICKUP';

  const deliveryDetails = useMemo(() => {
    if (!order || isPickup || order.status !== 'OUT_FOR_DELIVERY') return null;
    const driverName = safeText(order.driver?.name || order.driverName);
    const departedAt = formatTime(order.outForDeliveryAt || order.dispatchedAt);
    return { driverName, departedAt };
  }, [isPickup, order]);

  function handleSearch(event) {
    event.preventDefault();
    const id = identifier.trim();
    if (id) fetchOrderById(id);
  }

  return (
    <main className="min-h-[70vh] bg-gradient-to-b from-orange-50/80 via-white to-white px-3 py-6 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <a href="#/" className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-bold text-orange-800 transition-colors hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-950/50">
          <ArrowLeft className="h-5 w-5" /> Voltar ao cardápio
        </a>

        <header className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-red-700 via-red-600 to-orange-500 p-6 text-white shadow-xl shadow-red-900/10 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur">
                <Pizza className="h-4 w-4" /> Feito com carinho
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Acompanhar Pedido</h1>
              <p className="mt-2 max-w-xl text-sm font-medium text-red-50 sm:text-base">Acompanhe em tempo real o preparo e a entrega do seu pedido.</p>
            </div>
            <PackageCheck className="hidden h-24 w-24 text-white/20 sm:block" />
          </div>
        </header>

        <section className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-5 ${order ? 'mb-5 border-slate-200 dark:border-slate-800' : 'border-orange-200 dark:border-orange-900/60'}`}>
          <div className="mb-3">
            <h2 className="font-black text-slate-900 dark:text-white">{order ? 'Buscar outro pedido' : 'Encontre seu pedido'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Informe o número recebido ao finalizar sua compra.</p>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="order-number">Número do pedido</label>
            <input id="order-number" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Digite o número do pedido" className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-orange-500" />
            <button type="submit" disabled={isLoading || !identifier.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-black text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Search className="h-5 w-5" /> {isLoading ? 'Procurando...' : 'Procurar'}
            </button>
          </form>
          {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}
        </section>

        {isLoading && !order && <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-600" /><p className="mt-4 font-bold text-slate-600 dark:text-slate-300">Buscando seu pedido...</p></div>}

        {order && (
          <section className="space-y-5">
            <div className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-xl shadow-orange-950/5 dark:border-orange-900/50 dark:bg-slate-900">
              <div className="border-b border-orange-100 bg-orange-50/70 p-5 dark:border-orange-900/40 dark:bg-orange-950/20 sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">{statusLabel}</span>
                      <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-black text-orange-800 dark:border-orange-800 dark:bg-slate-900 dark:text-orange-200">{isPickup ? 'Retirada na loja' : 'Entrega'}</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Pedido #{shortId || '—'}</h2>
                    <p className="mt-2 max-w-2xl text-base font-semibold text-slate-700 dark:text-slate-200">{statusMessage}</p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[430px]">
                    <div className="rounded-2xl bg-white p-3 dark:bg-slate-950"><p className="text-xs font-bold text-slate-500">Tipo</p><p className="mt-1 flex items-center gap-1.5 font-black text-slate-900 dark:text-white">{isPickup ? <Store className="h-4 w-4 text-orange-600" /> : <Bike className="h-4 w-4 text-orange-600" />}{isPickup ? 'Retirada' : 'Entrega'}</p></div>
                    <div className="rounded-2xl bg-white p-3 dark:bg-slate-950"><p className="text-xs font-bold text-slate-500">Total</p><p className="mt-1 font-black text-slate-900 dark:text-white">{formatCurrency(safeMoney(order.total))}</p></div>
                    <div className="col-span-2 rounded-2xl bg-white p-3 dark:bg-slate-950 sm:col-span-1"><p className="text-xs font-bold text-slate-500">Pagamento</p><p className="mt-1 truncate font-black text-slate-900 dark:text-white">{paymentMethodLabel(order.paymentMethod)}</p></div>
                  </div>
                </div>
                {estimate && <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-black text-orange-800 dark:bg-slate-950 dark:text-orange-200"><Clock3 className="h-4 w-4" />{estimate}</p>}
              </div>

              <div className="p-5 sm:p-7">
                {order.status === 'CANCELED' ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><CircleAlert className="h-6 w-6 shrink-0" />Este pedido foi cancelado.</div>
                ) : (
                  <div aria-label="Etapas do pedido" className="relative grid gap-0 md:grid-cols-4">
                    {steps.map(({ key, title, Icon }, index) => {
                      const active = index <= trackingIndex;
                      const current = index === trackingIndex;
                      return (
                        <div key={key} className="relative flex min-h-20 gap-4 pb-5 last:pb-0 md:block md:min-h-0 md:pb-0 md:text-center">
                          {index < steps.length - 1 && <div className={`absolute left-[23px] top-12 h-[calc(100%-2.25rem)] w-1 md:left-1/2 md:top-6 md:h-1 md:w-full ${index < trackingIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                          <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 shadow-sm md:mx-auto ${active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-900'} ${current ? 'ring-4 ring-emerald-100 dark:ring-emerald-900/50' : ''}`}><Icon className="h-5 w-5" /></div>
                          <div className="pt-1 md:pt-3"><p className={`font-black ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{title}</p><p className="mt-1 text-xs font-semibold text-slate-400">{current ? 'Etapa atual' : active ? 'Concluído' : 'Aguardando'}</p></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {deliveryDetails && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30"><div className="flex items-start gap-3"><Bike className="mt-0.5 h-7 w-7 shrink-0 text-sky-700 dark:text-sky-300" /><div><h3 className="font-black text-sky-950 dark:text-sky-100">Entregador a caminho</h3><p className="mt-1 text-sm font-semibold text-sky-900 dark:text-sky-200">Seu pedido já saiu da loja{deliveryDetails.driverName ? ` com ${deliveryDetails.driverName}` : ''}.{deliveryDetails.departedAt ? ` Saída às ${deliveryDetails.departedAt}.` : ''}</p></div></div></div>}

            <PaymentCard order={order} />

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950 dark:text-white">Itens do pedido</h3><p className="text-sm text-slate-500 dark:text-slate-400">Tudo o que você escolheu</p></div><ShoppingBag className="h-7 w-7 text-orange-600" /></div>
              {items.length > 0 ? <div className="space-y-3">{items.map((item, index) => <article key={safeText(item.id, String(index))} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-black text-slate-950 dark:text-white"><span className="mr-2 inline-flex min-w-7 justify-center rounded-lg bg-orange-100 px-2 py-1 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">{Number(item.quantity) || 1}x</span>{safeText(item.displayName || item.product?.name, 'Item do pedido')}</p><ItemDetails item={item} /></div><p className="shrink-0 font-black text-slate-950 dark:text-white sm:text-right">{formatCurrency(safeMoney(item.total))}</p></article>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">Os detalhes dos itens não estão disponíveis neste momento.</p>}
            </div>

            {!isPickup && safeText(order.street) && <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><div><h3 className="font-black text-slate-900 dark:text-white">Local de entrega</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{[safeText(order.street), safeText(order.number), safeText(order.neighborhood)].filter(Boolean).join(', ')}</p></div></div>}
          </section>
        )}
      </div>
    </main>
  );
}
