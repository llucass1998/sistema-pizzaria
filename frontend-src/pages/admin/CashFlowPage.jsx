import { useEffect, useState } from 'react';
import { formatCurrencySafe } from '../../data/menuData.js';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, Calendar, ShieldCheck, DollarSign, ArrowUpRight, ArrowDownRight, Layers, Download, FileText } from 'lucide-react';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function CashFlowPage() {
  const [period, setPeriod] = useState('LAST_30_DAYS');
  const [cashFlowData, setCashFlowData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('ALL'); // ALL, REALIZED, PREDICTED, PHYSICAL

  const loadCashFlow = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) throw new Error('Não autenticado');
      const adminData = JSON.parse(adminDataStr);
      
      const response = await fetch(`${API_BASE_URL}/admin/financial/cash-flow?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${adminData.token}`
        }
      });
      
      if (!response.ok) throw new Error('Falha ao carregar fluxo de caixa');
      
      const data = await response.json();
      setCashFlowData(data);
    } catch (err) {
      console.error('Erro no fluxo de caixa:', err);
      setError(err.message || 'Erro ao conectar com servidor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCashFlow();
  }, [period]);

  const filteredEntries = (cashFlowData?.entries || []).filter(e => {
    if (filterType === 'ALL') return true;
    if (filterType === 'REALIZED') return e.isRealized && e.type !== 'PHYSICAL_MOVEMENT';
    if (filterType === 'PREDICTED') return !e.isRealized;
    if (filterType === 'PHYSICAL') return e.type === 'PHYSICAL_MOVEMENT';
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!cashFlowData?.entries) return;
    const periodLabel = period === 'MONTH' ? 'Este Mês' : period === 'THIS_WEEK' ? 'Esta Semana' : period === 'LAST_30_DAYS' ? 'Últimos 30 Dias' : 'Turno Atual / Hoje';
    const rows = [
      ['FLUXO DE CAIXA CONSOLIDADO - RIO PIZZAS'],
      ['Período:', periodLabel],
      ['Data de Emissão:', new Date().toLocaleString('pt-BR')],
      [],
      ['Data/Hora', 'Tipo Movimentação', 'Descrição / Categoria', 'Valor (R$)', 'Status / Realizado', 'Método / Conta'],
      ...filteredEntries.map(e => [
        new Date(e.date).toLocaleString('pt-BR'),
        e.type === 'INFLOW' ? 'Entrada (+)' : e.type === 'OUTFLOW' ? 'Saída (-)' : 'Mov. Físico / Sangria/Supr.',
        e.description || e.category || 'Sem descrição',
        Number(e.amount || 0).toFixed(2),
        e.isRealized ? 'Realizado' : 'Previsto',
        e.paymentMethod || 'Caixa Geral'
      ])
    ];
    
    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FluxoCaixa_RioPizzas_${period}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 tracking-wide uppercase">
              ERP Financeiro
            </span>
            <span className="text-xs text-slate-400">America/Sao_Paulo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">Fluxo de Caixa Consolidado</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">Acompanhamento rigoroso de entradas e saídas realizadas vs previstas.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm focus:ring-2 focus:ring-red-500 outline-none pr-8"
            >
              <option value="TODAY">Hoje (Turno Atual)</option>
              <option value="YESTERDAY">Ontem</option>
              <option value="THIS_WEEK">Esta Semana</option>
              <option value="LAST_30_DAYS">Últimos 30 Dias</option>
              <option value="MONTH">Este Mês</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={isLoading || !cashFlowData?.entries}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            title="Baixar planilha Excel (CSV UTF-8)"
          >
            <Download size={16} />
            Exportar Excel
          </button>

          <button
            onClick={handlePrint}
            disabled={isLoading || !cashFlowData?.entries}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            title="Gerar PDF estruturado ou Imprimir"
          >
            <FileText size={16} />
            Imprimir PDF
          </button>

          <button 
            onClick={loadCashFlow} 
            disabled={isLoading}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Atualizar dados"
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

      {isLoading && !cashFlowData ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Apurando fluxo consolidado...</p>
        </div>
      ) : cashFlowData ? (
        <>
          {/* Alerta de Segurança e Fonte de Verdade */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck size={20} className="shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-xs md:text-sm text-blue-900 dark:text-blue-200">
              <span className="font-bold">Princípio Contábil de Caixa:</span> {cashFlowData.ruleDocumentation}
            </div>
          </div>

          {/* Cards Executivos de Saldo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Entradas Realizadas</span>
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight size={20} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrencySafe(cashFlowData.summary.realizedInflow)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Vendas pagas confirmadas</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Saídas Realizadas</span>
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
                  <ArrowDownRight size={20} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-black text-red-600 dark:text-red-400">
                {formatCurrencySafe(cashFlowData.summary.realizedOutflow)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Despesas e faturas pagas</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white dark:from-slate-900 dark:to-slate-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">Saldo Realizado em Caixa</span>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className={`mt-2 text-3xl font-black ${cashFlowData.summary.realizedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrencySafe(cashFlowData.summary.realizedBalance)}
              </div>
              <p className="text-xs text-slate-300 mt-1">Disponível apurado no período</p>
            </div>
          </div>

          {/* Segunda linha de previsão e gaveta física */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Previsão a Receber</span>
              <div className="text-lg font-black text-slate-700 dark:text-slate-300 mt-1">
                {formatCurrencySafe(cashFlowData.summary.predictedInflow)}
              </div>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Pedidos pendentes</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Previsão a Pagar</span>
              <div className="text-lg font-black text-slate-700 dark:text-slate-300 mt-1">
                {formatCurrencySafe(cashFlowData.summary.predictedOutflow)}
              </div>
              <span className="text-[11px] text-red-500 font-medium">Contas em aberto no período</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Saldo Projetado Total</span>
              <div className={`text-lg font-black mt-1 ${cashFlowData.summary.projectedBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                {formatCurrencySafe(cashFlowData.summary.projectedBalance)}
              </div>
              <span className="text-[11px] text-slate-400">Realizado + Previsto</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Gaveta PDV (Sangria/Sup.)</span>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1 flex justify-between">
                <span className="text-red-500">Sangria: {formatCurrencySafe(cashFlowData.summary.physicalSangria)}</span>
                <span className="text-emerald-500">Sup: {formatCurrencySafe(cashFlowData.summary.physicalSuprimento)}</span>
              </div>
              <span className="text-[11px] text-slate-400">Movimentação física de balcão</span>
            </div>
          </div>

          {/* Tabela de Lançamentos do Fluxo */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Extrato Analítico do Período</h3>
                <p className="text-xs text-slate-500">Total de {filteredEntries.length} lançamentos encontrados.</p>
              </div>

              {/* Filtro por tipo de lançamento */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterType === 'ALL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterType('REALIZED')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterType === 'REALIZED' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Realizados
                </button>
                <button
                  onClick={() => setFilterType('PREDICTED')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterType === 'PREDICTED' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Previstos
                </button>
                <button
                  onClick={() => setFilterType('PHYSICAL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${filterType === 'PHYSICAL' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Gaveta PDV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Status / Tipo</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4 text-right">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        Nenhum lançamento corresponde ao filtro no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((item, idx) => {
                      const isPositive = item.type.startsWith('INFLOW');
                      const isPhysical = item.type === 'PHYSICAL_MOVEMENT';

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(item.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-4">
                            {item.isRealized && !isPhysical && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400">
                                Realizado
                              </span>
                            )}
                            {!item.isRealized && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400">
                                Previsto
                              </span>
                            )}
                            {isPhysical && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                Gaveta Física
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase">
                            {item.category}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {item.description}
                          </td>
                          <td className={`py-3 px-4 text-right font-black ${isPhysical ? 'text-slate-500 dark:text-slate-400' : isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isPhysical ? '' : isPositive ? '+' : '-'} {formatCurrencySafe(item.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
