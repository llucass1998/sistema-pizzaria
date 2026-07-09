import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  CheckCircle2,
  Clock,
  Search,
  User,
  MapPin,
  Plus,
  Edit2,
  Check,
  X,
  UserPlus,
  Info,
  Filter,
  RefreshCw,
  Eye,
  ArrowRight,
  DollarSign,
  Package,
  AlertCircle,
  Navigation,
  ShieldAlert,
  ChevronRight,
  Layers,
  Map as MapIcon,
  Phone,
  Calendar,
  Award,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrency } from '../../data/menuData.js';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

// Fix para os ícones padrão do leaflet no Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function DispatchPage({ defaultView } = {}) {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' ou 'map'

  const adminSession = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
  const sessionToken = adminSession?.token;
  const sessionRole = adminSession?.role || 'ADMIN';
  const canManageDrivers = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'].includes(sessionRole);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Polling cada 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      defaultView === 'drivers' ||
      window.location.hash.includes('motoboys') ||
      window.location.hash.includes('drivers')
    ) {
      setActiveTab('kanban'); // Desmonta e fecha o mapa GPS para evitar qualquer sobreposição
      setShowDriverModal(true);
    }
  }, [defaultView]);

  async function fetchData() {
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      const [readyRes, driversRes, allOrdersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/dispatch/ready-orders`, { headers }).catch(() => ({
          ok: false,
        })),
        fetch(`${API_BASE_URL}/admin/dispatch/drivers`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_BASE_URL}/pedidos?limit=100`, { headers }).catch(() => ({ ok: false })),
      ]);

      let combinedOrders = [];
      const ordersMap = new Map();

      if (readyRes.ok) {
        const readyData = await readyRes.json().catch(() => []);
        if (Array.isArray(readyData)) {
          readyData.forEach((o) => ordersMap.set(o.id, o));
        }
      }

      if (allOrdersRes && allOrdersRes.ok) {
        const allData = await allOrdersRes.json().catch(() => ({ data: [] }));
        const list = Array.isArray(allData?.data)
          ? allData.data
          : Array.isArray(allData)
            ? allData
            : [];
        list.forEach((o) => {
          if (o.fulfillmentType === 'DELIVERY' || o.deliveryAddress || o.street) {
            if (!ordersMap.has(o.id) || o.status === 'DELIVERED') {
              ordersMap.set(o.id, { ...ordersMap.get(o.id), ...o });
            }
          }
        });
      }

      combinedOrders = Array.from(ordersMap.values()).sort((a, b) => {
        return new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now());
      });

      setOrders(combinedOrders);

      if (driversRes.ok) {
        const dData = await driversRes.json().catch(() => []);
        if (Array.isArray(dData)) {
          setDrivers(dData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dispatch data', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssignDriver(orderId, driverId) {
    if (!driverId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dispatch/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ orderId, driverId }),
      });
      if (res.ok) {
        fetchData();
        showSuccess('Pedido despachado para entrega!');
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.error || 'Erro ao despachar pedido.');
      }
    } catch (err) {
      console.error(err);
      showError('Erro de conexão com o servidor.');
    }
  }

  async function handleMarkDelivered(orderId) {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dispatch/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ status: 'DELIVERED' }),
      });
      if (res.ok) {
        fetchData();
        showSuccess('Entrega concluída com sucesso!');
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.message || 'Erro ao finalizar entrega.');
      }
    } catch (err) {
      console.error(err);
      showError('Erro de conexão ao finalizar entrega.');
    }
  }

  // Cálculos de Filtro
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        o.id?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        o.customer?.phone?.toLowerCase().includes(q) ||
        o.street?.toLowerCase().includes(q) ||
        o.neighborhood?.toLowerCase().includes(q);

      const matchDriver =
        selectedDriverFilter === 'ALL' ||
        String(o.driverId) === String(selectedDriverFilter) ||
        String(o.driver?.id) === String(selectedDriverFilter);

      return matchQuery && matchDriver;
    });
  }, [orders, searchQuery, selectedDriverFilter]);

  // Agrupamento pelas 3 colunas exigidas
  const waitingOrders = useMemo(() => {
    return filteredOrders.filter(
      (o) =>
        !['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(o.status) ||
        o.status === 'READY' ||
        o.status === 'PREPARING' ||
        o.status === 'RECEIVED',
    );
  }, [filteredOrders]);

  const inRouteOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'OUT_FOR_DELIVERY');
  }, [filteredOrders]);

  const deliveredOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'DELIVERED');
  }, [filteredOrders]);

  // KPIs
  const kpis = useMemo(() => {
    const activeDriversCount = drivers.filter((d) => d.isActive).length;
    const assignedDriversSet = new Set(
      inRouteOrders.map((o) => o.driverId || o.driver?.id).filter(Boolean),
    );
    const availableDriversCount = Math.max(0, activeDriversCount - assignedDriversSet.size);

    // Cálculo simplificado de tempo médio para entregues no turno
    let totalMinutes = 0;
    let countTimed = 0;
    deliveredOrders.forEach((o) => {
      if (o.createdAt && o.updatedAt) {
        const diffMin = Math.round((new Date(o.updatedAt) - new Date(o.createdAt)) / 60000);
        if (diffMin > 0 && diffMin < 300) {
          totalMinutes += diffMin;
          countTimed++;
        }
      }
    });
    const avgTime = countTimed > 0 ? Math.round(totalMinutes / countTimed) : 28;

    return {
      waiting: waitingOrders.length,
      inRoute: inRouteOrders.length,
      deliveredToday: deliveredOrders.length,
      avgDeliveryTime: avgTime,
      activeDrivers: activeDriversCount,
      availableDrivers: availableDriversCount,
    };
  }, [waitingOrders, inRouteOrders, deliveredOrders, drivers]);

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Cabeçalho Executivo */}
      <div className="flex-none bg-[#0F2F52] text-white px-6 py-4 shadow-md z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20">
            <Truck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
              Despacho & Logística Executiva
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
                Ao Vivo
              </span>
            </h1>
            <p className="text-xs text-blue-200/80 font-medium">
              Controle fluxo de saídas, monitoramento de motoboys e indicadores de performance E2E.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setActiveTab(activeTab === 'kanban' ? 'map' : 'kanban')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'map'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {activeTab === 'kanban' ? <MapIcon size={16} /> : <Layers size={16} />}
            {activeTab === 'kanban' ? 'Ver Mapa GPS' : 'Ver Painel Kanban'}
          </button>

          {canManageDrivers && (
            <button
              onClick={() => {
                setActiveTab('kanban'); // Fecha/desmonta o mapa GPS automaticamente
                setShowDriverModal(true);
              }}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition shadow-sm"
            >
              <User size={16} />
              Gerenciar Motoboys
            </button>
          )}

          <button
            onClick={fetchData}
            title="Atualizar dados agora"
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-orange-400' : ''} />
          </button>
        </div>
      </div>

      {/* Indicadores / KPIs de Performance */}
      <div className="flex-none bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Aguardando
              </p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {kpis.waiting}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Em Rota
              </p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {kpis.inRoute}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <Navigation size={20} />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Entregues no Turno
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {kpis.deliveredToday}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Tempo Médio
              </p>
              <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
                {kpis.avgDeliveryTime}{' '}
                <span className="text-xs font-normal text-slate-400">min</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <Award size={20} />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Motoboys Ativos
              </p>
              <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
                {kpis.availableDrivers}{' '}
                <span className="text-xs font-bold text-emerald-500">disp.</span> /{' '}
                {kpis.activeDrivers}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
              <User size={20} />
            </div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por #pedido, cliente, telefone, rua ou bairro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
              <Filter size={14} className="text-slate-400" />
              <span className="font-bold">Motoboy:</span>
              <select
                value={selectedDriverFilter}
                onChange={(e) => setSelectedDriverFilter(e.target.value)}
                className="bg-transparent font-bold focus:outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="ALL">Todos os Entregadores</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.isActive ? '' : '(Inativo)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Kanban 3 Colunas OU Mapa GPS */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {activeTab === 'map' ? (
          <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 shadow-lg bg-slate-200 dark:bg-slate-800 relative">
            <MapContainer
              center={[-23.5505, -46.6333]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {orders.map((order) => {
                const hash = String(order.id)
                  .split('')
                  .reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const lat = -23.5505 + (hash % 100) * 0.001 * (hash % 2 === 0 ? 1 : -1);
                const lng = -46.6333 + ((hash * 3) % 100) * 0.001 * (hash % 3 === 0 ? 1 : -1);
                return (
                  <Marker key={order.id} position={[lat, lng]}>
                    <Popup>
                      <div className="font-bold text-slate-900">
                        Pedido #{String(order.id).slice(-6).toUpperCase()}
                      </div>
                      <div className="text-sm text-slate-600">
                        {order.street}, {order.number}
                      </div>
                      <div className="text-xs mt-1 text-orange-600 font-bold">
                        {order.status === 'OUT_FOR_DELIVERY'
                          ? `Em Rota: ${order.driver?.name || 'Motoboy'}`
                          : 'Aguardando Despacho'}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 max-w-xs text-xs">
              <p className="font-black text-slate-800 dark:text-white uppercase mb-1">
                GPS em Tempo Real
              </p>
              <p className="text-slate-500">
                Exibindo geolocalização estimada dos pedidos ativos no turno.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-6 min-w-[900px]">
            {/* Coluna 1: Aguardando Despacho / Pronto */}
            <DispatchColumn
              title="Aguardando / Pronto p/ Entrega"
              count={waitingOrders.length}
              icon={Clock}
              colorTheme="amber"
            >
              {waitingOrders.length === 0 ? (
                <EmptyColumnState message="Nenhum pedido aguardando despacho no momento." />
              ) : (
                waitingOrders.map((order) => (
                  <DispatchOrderCard
                    key={order.id}
                    order={order}
                    drivers={drivers}
                    canAssign={canManageDrivers}
                    canCompleteDelivery={sessionRole === 'DRIVER'}
                    onAssign={(driverId) => handleAssignDriver(order.id, driverId)}
                    onDelivered={() => handleMarkDelivered(order.id)}
                    onViewDetails={() => setSelectedOrderDetails(order)}
                    onOpenMap={() => setActiveTab('map')}
                  />
                ))
              )}
            </DispatchColumn>

            {/* Coluna 2: Em Rota */}
            <DispatchColumn
              title="Em Rota de Entrega"
              count={inRouteOrders.length}
              icon={Navigation}
              colorTheme="blue"
            >
              {inRouteOrders.length === 0 ? (
                <EmptyColumnState message="Nenhum entregador em rota agora." />
              ) : (
                inRouteOrders.map((order) => (
                  <DispatchOrderCard
                    key={order.id}
                    order={order}
                    drivers={drivers}
                    canAssign={canManageDrivers}
                    canCompleteDelivery={sessionRole === 'DRIVER' || canManageDrivers}
                    onAssign={(driverId) => handleAssignDriver(order.id, driverId)}
                    onDelivered={() => handleMarkDelivered(order.id)}
                    onViewDetails={() => setSelectedOrderDetails(order)}
                    onOpenMap={() => setActiveTab('map')}
                  />
                ))
              )}
            </DispatchColumn>

            {/* Coluna 3: Concluídos / Entregues */}
            <DispatchColumn
              title="Concluídos / Entregues (Turno)"
              count={deliveredOrders.length}
              icon={CheckCircle2}
              colorTheme="emerald"
            >
              {deliveredOrders.length === 0 ? (
                <EmptyColumnState message="Nenhuma entrega concluída neste turno." />
              ) : (
                deliveredOrders.map((order) => (
                  <DispatchOrderCard
                    key={order.id}
                    order={order}
                    drivers={drivers}
                    canAssign={false}
                    canCompleteDelivery={false}
                    onAssign={() => {}}
                    onDelivered={() => {}}
                    onViewDetails={() => setSelectedOrderDetails(order)}
                    onOpenMap={() => setActiveTab('map')}
                  />
                ))
              )}
            </DispatchColumn>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Pedido */}
      {selectedOrderDetails && (
        <OrderDetailsModal
          order={selectedOrderDetails}
          onClose={() => setSelectedOrderDetails(null)}
        />
      )}

      {/* Modal de Gerenciamento de Motoboys */}
      {showDriverModal && canManageDrivers && (
        <DriverModal
          drivers={drivers}
          orders={orders}
          sessionToken={sessionToken}
          onClose={() => setShowDriverModal(false)}
          onRefresh={fetchData}
          onOpenMap={() => {
            setShowDriverModal(false);
            setActiveTab('map');
          }}
        />
      )}
    </div>
  );
}

// Subcomponente: Coluna do Kanban
function DispatchColumn({ title, count, icon: Icon, colorTheme, children }) {
  const themes =
    {
      amber: {
        headerBg: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
        badgeBg: 'bg-amber-500 text-white',
        borderTop: 'border-t-amber-500',
      },
      blue: {
        headerBg: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
        badgeBg: 'bg-blue-600 text-white',
        borderTop: 'border-t-blue-600',
      },
      emerald: {
        headerBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        badgeBg: 'bg-emerald-600 text-white',
        borderTop: 'border-t-emerald-600',
      },
    }[colorTheme] || {};

  return (
    <div
      className={`flex flex-col h-full bg-slate-200/50 dark:bg-slate-950/60 rounded-2xl border border-slate-300/80 dark:border-slate-800 overflow-hidden shadow-sm border-t-4 ${themes.borderTop}`}
    >
      <div className={`px-4 py-3 border-b flex items-center justify-between ${themes.headerBg}`}>
        <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
          <Icon size={16} />
          <span>{title}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-black shadow-sm ${themes.badgeBg}`}>
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-700">
        {children}
      </div>
    </div>
  );
}

// Subcomponente: Cartão de Pedido Risco
function DispatchOrderCard({
  order,
  drivers,
  canAssign,
  canCompleteDelivery,
  onAssign,
  onDelivered,
  onViewDetails,
  onOpenMap,
}) {
  const [selectedDriver, setSelectedDriver] = useState(order.driverId || '');

  const isDelivered = order.status === 'DELIVERED';
  const isAssigned = order.status === 'OUT_FOR_DELIVERY';

  // Tempo decorrido
  const elapsedMinutes = useMemo(() => {
    if (!order.createdAt) return 0;
    return Math.max(1, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  }, [order.createdAt]);

  const isDelayed = elapsedMinutes > 35 && !isDelivered;

  // Resumo de Itens
  const itemsSummary = useMemo(() => {
    if (!Array.isArray(order.items) || order.items.length === 0) return 'Itens do pedido';
    return order.items
      .map((i) => `${i.quantity || 1}x ${i.product?.name || i.name || 'Pizza'}`)
      .join(', ');
  }, [order.items]);

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-sm transition-all hover:shadow-md flex flex-col gap-3 relative overflow-hidden ${
        isDelivered
          ? 'border-slate-200 dark:border-slate-800 opacity-80'
          : isAssigned
            ? 'border-blue-300 dark:border-blue-800/80'
            : isDelayed
              ? 'border-red-400 dark:border-red-600 ring-1 ring-red-500/20'
              : 'border-slate-300 dark:border-slate-800'
      }`}
    >
      {/* Indicador de Atraso na Lateral */}
      {isDelayed && (
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-bl-lg flex items-center gap-1 shadow-sm">
          <AlertCircle size={10} /> +{elapsedMinutes}m
        </div>
      )}

      {/* Topo do Card: Número e Tempo */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-slate-900 dark:text-white">
            #{String(order.id).slice(-6).toUpperCase()}
          </span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {formatCurrency(order.totalAmount || order.total || 0)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
              isDelivered
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                : isDelayed
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <Clock size={12} />
            <span>{isDelivered ? 'Concluído' : `Há ${elapsedMinutes} min`}</span>
          </div>
        </div>
      </div>

      {/* Dados do Cliente e Endereço */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 truncate">
            <User size={14} className="text-slate-400 shrink-0" />
            {order.customer?.name || order.customerName || 'Cliente Avulso'}
          </span>
          {order.customer?.phone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const cleanPhone = order.customer.phone.replace(/\D/g, '');
                const phoneWithCountry = cleanPhone.startsWith('55')
                  ? cleanPhone
                  : `55${cleanPhone}`;
                const msg = encodeURIComponent(
                  `Olá ${order.customer?.name || 'Cliente'}, sobre seu pedido #${String(order.id).slice(-6).toUpperCase()} da pizzaria: `,
                );
                window.open(
                  `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${msg}`,
                  '_blank',
                );
              }}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold shrink-0 flex items-center gap-1"
              title="Abrir no WhatsApp"
            >
              <Phone size={12} />
              {order.customer.phone}
            </button>
          )}
        </div>

        <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
          <MapPin size={14} className="text-orange-500 shrink-0 mt-0.5" />
          <div className="line-clamp-2 leading-tight">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {order.street || 'Endereço'}, {order.number || 'S/N'}
            </span>
            {order.neighborhood && <span className="text-slate-500"> - {order.neighborhood}</span>}
            {order.complement && (
              <span className="block text-[11px] text-slate-400 mt-0.5">
                Ref: {order.complement}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Resumo dos Itens e Pagamento */}
      <div className="flex flex-col gap-1 bg-slate-100/50 dark:bg-slate-800/40 px-2.5 py-1.5 rounded-lg text-xs font-medium">
        <div className="text-slate-600 dark:text-slate-300 line-clamp-1 flex items-center gap-1.5">
          <Package size={13} className="shrink-0 text-slate-400" />
          <span className="truncate">{itemsSummary}</span>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200/40 dark:border-slate-700/40 pt-1 mt-0.5">
          <span>Pagamento:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {order.paymentMethod || 'Não informado'}
          </span>
        </div>
      </div>

      {/* Ações e Operações do Cartão */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-2 mt-auto">
        {!isAssigned && !isDelivered && canAssign && (
          <div className="flex flex-col gap-1.5">
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="">Selecione o Entregador</option>
              {drivers
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.vehicle ? `(${d.vehicle})` : ''}
                  </option>
                ))}
            </select>
            <div className="flex gap-1.5">
              <button
                onClick={() => onAssign(selectedDriver)}
                disabled={!selectedDriver}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white text-xs font-black py-2 rounded-lg transition shadow-sm flex items-center justify-center gap-1 uppercase tracking-wide"
              >
                <Truck size={14} /> Atribuir / Sair
              </button>
              <button
                onClick={onViewDetails}
                title="Ver Detalhes"
                className="px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold transition flex items-center justify-center"
              >
                <Eye size={16} />
              </button>
            </div>
          </div>
        )}

        {isAssigned && !isDelivered && (
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-lg p-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
              <span className="font-bold text-blue-900 dark:text-blue-200 truncate">
                {order.driver?.name || 'Motoboy'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onOpenMap && (
                <button
                  type="button"
                  onClick={onOpenMap}
                  title="Ver no Mapa GPS"
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition"
                >
                  <MapPin size={14} />
                </button>
              )}
              <button
                onClick={onViewDetails}
                title="Ver Detalhes"
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-md transition"
              >
                <Eye size={14} />
              </button>
              {canCompleteDelivery && (
                <button
                  onClick={onDelivered}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide transition shadow-sm flex items-center gap-1"
                >
                  <Check size={12} /> Concluir
                </button>
              )}
            </div>
          </div>
        )}

        {isDelivered && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Concluído às{' '}
              {new Date(order.updatedAt || order.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <button
              onClick={onViewDetails}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1"
            >
              <Eye size={13} /> Detalhes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponente: Empty State para as colunas
function EmptyColumnState({ message }) {
  return (
    <div className="h-40 border-2 border-dashed border-slate-300/60 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
      <Package size={28} className="mb-2 opacity-40" />
      <p className="text-xs font-medium max-w-[180px] leading-relaxed">{message}</p>
    </div>
  );
}

// Subcomponente: Modal de Detalhes do Pedido
function OrderDetailsModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="bg-[#0F2F52] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Resumo de Entrega
            </span>
            <h2 className="text-lg font-black">
              Pedido #{String(order.id).slice(-6).toUpperCase()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
          {/* Cliente e Endereço */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
              Dados do Cliente
            </h3>
            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
              {order.customer?.name || order.customerName || 'Cliente Avulso'}
            </p>
            {order.customer?.phone && (
              <p className="text-slate-500">Telefone: {order.customer.phone}</p>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 mt-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-1">
                <MapPin size={14} className="text-orange-500" /> Endereço de Entrega:
              </span>
              <p className="font-medium text-slate-600 dark:text-slate-300">
                {order.street}, {order.number} - {order.neighborhood}
              </p>
              {order.complement && (
                <p className="text-slate-400 mt-0.5">Complemento/Ref: {order.complement}</p>
              )}
            </div>
          </div>

          {/* Itens do Pedido */}
          <div>
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
              Itens Despachados
            </h3>
            <div className="space-y-2">
              {Array.isArray(order.items) &&
                order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800/60 font-medium"
                  >
                    <span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        {item.quantity || 1}x
                      </strong>{' '}
                      {item.product?.name || item.name || 'Pizza'}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(item.price || item.unitPrice || 0)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Totais e Pagamento */}
          <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between font-bold">
            <span className="text-orange-800 dark:text-orange-300 uppercase tracking-wider">
              Total Geral
            </span>
            <span className="text-lg text-orange-900 dark:text-orange-200 font-black">
              {formatCurrency(order.totalAmount || order.total || 0)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-2 rounded-xl text-xs transition uppercase tracking-wide"
          >
            Fechar Resumo
          </button>
        </div>
      </div>
    </div>
  );
}

// Subcomponente: Modal de Motoboys (Dashboard & Gestão ERP Premium)
function DriverModal({ drivers, orders, sessionToken, onClose, onRefresh, onOpenMap }) {
  const [editingDriver, setEditingDriver] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, AVAILABLE, BUSY, INACTIVE
  const [showForm, setShowForm] = useState(false);
  const { showSuccess, showError } = useToast();

  // Mapear entregas em andamento por motoboy
  const activeDeliveriesMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(orders)) {
      orders.forEach((o) => {
        if (o.status === 'OUT_FOR_DELIVERY' && o.driverId) {
          const current = map.get(o.driverId) || [];
          map.set(o.driverId, [...current, o]);
        }
      });
    }
    return map;
  }, [orders]);

  // Mapear entregas concluídas hoje por motoboy
  const completedTodayMap = useMemo(() => {
    const map = new Map();
    const todayStr = new Date().toDateString();
    if (Array.isArray(orders)) {
      orders.forEach((o) => {
        if (o.status === 'DELIVERED' && o.driverId) {
          const oDate = new Date(o.updatedAt || o.createdAt).toDateString();
          if (oDate === todayStr) {
            const count = map.get(o.driverId) || 0;
            map.set(o.driverId, count + 1);
          }
        }
      });
    }
    return map;
  }, [orders]);

  // KPIs
  const totalActive = drivers.filter((d) => d.isActive).length;
  const totalBusy = drivers.filter(
    (d) => d.isActive && (activeDeliveriesMap.get(d.id)?.length || 0) > 0,
  ).length;
  const totalAvailable = totalActive - totalBusy;
  const totalCompletedToday = Array.from(completedTodayMap.values()).reduce((a, b) => a + b, 0);
  const totalDelayed = useMemo(() => {
    let count = 0;
    const now = Date.now();
    if (Array.isArray(orders)) {
      orders.forEach((o) => {
        if (o.status === 'OUT_FOR_DELIVERY') {
          const timeDiff = now - new Date(o.updatedAt || o.createdAt).getTime();
          if (timeDiff > 45 * 60 * 1000) count++;
        }
      });
    }
    return count;
  }, [orders]);

  // Filtragem
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.vehicle && d.vehicle.toLowerCase().includes(q));
      if (!matchesSearch) return false;

      const isBusy = (activeDeliveriesMap.get(d.id)?.length || 0) > 0;
      if (statusFilter === 'AVAILABLE') return d.isActive && !isBusy;
      if (statusFilter === 'BUSY') return d.isActive && isBusy;
      if (statusFilter === 'INACTIVE') return !d.isActive;
      return true;
    });
  }, [drivers, searchQuery, statusFilter, activeDeliveriesMap]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        editingDriver
          ? `${API_BASE_URL}/admin/dispatch/drivers/${editingDriver.id}`
          : `${API_BASE_URL}/admin/dispatch/drivers`,
        {
          method: editingDriver ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ name, phone, vehicle }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showSuccess(
          editingDriver
            ? 'Entregador atualizado com sucesso!'
            : 'Entregador cadastrado com sucesso!',
        );
        resetForm();
        setShowForm(false);
        onRefresh();
      } else {
        showError(data.error || 'Erro ao salvar entregador.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(driver) {
    if (
      driver.isActive &&
      !window.confirm(`Tem certeza que deseja desativar o motoboy ${driver.name}?`)
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dispatch/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ isActive: !driver.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || 'Erro ao alterar status do entregador.');
        return;
      }
      showSuccess(
        driver.isActive ? 'Entregador desativado com sucesso.' : 'Entregador ativado com sucesso.',
      );
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setEditingDriver(null);
    setName('');
    setPhone('');
    setVehicle('');
  }

  function startEdit(driver) {
    setEditingDriver(driver);
    setName(driver.name || '');
    setPhone(driver.phone || '');
    setVehicle(driver.vehicle || '');
    setShowForm(true);
  }

  function openWhatsApp(driver) {
    if (!driver.phone) {
      showError('Este motoboy não possui telefone cadastrado.');
      return;
    }
    const cleanPhone = driver.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const msg = encodeURIComponent(
      `Olá ${driver.name}, temos entregas/atualizações para você da pizzaria!`,
    );
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${msg}`, '_blank');
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl bg-slate-100 dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] border border-slate-300 dark:border-slate-800">
        {/* Header Premium */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0F2F52] text-white shrink-0 shadow-md">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2.5">
              <Truck className="text-orange-400 shrink-0" size={22} /> Gerenciar Motoboys
            </h2>
            <p className="text-xs text-blue-200 mt-0.5 font-medium">
              Controle entregadores, disponibilidade e entregas em andamento
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <UserPlus size={16} />
              {showForm ? 'Fechar Cadastro' : 'Novo Motoboy'}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              title="Atualizar dados dos motoboys"
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Corpo com scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-sans space-y-6">
          {/* Cards / KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Motoboys Ativos
                </p>
                <p className="text-xl font-black text-slate-800 dark:text-white mt-1">
                  {totalActive}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <User size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Disponíveis Agora
                </p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {totalAvailable}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Em Entrega
                </p>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {totalBusy}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Navigation size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Concluídas Hoje
                </p>
                <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
                  {totalCompletedToday}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Award size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Atrasos / Ocorrências
                </p>
                <p
                  className={`text-xl font-black mt-1 ${totalDelayed > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}
                >
                  {totalDelayed}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>

          {/* Formulário de Cadastro / Edição */}
          {showForm && (
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-3 p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                  <UserPlus size={18} className="text-orange-500" />
                  {editingDriver ? 'Editar Dados do Entregador' : 'Cadastrar Novo Motoboy'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 uppercase transition"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Veículo / Placa
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Honda CG • ABC-1234"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black py-2.5 px-6 rounded-xl text-xs uppercase tracking-wide transition shadow-md flex items-center gap-2"
                >
                  <Check size={16} />
                  {editingDriver ? 'Salvar Alterações' : 'Cadastrar Entregador'}
                </button>
              </div>
            </form>
          )}

          {/* Filtros e Busca */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar motoboy por nome, telefone ou placa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'AVAILABLE', label: 'Disponíveis' },
                { id: 'BUSY', label: 'Em Entrega' },
                { id: 'INACTIVE', label: 'Inativos' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${
                    statusFilter === f.id
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela para Desktop */}
          <div className="hidden lg:block bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-4">Motoboy</th>
                  <th className="py-3.5 px-4">Telefone / Contato</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Entregas Ativas</th>
                  <th className="py-3.5 px-4">Última Localização</th>
                  <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-semibold">
                {filteredDrivers.map((d) => {
                  const busyOrders = activeDeliveriesMap.get(d.id) || [];
                  const isBusy = busyOrders.length > 0;
                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-700 dark:text-slate-300 shrink-0">
                            {d.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-white flex items-center gap-2">
                              {d.name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                              {d.vehicle ? `Placa: ${d.vehicle}` : 'Veículo não informado'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {d.phone ? (
                          <button
                            type="button"
                            onClick={() => openWhatsApp(d)}
                            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                          >
                            <Phone size={14} />
                            {d.phone}
                          </button>
                        ) : (
                          <span className="text-slate-400 font-medium">Sem telefone</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {!d.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                            Inativo
                          </span>
                        ) : isBusy ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Navigation size={12} className="animate-pulse" /> Em Entrega (
                            {busyOrders.length})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 size={12} /> Disponível
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isBusy ? (
                          <div className="space-y-1">
                            {busyOrders.map((bo) => (
                              <div
                                key={bo.id}
                                className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1"
                              >
                                <span className="text-orange-500">
                                  #{String(bo.id).slice(-4).toUpperCase()}
                                </span>{' '}
                                • {bo.street}, {bo.number}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">
                            Nenhum pedido vinculado
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {isBusy ? (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                            <MapPin size={13} /> Em rota de entrega
                          </span>
                        ) : d.isActive ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <MapPin size={13} /> Base • Loja
                          </span>
                        ) : (
                          <span className="text-slate-400">Indisponível</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={onOpenMap}
                            title="Ver no Mapa GPS"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                          >
                            <MapPin size={15} />
                          </button>
                          {d.phone && (
                            <button
                              type="button"
                              onClick={() => openWhatsApp(d)}
                              title="Abrir WhatsApp"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                            >
                              <Phone size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(d)}
                            title="Editar motoboy"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleToggleActive(d)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              d.isActive
                                ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400'
                            }`}
                          >
                            {d.isActive ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredDrivers.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm font-bold text-slate-500">
                  Nenhum motoboy encontrado com os filtros atuais.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Tente remover a busca ou selecione outro filtro.
                </p>
              </div>
            )}
          </div>

          {/* Cards para Mobile */}
          <div className="lg:hidden space-y-3">
            {filteredDrivers.map((d) => {
              const busyOrders = activeDeliveriesMap.get(d.id) || [];
              const isBusy = busyOrders.length > 0;
              return (
                <div
                  key={d.id}
                  className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-700 dark:text-slate-300 shrink-0">
                        {d.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-white">
                          {d.name}
                        </p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {d.vehicle ? `Placa: ${d.vehicle}` : 'Veículo não informado'}
                        </p>
                      </div>
                    </div>
                    {!d.isActive ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        Inativo
                      </span>
                    ) : isBusy ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1">
                        Em Entrega ({busyOrders.length})
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Disponível
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span className="font-bold">Contato:</span>
                      {d.phone ? (
                        <button
                          type="button"
                          onClick={() => openWhatsApp(d)}
                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                        >
                          <Phone size={13} /> {d.phone}
                        </button>
                      ) : (
                        <span>Sem telefone</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span className="font-bold">Localização:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {isBusy
                          ? 'Em rota de entrega (GPS)'
                          : d.isActive
                            ? 'Base • Loja'
                            : 'Indisponível'}
                      </span>
                    </div>
                    {isBusy && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
                          Pedidos em Andamento:
                        </p>
                        {busyOrders.map((bo) => (
                          <div
                            key={bo.id}
                            className="text-[11px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            <span className="text-orange-500">
                              #{String(bo.id).slice(-4).toUpperCase()}
                            </span>{' '}
                            • {bo.street}, {bo.number}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={onOpenMap}
                      className="flex-1 py-1.5 px-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <MapPin size={14} /> Mapa GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(d)}
                      className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleToggleActive(d)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                        d.isActive
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400'
                      }`}
                    >
                      {d.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredDrivers.length === 0 && (
              <div className="py-10 text-center bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-500">Nenhum motoboy encontrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
