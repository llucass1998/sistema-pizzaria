import { useEffect, useState } from 'react';
import { formatCurrencySafe } from '../../data/menuData.js';
import { DollarSign, ShoppingBag, Clock, TrendingUp, RefreshCw, AlertCircle, ShieldAlert, CheckCircle2, ArrowRight, BarChart3, Scale, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7c43', '#f95d6a'];

export function DashboardPage() {
  const [period, setPeriod] = useState('TODAY');
  const [summary, setSummary] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) throw new Error('Não autenticado');
      const adminData = JSON.parse(adminDataStr);
      
      const [resLegacy, resFin] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/dashboard/summary`, {
          headers: { 'Authorization': `Bearer ${adminData.token}` }
        }),
        fetch(`${API_BASE_URL}/admin/financial/summary?period=${period}`, {
          headers: { 'Authorization': `Bearer ${adminData.token}` }
        })
      ]);
      
      if (!resLegacy.ok && !resFin.ok) throw new Error('Falha ao carregar dados');
      
      if (resLegacy.ok) {
        const dataLegacy = await resLegacy.json();
        setSummary(dataLegacy);
      }
      
      if (resFin.ok) {
        const dataFin = await resFin.json();
        setFinancialSummary(dataFin);
      }
    } catch (err) {
      console.error('Failed to load dashboard summary', err);
      setError(err.message || 'Erro ao conectar com servidor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [period]);

  if (isLoading && !summary && !financialSummary) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !summary && !financialSummary) {
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

  const { summary: metrics, charts, lastUpdated } = summary || {};
  const kpisFin = financialSummary?.kpis || {};

  const cards = [
    {
      title: 'Faturamento Realizado',
      value: formatCurrencySafe(kpisFin.realizedRevenue ?? metrics?.totalRevenue),
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      subtitle: financialSummary?.transparencyNote || 'Vendas pagas confirmadas',
    },
    {
      title: 'A Receber no Período',
      value: formatCurrencySafe(kpisFin.pendingRevenue ?? metrics?.pendingRevenue),
      icon: ShoppingBag,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/30',
      subtitle: 'Pedidos pendentes em aberto',
    },
    {
      title: 'Despesas Liquidáveis',
      value: formatCurrencySafe(kpisFin.operatingExpenses ?? 0),
      icon: Clock,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
      subtitle: 'Contas pagas e saídas de caixa',
    },
    {
      title: 'Lucro Operacional Estimado',
      value: formatCurrencySafe(kpisFin.operatingProfit ?? ((kpisFin.realizedRevenue ?? 0) - (kpisFin.operatingExpenses ?? 0))),
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      subtitle: 'EBITDA Gerencial simplificado',
    },
  ];

  const EmptyState = () => (
    <div className="w-full h-[300px] flex items-center justify-center text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
      Sem dados suficientes para este gráfico no período
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 tracking-wide uppercase">
              Painel Executivo
            </span>
            <span className="text-xs text-slate-400">America/Sao_Paulo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">Dashboard Gerencial</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">Acompanhamento de performance operacional, CMV e resultado financeiro em tempo real.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
          >
            <option value="TODAY">Hoje (Turno Atual)</option>
            <option value="YESTERDAY">Ontem</option>
            <option value="THIS_WEEK">Esta Semana</option>
            <option value="LAST_30_DAYS">Últimos 30 Dias</option>
            <option value="MONTH">Este Mês</option>
          </select>

          <span className="text-xs text-slate-500 hidden sm:inline">
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

      {/* Alerta de status do CMV */}
      {financialSummary?.cmv?.status === 'PARTIAL' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-xs md:text-sm text-amber-900 dark:text-amber-200">
            <span className="font-bold">Atenção ao CMV Estimado (Parcial):</span> Foram encontrados {financialSummary.cmv.unreliableProducts?.length || 0} itens vendidos sem ficha técnica cadastrada. O cálculo de CMV não inventou custos para evitar distorção financeira.
            <Link to="/admin/recipes" className="font-bold underline ml-1 hover:text-amber-700">Cadastrar Fichas &rarr;</Link>
          </div>
        </div>
      )}

      {financialSummary?.cmv?.status === 'COMPLETE' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3 px-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs md:text-sm text-emerald-900 dark:text-emerald-200 font-medium">
            <span className="font-bold">CMV 100% Preciso ({financialSummary.cmv.cmvPercentage?.toFixed(1)}%):</span> Todos os produtos vendidos possuem ficha técnica e custo apurado.
          </div>
        </div>
      )}

      {/* Acesso rápido aos módulos financeiros executivos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/fluxo-caixa" className="bg-gradient-to-r from-slate-900 to-slate-800 text-white dark:from-slate-900 dark:to-slate-950 p-4 rounded-xl border border-slate-700/50 shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <TrendingUp size={20} className="text-emerald-400" />
            </div>
            <div>
              <span className="font-black text-sm block">Fluxo de Caixa</span>
              <span className="text-[11px] text-slate-300">Realizado vs Previsto</span>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-400" />
        </Link>

        <Link to="/admin/dre" className="bg-gradient-to-r from-slate-900 to-slate-800 text-white dark:from-slate-900 dark:to-slate-950 p-4 rounded-xl border border-slate-700/50 shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <BarChart3 size={20} className="text-purple-400" />
            </div>
            <div>
              <span className="font-black text-sm block">DRE Simplificado</span>
              <span className="text-[11px] text-slate-300">Margem e EBITDA</span>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-400" />
        </Link>

        <Link to="/admin/conciliacao" className="bg-gradient-to-r from-slate-900 to-slate-800 text-white dark:from-slate-900 dark:to-slate-950 p-4 rounded-xl border border-slate-700/50 shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Scale size={20} className="text-blue-400" />
            </div>
            <div>
              <span className="font-black text-sm block">Conciliação</span>
              <span className="text-[11px] text-slate-300">Gateways e Cartões</span>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-400" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between transition-all hover:shadow-md">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider truncate">{card.title}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 truncate">{card.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">{card.subtitle}</p>
            </div>
            <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${card.bg} ${card.color}`}>
              <card.icon size={24} />
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
