import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  AlertCircle,
  PieChart as PieChartIcon,
  BarChart3,
  Clock,
  Bike,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { downloadCsv, sanitizeCsvValue } from '../../utils/csvHelper.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

// --- API Helpers ---
async function fetchApi(endpoint, qs = '') {
  const adminData = window.localStorage.getItem('pizzaria-admin');
  const token = adminData ? JSON.parse(adminData).token : '';
  const url = `${API_BASE_URL}/admin/reports/${endpoint}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Erro ao carregar dados do relatório.');
  }

  return res.json();
}

function formatCurrency(val) {
  const num = Number(val);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- Components ---
function StatCard({ title, value, subtitle, icon: Icon, colorClass, trend }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
          <h3 className={`text-2xl font-black ${colorClass}`}>{value}</h3>
        </div>
        <div className={`p-3 rounded-xl bg-opacity-10 dark:bg-opacity-20 ${colorClass.replace('text-', 'bg-')} ${colorClass}`}>
          <Icon size={24} />
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-4 flex items-center text-sm">
          {trend === 'up' && <TrendingUp size={16} className="text-emerald-500 mr-1" />}
          {trend === 'down' && <TrendingDown size={16} className="text-rose-500 mr-1" />}
          <span className="text-slate-500 dark:text-slate-400">{subtitle}</span>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function ReportsPage() {
  const [period, setPeriod] = useState('TODAY'); // TODAY, LAST_7_DAYS, THIS_MONTH, LAST_30_DAYS, CUSTOM
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dados dos relatórios
  const [summary, setSummary] = useState(null);
  const [abcData, setAbcData] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [driverRank, setDriverRank] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cancellations, setCancellations] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (period !== 'CUSTOM') {
        params.append('quickRange', period);
      } else {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      }
      if (paymentMethod) params.append('paymentMethod', paymentMethod);

      const qs = params.toString();

      const [sumData, abc, heat, rank, pay, canc] = await Promise.all([
        fetchApi('summary', qs),
        fetchApi('abc-products', qs),
        fetchApi('sales-heatmap', qs),
        fetchApi('driver-ranking', qs),
        fetchApi('payment-methods', qs),
        fetchApi('cancellations', qs),
      ]);

      setSummary(sumData);
      setAbcData(abc);
      setHeatmap(heat);
      setDriverRank(rank);
      setPayments(pay);
      setCancellations(canc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, paymentMethod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Export CSV — sanitizeCsvValue importada do csvHelper.js
  const exportToCsv = (filename, data) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.map(sanitizeCsvValue).join(','),
      ...data.map((obj) => headers.map(k => sanitizeCsvValue(obj[k])).join(','))
    ].join('\n');
    const csv = "\uFEFF" + csvContent;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllCsv = async () => {
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0');

    const exportData = (filename, data, fallbackHeaders) => {
      let headers = fallbackHeaders;
      let rows = [];
      if (data && data.length > 0) {
        headers = Object.keys(data[0]);
        rows = data;
      }
      
      const csvContent = [
        headers.map(sanitizeCsvValue).join(','),
        ...rows.map((obj) => headers.map(k => sanitizeCsvValue(obj[k])).join(','))
      ].join('\n');
      const csv = "\uFEFF" + csvContent;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    let resumoData = [];
    if (summary) {
      resumoData = [{
        revenueRealized: summary.revenueRealized,
        completedOrders: summary.completedOrders,
        averageTicket: summary.averageTicket,
        revenuePending: summary.revenuePending,
        pendingOrders: summary.pendingOrders,
        canceledAmount: summary.canceledAmount,
        cancellationRate: summary.cancellationRate,
        canceledOrdersCount: summary.canceledOrdersCount
      }];
    }
    exportData(`relatorio-resumo-${dateStr}`, resumoData, ['revenueRealized', 'completedOrders', 'averageTicket', 'revenuePending', 'pendingOrders', 'canceledAmount', 'cancellationRate', 'canceledOrdersCount']);
    await delay(200);

    exportData(`relatorio-curva-abc-${dateStr}`, abcData, ['productId', 'productName', 'quantitySold', 'grossRevenue', 'abcClass', 'percentageOfRevenue']);
    await delay(200);

    exportData(`relatorio-mix-pagamentos-${dateStr}`, payments, ['label', 'totalAmount', 'ordersCount']);
    await delay(200);

    exportData(`relatorio-entregadores-${dateStr}`, driverRank, ['driverId', 'driverName', 'deliveriesCompleted', 'deliveryFees', 'revenueDelivered']);
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

  const heatmapMatrix = useMemo(() => {
    if (!heatmap || !heatmap.length) return null;
    const matrix = [];
    for (let d = 0; d < 7; d++) {
      const dayRow = heatmap.filter((c) => c.dayOfWeek === d).sort((a, b) => a.hour - b.hour);
      matrix.push(dayRow);
    }
    return matrix;
  }, [heatmap]);

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <PieChartIcon className="text-red-600" size={32} />
            BI & Relatórios Gerenciais
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Análises profundas de faturamento, operação e vendas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportAllCsv}
            disabled={!summary}
            title={!summary ? "Carregue os dados antes de exportar." : "📥 Exportar Tudo (CSV)"}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            📥 Exportar Tudo (CSV)
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium mr-2">
          <Filter size={18} /> Filtros:
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-red-500 focus:outline-none min-w-[150px]"
        >
          <option value="TODAY">Hoje</option>
          <option value="LAST_7_DAYS">Últimos 7 Dias</option>
          <option value="THIS_MONTH">Este Mês</option>
          <option value="LAST_30_DAYS">Últimos 30 Dias</option>
          <option value="CUSTOM">Customizado</option>
        </select>

        {period === 'CUSTOM' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        )}

        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
        >
          <option value="">Todas as formas de PGTO</option>
          <option value="PIX">PIX</option>
          <option value="CREDIT_CARD">Cartão de Crédito</option>
          <option value="DEBIT_CARD">Cartão de Débito</option>
          <option value="CASH">Dinheiro</option>
          <option value="ONLINE_CARD">Cartão Online</option>
        </select>

        {summary?.periodApplied?.label && (
          <div className="ml-auto text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Calendar size={14} /> Exibindo: {summary.periodApplied.label}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 p-4 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="h-[400px] flex items-center justify-center animate-pulse">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin mb-4"></div>
            <p className="font-bold text-slate-400">Processando Análises...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Executive Summary */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Receita Realizada (Líquida)"
                value={formatCurrency(summary.revenueRealized)}
                subtitle={`${summary.completedOrders} pedidos concluídos`}
                icon={DollarSign}
                colorClass="text-emerald-600 dark:text-emerald-400"
              />
              <StatCard
                title="Ticket Médio"
                value={formatCurrency(summary.averageTicket)}
                subtitle="Valor médio por pedido pago"
                icon={ShoppingBag}
                colorClass="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                title="Receita Pendente"
                value={formatCurrency(summary.revenuePending)}
                subtitle={`${summary.pendingOrders} pedidos em andamento`}
                icon={Clock}
                colorClass="text-amber-500 dark:text-amber-400"
              />
              <StatCard
                title="Perdas / Cancelamentos"
                value={formatCurrency(summary.canceledAmount)}
                subtitle={`Taxa de ${summary.cancellationRate}% (${summary.canceledOrdersCount} perdidos)`}
                icon={TrendingDown}
                colorClass="text-rose-600 dark:text-rose-400"
                trend="down"
              />
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Mix */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 lg:col-span-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieChartIcon size={18} className="text-slate-400" /> Mix de Pagamentos
                </h3>
                <button
                  onClick={() => exportToCsv('mix-pagamentos', payments)}
                  title="Exportar CSV"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition"
                >
                  <Download size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-[300px]">
                {payments.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={payments}
                        dataKey="totalAmount"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                      >
                        {payments.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">Sem dados</div>
                )}
              </div>
            </div>

            {/* Curva ABC Bar Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 lg:col-span-2 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-slate-400" /> Top 10 Produtos (Receita)
                </h3>
                <button
                  onClick={() => exportToCsv('curva-abc', abcData)}
                  title="Exportar CSV Completo"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition"
                >
                  <Download size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-[300px]">
                {abcData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={abcData.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                      <XAxis type="number" tickFormatter={(val) => `R$${val / 1000}k`} />
                      <YAxis
                        type="category"
                        dataKey="productName"
                        width={150}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                      />
                      <RechartsTooltip
                        formatter={(value, name, props) => [
                          formatCurrency(value),
                          `Classe ${props.payload.abcClass} - ${props.payload.percentageOfRevenue}%`,
                        ]}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                      />
                      <Bar dataKey="grossRevenue" fill="#ef4444" radius={[0, 4, 4, 0]}>
                        {abcData.slice(0, 10).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.abcClass === 'A' ? '#10b981' : entry.abcClass === 'B' ? '#3b82f6' : '#94a3b8'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">Sem dados de produtos</div>
                )}
              </div>
              <p className="text-xs text-center mt-2 text-slate-500">
                Verde: Classe A (80% receita) | Azul: Classe B (15%) | Cinza: Classe C (5%)
              </p>
            </div>
          </div>

          {/* Heatmap & Ranking Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Heatmap Operacional */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 overflow-hidden flex flex-col">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Clock size={18} className="text-slate-400" /> Heatmap de Vendas (Volume/Horário)
              </h3>
              <div className="flex-1 overflow-x-auto">
                {heatmapMatrix && heatmapMatrix.length > 0 ? (
                  <div className="min-w-[600px]">
                    <div className="flex text-xs font-bold text-slate-400 mb-1">
                      <div className="w-12"></div>
                      {[...Array(24).keys()].map((h) => (
                        <div key={`h-${h}`} className="flex-1 text-center">
                          {h}h
                        </div>
                      ))}
                    </div>
                    {heatmapMatrix.map((dayRow, dIndex) => (
                      <div key={`day-${dIndex}`} className="flex items-center mb-1">
                        <div className="w-12 text-xs font-bold text-slate-500 dark:text-slate-400">{daysOfWeek[dIndex]}</div>
                        {dayRow.map((cell) => {
                          const intensity = cell.intensity; // 0 a 1
                          const bgColor = intensity === 0 
                            ? 'bg-slate-50 dark:bg-slate-800/50' 
                            : `bg-red-500`;
                          return (
                            <div
                              key={`cell-${cell.hour}`}
                              className={`flex-1 aspect-square m-[1px] rounded-sm transition-all duration-300 ${bgColor}`}
                              style={intensity > 0 ? { opacity: Math.max(0.2, intensity) } : {}}
                              title={`${daysOfWeek[dIndex]} às ${cell.hour}h: ${cell.ordersCount} pedidos (${formatCurrency(cell.revenue)})`}
                            ></div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">Heatmap sem dados para o período</div>
                )}
              </div>
            </div>

            {/* Ranking de Entregadores */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bike size={18} className="text-slate-400" /> Ranking de Entregadores
                </h3>
                <button
                  onClick={() => exportToCsv('entregadores', driverRank)}
                  title="Exportar CSV"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition"
                >
                  <Download size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-auto max-h-[350px]">
                {driverRank.length > 0 ? (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900 text-slate-500 sticky top-0">
                      <tr>
                        <th className="px-6 py-3">Entregador</th>
                        <th className="px-6 py-3 text-center">Entregas</th>
                        <th className="px-6 py-3 text-right">Taxas (R$)</th>
                        <th className="px-6 py-3 text-right">Faturado (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverRank.map((driver, idx) => (
                        <tr
                          key={driver.driverId}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </span>
                            {driver.driverName}
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {driver.deliveriesCompleted}
                          </td>
                          <td className="px-6 py-4 text-right text-amber-600 dark:text-amber-400 font-medium">
                            {formatCurrency(driver.deliveryFees)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                            {formatCurrency(driver.revenueDelivered)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-400">Nenhuma entrega registrada</div>
                )}
              </div>
            </div>
          </div>
          
          {/* Cancelamentos Detalhados */}
          {cancellations && cancellations.recentCancellations?.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <TrendingDown size={18} /> Últimos Cancelamentos & Perdas
                </h3>
              </div>
              <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 sticky top-0">
                      <tr>
                        <th className="px-6 py-3">Data</th>
                        <th className="px-6 py-3">Motivo / Notas</th>
                        <th className="px-6 py-3">Tipo</th>
                        <th className="px-6 py-3">Pagamento</th>
                        <th className="px-6 py-3 text-right">Valor Perdido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancellations.recentCancellations.map((canc) => (
                        <tr
                          key={canc.id}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(canc.createdAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-3 text-slate-800 dark:text-slate-200">
                            {canc.notes}
                          </td>
                          <td className="px-6 py-3 text-slate-500">
                            {canc.fulfillmentType === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                          </td>
                          <td className="px-6 py-3 text-slate-500">
                            {canc.paymentMethod}
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(canc.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
