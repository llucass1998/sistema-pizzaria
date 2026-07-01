import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, Search, User, MapPin, Plus, Edit2, Check, X, UserPlus, Info } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrency } from '../../data/menuData.js';

export function DispatchPage() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [showDriverModal, setShowDriverModal] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [ordersRes, driversRes] = await Promise.all([
        fetch('/api/admin/dispatch/ready-orders'),
        fetch('/api/admin/dispatch/drivers')
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data);
      }
      if (driversRes.ok) {
        const data = await driversRes.json();
        setDrivers(data);
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
      const res = await fetch('/api/admin/dispatch/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, driverId })
      });
      if (res.ok) {
        fetchData();
        showSuccess('Pedido despachado com sucesso!');
      } else {
        showError('Erro ao despachar pedido.');
      }
    } catch (err) {
      console.error(err);
      showError('Erro de conexão.');
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="flex-none flex justify-between items-center bg-white dark:bg-slate-950 px-6 py-4 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
            <Truck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Painel de Despacho</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Atribua pedidos prontos aos entregadores.</p>
          </div>
        </div>
        <button
          onClick={() => setShowDriverModal(true)}
          className="bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-slate-700 transition"
        >
          <User size={18} />
          Gerenciar Motoboys
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {isLoading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-950 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <CheckCircle2 size={48} className="mb-4 text-emerald-400" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Nenhum pedido aguardando</h3>
            <p>Todos os pedidos foram despachados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map(order => (
              <DispatchCard 
                key={order.id} 
                order={order} 
                drivers={drivers}
                onAssign={(driverId) => handleAssignDriver(order.id, driverId)} 
              />
            ))}
          </div>
        )}
      </div>

      {showDriverModal && (
        <DriverModal
          drivers={drivers}
          onClose={() => setShowDriverModal(false)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}

function DispatchCard({ order, drivers, onAssign }) {
  const [selectedDriver, setSelectedDriver] = useState('');
  
  const isAssigned = order.status === 'OUT_FOR_DELIVERY';

  return (
    <div className={`rounded-xl border-2 shadow-sm p-5 flex flex-col transition-colors ${
      isAssigned 
        ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800' 
        : order.status === 'READY'
          ? 'border-orange-200 bg-white dark:bg-slate-900 dark:border-orange-800/50'
          : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">#{order.id.slice(-6).toUpperCase()}</span>
          <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
            <User size={14} />
            <span>{order.customer?.name || 'Cliente Avulso'}</span>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
          isAssigned ? 'bg-emerald-100 text-emerald-700' : 
          order.status === 'READY' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
        }`}>
          {isAssigned ? 'Despachado' : 
           order.status === 'READY' ? 'Pronto p/ Entrega' : 'Preparando'}
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-3 mb-4 flex-1">
        <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <span>
            {order.street}, {order.number} - {order.neighborhood}
            {order.complement && <span className="block text-slate-500 text-xs">Ref: {order.complement}</span>}
          </span>
        </div>
      </div>

      {!isAssigned ? (
        <div className="flex flex-col gap-2 mt-auto">
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            disabled={order.status !== 'READY'}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50"
          >
            <option value="">Selecione o Entregador</option>
            {drivers.filter(d => d.isActive).map(d => (
              <option key={d.id} value={d.id}>{d.name} {d.vehicle ? `(${d.vehicle})` : ''}</option>
            ))}
          </select>
          <button
            onClick={() => onAssign(selectedDriver)}
            disabled={!selectedDriver || order.status !== 'READY'}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition"
          >
            Confirmar Despacho
          </button>
        </div>
      ) : (
        <div className="mt-auto bg-emerald-600/10 border border-emerald-600/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-1.5 rounded-full shrink-0">
            <Check size={16} />
          </div>
          <div className="text-sm">
            <p className="text-emerald-700 dark:text-emerald-400 font-medium">Em rota de entrega</p>
            <p className="text-emerald-600/80 dark:text-emerald-500/80 text-xs font-bold">Por {order.driver?.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverModal({ drivers, onClose, onRefresh }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/dispatch/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, vehicle })
      });
      if (res.ok) {
        showSuccess('Entregador criado com sucesso!');
        setName('');
        setPhone('');
        setVehicle('');
        onRefresh();
      } else {
        showError('Erro ao criar entregador.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Gerenciar Entregadores</h2>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleCreate} className="mb-6 flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Novo Entregador</h3>
            <input 
              type="text" placeholder="Nome" value={name} onChange={e => setName(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2" required 
            />
            <div className="flex gap-2">
              <input 
                type="text" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2"
              />
              <input 
                type="text" placeholder="Veículo (Placa)" value={vehicle} onChange={e => setVehicle(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2"
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-lg mt-2">
              Adicionar
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3">Lista de Entregadores</h3>
            {drivers.map(d => (
              <div key={d.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
                <div>
                  <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    {d.name}
                    {!d.isActive && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full uppercase">Inativo</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {d.phone || 'Sem telefone'} {d.vehicle ? `• ${d.vehicle}` : ''}
                  </p>
                </div>
                {/* No futuro: botao de editar/desativar */}
              </div>
            ))}
            {drivers.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Nenhum entregador cadastrado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
