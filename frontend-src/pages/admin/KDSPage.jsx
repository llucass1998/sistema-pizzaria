import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, PackageCheck, Play, RefreshCw, Send, Truck } from 'lucide-react';
import { StatusBadge } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

function getToken() {
  const data = window.localStorage.getItem('pizzaria-admin');
  return data ? JSON.parse(data).token : '';
}

function optionLabel(option) {
  if (!option) return '';
  const type =
    option.stockImpactType === 'REMOVE_INGREDIENT'
      ? 'remover'
      : option.stockImpactType === 'REPLACE_INGREDIENT'
        ? 'trocar'
        : 'adicional';
  return `${option.name}${option.stockImpactType && option.stockImpactType !== 'NO_STOCK_IMPACT' ? ` (${type})` : ''}`;
}

function OrderCard({ order, onAction, isBusy }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">#{order.number}</h3>
            <StatusBadge status={order.status} />
            {order.isDelayed ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700">
                Atrasado
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {order.customer?.name ?? 'Cliente'} · {order.origin} · {order.fulfillmentType}
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm font-black text-slate-500">
          <Clock size={16} />
          {order.elapsedMinutes}m
        </div>
      </div>

      {order.notes ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
          {order.notes}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-slate-900 dark:text-white">
                  {item.quantity}x {item.displayName}
                </p>
                {item.customizations ? (
                  <p className="mt-1 text-sm font-bold text-slate-500">{item.customizations}</p>
                ) : null}
                {item.halfAndHalf ? (
                  <p className="mt-1 text-xs font-black uppercase text-indigo-600">Meia-meia</p>
                ) : null}
                {item.options?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.options.map((option) => (
                      <span
                        key={option.id}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {optionLabel(option)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isBusy || item.kdsStatus === 'READY'}
                onClick={() => onAction(`/items/${item.id}/ready`)}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                <PackageCheck size={16} />
                Pronto
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={isBusy || order.status !== 'PENDING'}
          onClick={() => onAction(`/orders/${order.id}/start`)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          <Play size={16} />
          Iniciar
        </button>
        <button
          type="button"
          disabled={isBusy || !order.allItemsReady}
          onClick={() => onAction(`/orders/${order.id}/ready`)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-300 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700"
        >
          <ChefHat size={16} />
          Pedido pronto
        </button>
        <button
          type="button"
          disabled={isBusy || order.fulfillmentType !== 'DELIVERY' || !order.readyForExpedition}
          onClick={() => onAction(`/orders/${order.id}/dispatch`)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 text-sm font-black text-white transition hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          <Send size={16} />
          Despachar
        </button>
      </div>
    </article>
  );
}

export function KDSPage() {
  const [queue, setQueue] = useState({ kitchenQueue: [], expeditionQueue: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [, setTick] = useState(0);
  const { showError, showSuccess } = useToast();

  async function loadQueue() {
    const response = await fetch(`${API_BASE_URL}/admin/kds/queue`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Falha ao carregar KDS.');
    setQueue(await response.json());
  }

  useEffect(() => {
    let isMounted = true;
    loadQueue()
      .catch((error) => showError(error.message))
      .finally(() => isMounted && setIsLoading(false));
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const kitchenQueue = useMemo(() => queue.kitchenQueue ?? [], [queue]);
  const expeditionQueue = useMemo(() => queue.expeditionQueue ?? [], [queue]);

  async function runAction(path) {
    try {
      setBusyAction(path);
      const response = await fetch(`${API_BASE_URL}/admin/kds${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Acao nao concluida.');
      await loadQueue();
      showSuccess('KDS atualizado.');
    } catch (error) {
      showError(error.message);
    } finally {
      setBusyAction('');
    }
  }

  if (isLoading) {
    return <div className="p-8 text-sm font-bold text-slate-500">Carregando KDS...</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">KDS</h2>
          <p className="text-sm font-bold text-slate-500">Cozinha e expedição em tempo real</p>
        </div>
        <button
          type="button"
          onClick={() => loadQueue().catch((error) => showError(error.message))}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-500">
            <ChefHat size={18} />
            Cozinha ({kitchenQueue.length})
          </div>
          <div className="space-y-4">
            {kitchenQueue.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAction={runAction}
                isBusy={Boolean(busyAction)}
              />
            ))}
            {kitchenQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-800">
                Nenhum pedido na cozinha.
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-500">
            <Truck size={18} />
            Expedição ({expeditionQueue.length})
          </div>
          <div className="space-y-4">
            {expeditionQueue.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAction={runAction}
                isBusy={Boolean(busyAction)}
              />
            ))}
            {expeditionQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-800">
                Nenhum pedido pronto para expedição.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
