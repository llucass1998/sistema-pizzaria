import { useEffect, useState } from 'react';
import { formatCurrencySafe } from '../../data/menuData.js';
import { Scale, RefreshCw, AlertCircle, CheckCircle2, Clock, CreditCard, DollarSign, Smartphone, ShieldCheck } from 'lucide-react';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function ReconciliationPage() {
  const [period, setPeriod] = useState('LAST_30_DAYS');
  const [reconcileData, setReconcileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadReconciliation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) throw new Error('Não autenticado');
      const adminData = JSON.parse(adminDataStr);
      
      const response = await fetch(`${API_BASE_URL}/admin/financial/reconciliation?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${adminData.token}`
        }
      });
      
      if (!response.ok) throw new Error('Falha ao carregar conciliação financeira');
      
      const data = await response.json();
      setReconcileData(data);
    } catch (err) {
      console.error('Erro na conciliação:', err);
      setError(err.message || 'Erro ao conectar com servidor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliation();
  }, [period]);

  const getMethodIcon = (method) => {
    if (method === 'PIX') return <Smartphone className="text-emerald-500" size={24} />;
    if (method === 'CASH') return <DollarSign className="text-amber-500" size={24} />;
    return <CreditCard className="text-blue-500" size={24} />;
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 tracking-wide uppercase">
              Auditoria & Cartões
            </span>
            <span className="text-xs text-slate-400">America/Sao_Paulo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">Conciliação Financeira por Método</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">Cruzamento analítico entre vendas registradas no sistema e liquidações bancárias/gaveta.</p>
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

          <button 
            onClick={loadReconciliation} 
            disabled={isLoading}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Atualizar conciliação"
          >
            <RefreshCw size={18} className={`text-slate-600 dark:text-slate-300 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-center gap-3 text-red-800 dark:text-red-300">
          <AlertCircle size={20} className="shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading && !reconcileData ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cruzando recebimentos e liquidações...</p>
        </div>
      ) : reconcileData ? (
        <div className="space-y-6">
          {/* Cards Executivos Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Faturado Bruto</span>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrencySafe(reconcileData.totals.totalSold)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Soma de todas as vendas do período</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Liquidado (Pago)</span>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrencySafe(reconcileData.totals.totalReceived)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Confirmado nos gateways e caixa</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">A Liquidar (Pendente)</span>
              <div className="mt-2 text-2xl font-black text-amber-500">
                {formatCurrencySafe(reconcileData.totals.totalPending)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Pedidos aguardando pagamento</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-900 text-white dark:bg-slate-950">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Líquido Estimado (Pós-Taxas)</span>
              <div className="mt-2 text-2xl font-black text-blue-400">
                {formatCurrencySafe(reconcileData.totals.netAfterFees)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Taxas Estimadas: {formatCurrencySafe(reconcileData.totals.totalFeeEstimated)}
              </p>
            </div>
          </div>

          {/* Tabela Comparativa Analítica por Método */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Detalhamento Operacional por Meio de Pagamento</h3>
              <p className="text-xs text-slate-500">Taxas e status de liquidação com base em conciliação automática.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Meio de Pagamento</th>
                    <th className="py-4 px-6 text-center">Transações</th>
                    <th className="py-4 px-6 text-right">Total Vendido</th>
                    <th className="py-4 px-6 text-right">Taxa Estimada (%)</th>
                    <th className="py-4 px-6 text-right">Valor da Taxa</th>
                    <th className="py-4 px-6 text-right">Líquido A Receber</th>
                    <th className="py-4 px-6 text-center">Status Conciliação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                  {reconcileData.methods.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                            {getMethodIcon(item.method)}
                          </div>
                          <div>
                            <span className="font-black text-slate-800 dark:text-slate-200 block">
                              {item.label}
                            </span>
                            <span className="text-xs text-slate-400 uppercase font-mono">
                              {item.method}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-600 dark:text-slate-300">
                        {item.count} ops
                      </td>
                      <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white">
                        {formatCurrencySafe(item.soldAmount)}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-500">
                        {item.feePercentage.toFixed(1)}%
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-red-500">
                        -{formatCurrencySafe(item.feeAmount)}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrencySafe(item.netAmount)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {item.reconciledStatus === 'CONCILIATED' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400">
                            <CheckCircle2 size={14} />
                            Conciliado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400">
                            <Clock size={14} />
                            A Liquidar
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>* O cálculo de taxas estimadas utiliza médias padrão de mercado (PIX 0.99%, Crédito 3.20%, Débito 1.80%, Voucher 4.50%).</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">Auditoria Automática Contínua</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
