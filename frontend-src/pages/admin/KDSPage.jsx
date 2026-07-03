import { useEffect, useMemo, useState, useRef } from 'react';
import {
  ChefHat,
  Clock,
  PackageCheck,
  Play,
  RefreshCw,
  Send,
  Truck,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Filter,
} from 'lucide-react';
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

const STATION_LABELS = {
  GENERAL: 'Geral',
  OVEN: 'Forno',
  ASSEMBLY: 'Montagem',
  BEVERAGE: 'Bebidas',
  DESSERT: 'Sobremesas',
};

const STATIONS_LIST = [
  { id: '', label: 'Geral (Todos)' },
  { id: 'OVEN', label: '🍕 Forno' },
  { id: 'ASSEMBLY', label: '🍔 Montagem' },
  { id: 'BEVERAGE', label: '🥤 Bebidas' },
  { id: 'DESSERT', label: '🍰 Sobremesas' },
  { id: 'GENERAL', label: '📋 Praça Geral' },
];

function playNewOrderBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // ignorar falha de áudio se bloqueada pelo navegador ou sem interação inicial
  }
}

function OrderCard({ order, onAction, isBusy }) {
  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm transition dark:bg-slate-900 ${
        order.isDelayed
          ? 'border-rose-300 ring-2 ring-rose-500/20 dark:border-rose-900'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">#{order.number}</h3>
            <StatusBadge status={order.status} />
            {order.isDelayed ? (
              <span className="animate-pulse rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300">
                ⚠️ Atrasado
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {order.customer?.name ?? 'Cliente'} · {order.origin} · {order.fulfillmentType}
          </p>
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-black ${
            order.isDelayed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
          }`}
        >
          <Clock size={16} />
          {order.elapsedMinutes}m
        </div>
      </div>

      {order.notes ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {order.notes}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {order.items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border p-3 transition ${
              item.isDelayed
                ? 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
                : 'border-slate-100 dark:border-slate-800'
            }`}
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
                  <p className="mt-1 text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                    Meia-meia
                  </p>
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

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.kdsStation ? (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {STATION_LABELS[item.kdsStation] || item.kdsStation}
                    </span>
                  ) : null}
                  {item.isDelayed ? (
                    <span className="animate-pulse rounded bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-700 dark:bg-red-950 dark:text-red-300">
                      ⏱️ SLA {item.prepTimeMinutes}m Excedido ({item.elapsedMinutes}m)
                    </span>
                  ) : item.prepTimeMinutes ? (
                    <span className="text-[11px] font-bold text-slate-400">
                      ⏱️ {item.elapsedMinutes}m / {item.prepTimeMinutes}m
                    </span>
                  ) : null}
                </div>
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
  const [selectedStation, setSelectedStation] = useState('');
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('kds_muted') === 'true');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevOrderIds = useRef(new Set());
  const [, setTick] = useState(0);
  const { showError, showSuccess } = useToast();

  async function loadQueue(station = selectedStation) {
    const query = station ? `?station=${station}` : '';
    const response = await fetch(`${API_BASE_URL}/admin/kds/queue${query}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) throw new Error('Falha ao carregar KDS.');
    const data = await response.json();

    const newKitchen = data.kitchenQueue ?? [];
    const newIds = newKitchen.map((o) => o.id);

    if (!isMuted && prevOrderIds.current.size > 0) {
      const hasNewOrder = newIds.some((id) => !prevOrderIds.current.has(id));
      if (hasNewOrder) {
        playNewOrderBeep();
      }
    }
    prevOrderIds.current = new Set(newIds);
    setQueue(data);
  }

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    loadQueue(selectedStation)
      .catch((error) => showError(error.message))
      .finally(() => isMounted && setIsLoading(false));
    return () => {
      isMounted = false;
    };
  }, [selectedStation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadQueue(selectedStation).catch(() => {});
      setTick((value) => value + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [selectedStation, isMuted]);

  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem('kds_muted', String(next));
    if (!next) playNewOrderBeep();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

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
      await loadQueue(selectedStation);
      showSuccess('KDS atualizado.');
    } catch (error) {
      showError(error.message);
    } finally {
      setBusyAction('');
    }
  }

  if (isLoading && !queue.kitchenQueue) {
    return <div className="p-8 text-sm font-bold text-slate-500">Carregando KDS...</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">KDS Multi-Praças</h2>
          <p className="text-sm font-bold text-slate-500">Cozinha e expedição por tempo e estações em tempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition ${
              isMuted
                ? 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
            title={isMuted ? 'Alerta sonoro desativado' : 'Alerta sonoro ativado'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span className="hidden sm:inline">{isMuted ? 'Mudo' : 'Som Ativo'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            title="Tela Cheia"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
          </button>

          <button
            type="button"
            onClick={() => loadQueue(selectedStation).catch((error) => showError(error.message))}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Abas de filtro de Praça */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2 mr-2 text-sm font-black text-slate-400">
          <Filter size={16} />
          <span>Praça:</span>
        </div>
        {STATIONS_LIST.map((station) => (
          <button
            key={station.id}
            type="button"
            onClick={() => setSelectedStation(station.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-black transition ${
              selectedStation === station.id
                ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {station.label}
          </button>
        ))}
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
                Nenhum pedido na cozinha {selectedStation ? `para a praça selecionada` : ''}.
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
