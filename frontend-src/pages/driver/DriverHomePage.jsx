import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route,
} from 'lucide-react';
import { getDriverOrders } from './driverApi.js';

function money(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildAddress(order) {
  return [order.street, order.number, order.neighborhood].filter(Boolean).join(', ');
}

function statusLabel(status) {
  if (status === 'DELIVERED') return 'Entregue';
  if (status === 'OUT_FOR_DELIVERY') return 'Em rota';
  return status || 'Pendente';
}

export default function DriverHomePage() {
  const { profile } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  async function loadOrders() {
    try {
      setError('');
      setIsLoading(true);
      setOrders(await getDriverOrders());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar entregas.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const timer = window.setInterval(loadOrders, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status === 'OUT_FOR_DELIVERY'),
    [orders],
  );
  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status === 'DELIVERED'),
    [orders],
  );

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-red-600 to-orange-500 p-5 shadow-2xl shadow-red-950/40">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-white/70">Turno atual</p>
        <h1 className="mt-1 text-3xl font-black">Olá, {profile?.driver?.name || 'entregador'}</h1>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase text-white/70">Em rota</p>
            <p className="text-3xl font-black">{activeOrders.length}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase text-white/70">Entregues</p>
            <p className="text-3xl font-black">{deliveredOrders.length}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">Minhas entregas</h2>
        <button
          type="button"
          onClick={loadOrders}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          <AlertTriangle size={20} />
          {error}
        </div>
      ) : null}

      {isLoading && orders.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm font-bold text-white/60">
          Carregando entregas...
        </div>
      ) : null}

      {!isLoading && orders.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <PackageCheck className="mx-auto mb-3 text-white/40" size={42} />
          <h3 className="text-lg font-black">Nenhuma entrega atribuída agora</h3>
          <p className="mt-2 text-sm font-bold text-white/50">
            Quando o despacho enviar um pedido para você, ele aparece aqui.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {orders.map((order) => {
          const address = buildAddress(order);
          return (
            <Link
              key={order.id}
              to={`/motoboy/orders/${order.id}`}
              className="block rounded-3xl border border-white/10 bg-white p-4 text-slate-950 shadow-xl transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Pedido #{order.id.slice(0, 8)}
                  </p>
                  <h3 className="mt-1 text-xl font-black">{order.customer?.name || 'Cliente'}</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}
                >
                  {statusLabel(order.status)}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
                <p className="flex items-center gap-2">
                  <MapPin size={16} /> {address || 'Endereço não informado'}
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={16} /> Criado em {new Date(order.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-lg font-black">{money(order.total)}</span>
                <span className="flex items-center gap-2 text-sm font-black text-red-600">
                  {order.status === 'DELIVERED' ? <CheckCircle2 size={18} /> : <Route size={18} />}
                  Ver detalhes
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
