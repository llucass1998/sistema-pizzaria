import React, { useState, useEffect } from 'react';
import { Search, Package, CheckCircle2, ChefHat, Truck, Store, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../data/menuData.js';
import { useCartStore } from '../store/useCartStore.js';

export default function OrderStatusPage() {
  const [identifier, setIdentifier] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const storeSettings = useCartStore((state) => state.storeSettings);
  const store = useCartStore((state) => state.store);

  useEffect(() => {
    const hashPath = window.location.hash.replace(/^#/, '') || '/';
    const [pathOnly, queryString = ''] = hashPath.split('?');
    const queryId = new URLSearchParams(queryString).get('id');
    const pathId = pathOnly.startsWith('/order/') ? pathOnly.split('/')[2] : '';
    const id = pathId || queryId;

    if (id) {
      setIdentifier(id);
      fetchOrderById(id);
    }
  }, []);

  const deliveryTrackingSteps = [
    { key: 'PENDING', title: 'Pedido feito', Icon: Package },
    { key: 'PREPARING', title: 'Preparando', Icon: ChefHat },
    { key: 'OUT_FOR_DELIVERY', title: 'Enviado', Icon: Truck },
    { key: 'DELIVERED', title: 'Entregue', Icon: CheckCircle2 },
  ];

  const pickupTrackingSteps = [
    { key: 'PENDING', title: 'Pedido feito', Icon: Package },
    { key: 'PREPARING', title: 'Preparando', Icon: ChefHat },
    { key: 'READY', title: 'Pronto p/ retirar', Icon: Store },
    { key: 'DELIVERED', title: 'Entregue', Icon: CheckCircle2 },
  ];

  async function handleSearch(e) {
    if (e) e.preventDefault();
    if (!identifier.trim()) return;
    fetchOrderById(identifier.trim());
  }

  async function fetchOrderById(idToSearch) {
    setIsLoading(true);
    setError('');
    setOrder(null);

    try {
      const tenantId = storeSettings?.tenantId || store?.tenantId || '';
      const response = await fetch(
        `/api/pedidos/rastrear/${encodeURIComponent(idToSearch)}`,
        tenantId
          ? {
              headers: {
                'x-tenant-id': tenantId,
              },
            }
          : undefined,
      );

      if (!response.ok) {
        throw new Error('Pedido não encontrado para o número informado.');
      }

      const data = await response.json();
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Erro ao buscar pedido.');
    } finally {
      setIsLoading(false);
    }
  }

  function formatTrackingDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function getOrderStatusLabel(status) {
    const map = {
      PENDING: 'Pendente',
      PREPARING: 'Preparando',
      READY: 'Pronto para retirar',
      OUT_FOR_DELIVERY: 'Saiu para entrega',
      DELIVERED: 'Concluído',
      CANCELED: 'Cancelado',
    };
    return map[status] || status;
  }

  function getFulfillmentLabel(type) {
    return type === 'DELIVERY' ? 'Entrega' : 'Retirada';
  }

  function safeMoney(value) {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  const currentTrackingSteps =
    order?.fulfillmentType === 'PICKUP' ? pickupTrackingSteps : deliveryTrackingSteps;

  let trackingIndex = 0;
  if (order) {
    if (order.status === 'PREPARING') trackingIndex = 1;
    if (order.status === 'READY' || order.status === 'OUT_FOR_DELIVERY') trackingIndex = 2;
    if (order.status === 'DELIVERED') trackingIndex = 3;
    if (order.status === 'CANCELED') trackingIndex = -1;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <a
        href="#/"
        className="back-to-menu-button mb-6 inline-flex max-w-full items-center justify-center gap-2 rounded-lg bg-orange-50 px-4 py-2 font-bold text-orange-700 transition hover:bg-orange-100"
      >
        <ArrowLeft size={18} />
        Voltar ao cardápio
      </a>

      <section className="mb-8 rounded-2xl border-2 border-orange-200 bg-white dark:bg-slate-900 p-4 shadow-xl sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            Rastrear Pedido
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Acompanhe o status do seu pedido em tempo real.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Digite o ID do pedido ou Telefone"
            className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 font-medium focus:border-orange-500 focus:bg-white dark:bg-slate-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !identifier.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50 sm:px-8"
          >
            <Search size={20} />
            {isLoading ? 'Buscando...' : 'Procurar'}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-600 font-semibold border border-red-100">
            {error}
          </div>
        )}
      </section>

      {order && (
        <section className="rounded-2xl border-2 border-orange-200 bg-white dark:bg-slate-900 p-4 shadow-xl sm:p-6">
          <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
            <div className="border-l-4 border-slate-300 dark:border-slate-700 pl-3">
              <p className="text-xs font-bold uppercase text-slate-500">
                {getOrderStatusLabel(order.status)}
              </p>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                #{order.id.slice(-6).toUpperCase()}
              </p>
              <p className="text-sm text-slate-500">
                {getFulfillmentLabel(order.fulfillmentType)} - {formatCurrency(order.total)}
              </p>
            </div>
          </div>

          {order.status !== 'CANCELED' ? (
            <div className="overflow-x-auto pb-6">
              <div className="relative min-w-[520px] px-3 pt-4">
                <div className="absolute left-10 right-10 top-10 grid grid-cols-3">
                  {currentTrackingSteps.slice(0, -1).map((step, index) => (
                    <div
                      key={step.key}
                      className={`h-1 ${index < trackingIndex ? 'bg-green-700' : 'bg-slate-200'}`}
                    />
                  ))}
                </div>

                <div className="relative grid grid-cols-4">
                  {currentTrackingSteps.map(({ key, title, Icon }, index) => {
                    const isActive = index <= trackingIndex;

                    return (
                      <div key={key} className="flex flex-col items-center text-center">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-sm ${
                            isActive
                              ? 'border-green-700 bg-green-700 text-white'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <Icon size={22} />
                        </div>
                        <p
                          className={`mt-3 max-w-28 text-sm font-semibold ${
                            isActive ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {isActive ? formatTrackingDate(order.createdAt) : 'Aguardando'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-lg bg-red-50 p-6 text-center text-red-700 font-bold">
              Este pedido foi cancelado.
            </div>
          )}

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">
              Pagamento
            </h3>
            {order.paymentStatus === 'PARTIALLY_PAID' ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-black">Entrada paga</p>
                <p className="mt-1 text-sm font-semibold">
                  Voce ja pagou {formatCurrency(safeMoney(order.amountPaid || order.depositAmount))}
                  . Falta pagar{' '}
                  {formatCurrency(safeMoney(order.amountDue || order.remainingAmount))} na{' '}
                  {order.fulfillmentType === 'DELIVERY' ? 'entrega' : 'retirada'}.
                </p>
                <p className="mt-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                  {order.fulfillmentType === 'DELIVERY'
                    ? 'Pague o restante ao entregador.'
                    : 'Pague o restante no balcao.'}
                </p>
              </div>
            ) : order.paymentStatus === 'PAID' ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                Pedido pago integralmente.
              </p>
            ) : (
              <p className="mt-3 rounded-lg border border-slate-200 bg-white p-4 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                Pagamento aguardando confirmacao.
              </p>
            )}
          </div>

          <div className="border-t-2 border-orange-200 pt-6">
            <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
              Itens do Pedido
            </h3>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.quantity}x {item.displayName || item.product?.name || 'Item'}
                    </p>
                    {item.customizations && (
                      <p className="text-sm text-orange-700">{item.customizations}</p>
                    )}
                  </div>
                  <p className="font-bold text-slate-900 dark:text-slate-100 sm:text-right">
                    {formatCurrency(item.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
