import { useEffect, useState } from 'react';
import { formatCurrencySafe } from '../../data/menuData.js';
import { DollarSign, ShoppingBag, Clock, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7c43', '#f95d6a'];

export function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) throw new Error('Não autenticado');
      const adminData = JSON.parse(adminDataStr);
      
      const response = await fetch(`${API_BASE_URL}/admin/dashboard/summary`, {
        headers: {
          'Authorization': `Bearer ${adminData.token}`
        }
      });
      
      if (!response.ok) throw new Error('Falha ao carregar dados');
      
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard summary', err);
      setError(err.message || 'Erro ao conectar com servidor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  if (isLoading && !summary) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center h-full min-h-[400px] text-slate-500">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <p className="mb-4">{error}</p>
        <button onClick={loadSummary} className="px-4 py-2 bg-slate-900 text-white rounded-lg flex items-center gap-2">
          <RefreshCw size={16} /> Tentar Novamente
        </button>
      </div>
    );
  }

  const { summary: metrics, charts, lastUpdated } = summary;

  const cards = [
    {
      title: 'Faturamento de Hoje',
      value: formatCurrencySafe(metrics?.totalRevenue),
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: 'Pedidos Finalizados',
      value: metrics?.completedOrders ?? 0,
      icon: ShoppingBag,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: 'Pedidos em Andamento',
      value: metrics?.pendingOrders ?? 0,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: 'Ticket Médio',
      value: formatCurrencySafe(metrics?.averageTicket),
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
  ];

  const EmptyState = () => (
    <div className="w-full h-[300px] flex items-center justify-center text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
      Sem dados para hoje
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Resumo operacional do dia atual.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            Atualizado: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--:--'}
          </span>
          <button 
            onClick={loadSummary} 
            disabled={isLoading}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={`text-slate-600 dark:text-slate-300 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center ${card.bg} ${card.color}`}>
              <card.icon size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 truncate">{card.title}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white truncate">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Gráfico de Faturamento por Hora */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Faturamento por Hora</h3>
          {charts?.revenueByHour?.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.revenueByHour} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `R$ ${val}`} />
                  <RechartsTooltip 
                    formatter={(value) => [formatCurrencySafe(value), "Faturamento"]}
                    labelStyle={{ color: '#0f172a' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </div>

        {/* Gráfico de Pedidos por Status */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Pedidos por Status</h3>
          {charts?.ordersByStatus?.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {charts.ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </div>

        {/* Gráfico de Produtos Mais Vendidos */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Top 5 Produtos</h3>
          {charts?.topProducts?.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={100} />
                  <RechartsTooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="quantity" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} name="Qtd Vendida" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </div>

        {/* Gráfico de Formas de Pagamento */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Formas de Pagamento (Faturamento)</h3>
          {charts?.paymentsByMethod?.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.paymentsByMethod}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {charts.paymentsByMethod.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value) => [formatCurrencySafe(value), "Faturamento"]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </div>
      </div>
    </div>
  );
}

