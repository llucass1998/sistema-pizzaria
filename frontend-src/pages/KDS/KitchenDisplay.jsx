import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ChefHat,
  Clock,
  Flame,
  RefreshCw,
  Send,
  Timer,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from 'lucide-react';
import ERPLayout from '../../components/ERPLayout.jsx';

const savedAdminKey = 'pizzaria-admin';

const fallbackOrders = [
  {
    id: '1042',
    table: 'Mesa 4',
    status: 'PREPARING',
    fulfillmentType: 'PICKUP',
    createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
    items: [
      { displayName: 'Pizza Calabresa (G)', quantity: 1 },
      { displayName: 'Refrigerante 2L', quantity: 1 },
    ],
  },
  {
    id: '1043',
    table: 'iFood #92',
    status: 'PENDING',
    fulfillmentType: 'DELIVERY',
    createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    items: [{ displayName: 'Pizza Margherita (M)', quantity: 1, customizations: 'Sem cebola' }],
  },
  {
    id: '1044',
    table: 'Balcao',
    status: 'READY',
    fulfillmentType: 'PICKUP',
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    items: [{ displayName: 'Combo Casal', quantity: 1 }],
  },
];

const columns = [
  {
    id: 'PENDING',
    title: 'Fila',
    subtitle: 'Novos pedidos',
    Icon: Clock,
    accent: 'amber',
  },
  {
    id: 'PREPARING',
    title: 'Producao',
    subtitle: 'Em preparo',
    Icon: UtensilsCrossed,
    accent: 'orange',
  },
  {
    id: 'READY',
    title: 'Pronto',
    subtitle: 'Aguardando retirada',
    Icon: CheckSquare,
    accent: 'emerald',
  },
];

function getSavedAdminSession() {
  try {
    return JSON.parse(window.localStorage.getItem(savedAdminKey) ?? 'null');
  } catch (error) {
    
    return null;
  }
}

function getOrderLocation(order) {
  if (order.table) return order.table;
  const firstNotePart = String(order.notes ?? '')
    .split('|')[0]
    ?.trim();
  if (firstNotePart) return firstNotePart;
  return order.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Balcao';
}

function getElapsedMinutes(order, now) {
  const createdAt = new Date(order.createdAt ?? Date.now()).getTime();
  return Math.max(0, Math.floor((now - createdAt) / 60000));
}

function getTimerConfig(minutes) {
  if (minutes >= 30) {
    return {
      className: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
      bar: 'bg-rose-400',
      label: 'Atrasado',
    };
  }

  if (minutes >= 18) {
    return {
      className: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
      bar: 'bg-amber-300',
      label: 'Atencao',
    };
  }

  return {
    className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    bar: 'bg-emerald-400',
    label: 'No prazo',
  };
}

function getNextStatus(order) {
  if (order.status === 'PENDING') {
    return { status: 'PREPARING', label: 'Iniciar preparo', Icon: Flame };
  }

  if (order.status === 'PREPARING') {
    return { status: 'READY', label: 'Marcar pronto', Icon: CheckSquare };
  }

  if (order.status === 'READY') {
    return {
      status: order.fulfillmentType === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'DELIVERED',
      label: order.fulfillmentType === 'DELIVERY' ? 'Despachar' : 'Entregar',
      Icon: Send,
    };
  }

  return null;
}

export default function KitchenDisplay({ apiBaseUrl }) {
  const [session] = useState(getSavedAdminSession);
  const [orders, setOrders] = useState(fallbackOrders);
  const [previousOrderIds, setPreviousOrderIds] = useState(new Set(fallbackOrders.map(o => o.id)));
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('/audio/beep.mp3');
      audio.play().catch((err) => {
        console.warn('Falha ao tocar /audio/beep.mp3, tentando som sintetico.', err);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      });
    } catch (e) {
      // Ignorar erros se Audio nao suportado
    }
  }, [soundEnabled]);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.token ?? ''}`,
    }),
    [session?.token],
  );

  const visibleOrders = useMemo(
    () => orders.filter((order) => ['PENDING', 'PREPARING', 'READY'].includes(order.status)),
    [orders],
  );

  const loadOrders = useCallback(async () => {
    setError('');

    if (!session?.token) {
      setError('Entre como administrador para sincronizar o KDS com os pedidos reais.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/pedidos?limit=100`, {
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Nao foi possivel carregar os pedidos.');
      }

      const nextOrders = Array.isArray(data) ? data : (data.data ?? []);
      
      // Checar novos pedidos PENDING
      setPreviousOrderIds((prevIds) => {
        const currentPending = nextOrders.filter(o => o.status === 'PENDING').map(o => o.id);
        const hasNew = currentPending.some(id => !prevIds.has(id));
        if (hasNew) {
          playBeep();
        }
        return new Set(nextOrders.map(o => o.id));
      });

      setOrders(nextOrders);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os pedidos.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, authHeaders, session?.token, playBeep]);

  async function updateOrderStatus(order, status) {
    if (!session?.token) {
      setError('Entre como administrador para atualizar pedidos.');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      const response = await fetch(`${apiBaseUrl}/pedidos/${order.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Nao foi possivel atualizar o pedido.');
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) => (currentOrder.id === order.id ? data : currentOrder)),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'Nao foi possivel atualizar o pedido.',
      );
    } finally {
      setUpdatingOrderId('');
    }
  }

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    // Polling a cada 15 segundos
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
      loadOrders();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [loadOrders]);

  return (
    <ERPLayout activeTab="kds">
      <div className="flex min-h-[calc(100vh-8rem)] flex-col space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-orange-300">Kitchen command</p>
            <h2 className="mt-1 flex items-center gap-3 text-3xl font-black tracking-tight text-white">
              <ChefHat className="text-orange-300" size={32} />
              KDS em tempo real
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-400">
              Fila da cozinha com tempo de preparo, itens e mudanca rapida de etapa.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition ${
                soundEnabled 
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' 
                  : 'border-white/10 bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]'
              }`}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              Som {soundEnabled ? 'Ativo' : 'Mutado'}
            </button>
            <div className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white">
              <Clock size={18} className="text-sky-300" />
              {new Intl.DateTimeFormat('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(now))}
            </div>
            <button
              type="button"
              onClick={loadOrders}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-slate-200 transition hover:border-orange-300/40 hover:bg-orange-300/10"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100">
            {error}
          </div>
        ) : null}

        <section className="grid flex-1 gap-5 lg:grid-cols-3">
          {columns.map((column) => {
            const Icon = column.Icon;
            const columnOrders = visibleOrders.filter((order) => order.status === column.id);

            return (
              <div
                key={column.id}
                className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.05] shadow-2xl shadow-black/20 backdrop-blur sm:min-h-[520px]"
              >
                <div className="border-b border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${getColumnIconClass(column.accent)}`}
                      >
                        <Icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-white">{column.title}</h3>
                        <p className="text-xs font-bold uppercase text-slate-500">
                          {column.subtitle}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-black text-slate-300">
                      {columnOrders.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {columnOrders.length === 0 ? (
                    <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/10 text-center">
                      <CheckSquare size={36} className="mb-3 text-slate-700 dark:text-slate-300" />
                      <p className="text-sm font-black uppercase text-slate-600 dark:text-slate-400">Sem pedidos</p>
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        now={now}
                        isUpdating={updatingOrderId === order.id}
                        onUpdateStatus={updateOrderStatus}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </ERPLayout>
  );
}

function getColumnIconClass(accent) {
  const classes = {
    amber: 'border border-amber-300/20 bg-amber-300/10 text-amber-200',
    orange: 'border border-orange-300/20 bg-orange-300/10 text-orange-200',
    emerald: 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  };

  return classes[accent] ?? classes.orange;
}

function OrderCard({ order, now, isUpdating, onUpdateStatus }) {
  const minutes = getElapsedMinutes(order, now);
  const timer = getTimerConfig(minutes);
  const nextAction = getNextStatus(order);
  const ActionIcon = nextAction?.Icon;
  const progress = Math.min(100, (minutes / 30) * 100);

  return (
    <article className="rounded-lg border border-white/10 bg-[#111722] p-4 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-orange-300/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-xl font-black text-white">{getOrderLocation(order)}</h4>
          <p className="mt-1 text-xs font-bold uppercase text-slate-500">
            #{String(order.id).slice(0, 8)} -{' '}
            {order.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Retirada'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${timer.className}`}
        >
          {minutes >= 30 ? <AlertTriangle size={14} /> : <Timer size={14} />}
          {minutes} min
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${timer.bar}`} style={{ width: `${progress}%` }} />
      </div>

      <ul className="mt-4 space-y-2">
        {(order.items ?? []).map((item, index) => (
          <li key={item.id ?? index} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-start gap-3">
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-sm font-black text-white">
                {item.quantity}x
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold leading-tight text-slate-100">
                  {item.displayName ?? item.product?.name ?? item.name}
                </p>
                {item.customizations ? (
                  <p className="mt-2 text-sm font-bold text-rose-200">{item.customizations}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${timer.className}`}>
          {timer.label}
        </span>

        {nextAction ? (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onUpdateStatus(order, nextAction.status)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-400 px-4 text-sm font-black text-slate-950 dark:text-slate-50 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ActionIcon ? <ActionIcon size={17} /> : null}
            {isUpdating ? 'Salvando' : nextAction.label}
          </button>
        ) : null}
      </div>
    </article>
  );
}
