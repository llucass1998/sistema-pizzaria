import { useEffect, useState } from 'react';
import { formatCurrencySafe } from '../../data/menuData.js';
import {
  BarChart3,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  FileText,
  Download,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function DREPage() {
  const [period, setPeriod] = useState('MONTH');
  const [dreData, setDreData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDre = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) throw new Error('Não autenticado');
      const adminData = JSON.parse(adminDataStr);

      const response = await fetch(`${API_BASE_URL}/admin/financial/dre?period=${period}`, {
        headers: {
          Authorization: `Bearer ${adminData.token}`,
        },
      });

      if (!response.ok) throw new Error('Falha ao carregar DRE');

      const data = await response.json();
      setDreData(data);
    } catch (err) {
      console.error('Erro ao carregar DRE:', err);
      setError(err.message || 'Erro ao conectar com servidor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDre();
  }, [period]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!dreData) return;
    const periodLabel =
      period === 'MONTH'
        ? 'Este Mês'
        : period === 'THIS_WEEK'
          ? 'Esta Semana'
          : period === 'LAST_30_DAYS'
            ? 'Últimos 30 Dias'
            : 'Turno Atual / Hoje';
    const rows = [
      ['DRE SIMPLIFICADO - RIO PIZZAS'],
      ['Período:', periodLabel],
      ['Data da Apuração:', new Date().toLocaleString('pt-BR')],
      [],
      ['Categoria / Linha Contábil', 'Valor (R$)', 'Representatividade / Margem (%)'],
      ['(+) Receita Bruta Total', (dreData.grossRevenue || 0).toFixed(2), '100.0%'],
      [
        '(-) Impostos e Deduções',
        (dreData.deductions || 0).toFixed(2),
        `${((dreData.deductions / (dreData.grossRevenue || 1)) * 100).toFixed(1)}%`,
      ],
      [
        '(=) Receita Líquida',
        (dreData.netRevenue || 0).toFixed(2),
        `${((dreData.netRevenue / (dreData.grossRevenue || 1)) * 100).toFixed(1)}%`,
      ],
      [
        '(-) Custos dos Insumos (CMV)',
        (dreData.cmv || 0).toFixed(2),
        `${((dreData.cmv / (dreData.grossRevenue || 1)) * 100).toFixed(1)}%`,
      ],
      [
        '(=) Lucro Bruto',
        (dreData.grossProfit || 0).toFixed(2),
        `${(dreData.grossMargin || 0).toFixed(1)}%`,
      ],
      [
        '(-) Despesas Fixas (Aluguel, Folha, etc)',
        (dreData.fixedExpenses || 0).toFixed(2),
        `${((dreData.fixedExpenses / (dreData.grossRevenue || 1)) * 100).toFixed(1)}%`,
      ],
      [
        '(-) Despesas Variáveis & Financeiras',
        (dreData.variableExpenses || 0).toFixed(2),
        `${((dreData.variableExpenses / (dreData.grossRevenue || 1)) * 100).toFixed(1)}%`,
      ],
      [
        '(=) Lucro Líquido do Período',
        (dreData.netProfit || 0).toFixed(2),
        `${(dreData.netMargin || 0).toFixed(1)}%`,
      ],
    ];

    const csvContent =
      '\uFEFF' +
      rows
        .map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `DRE_RioPizzas_${period}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400 tracking-wide uppercase">
              Gerencial & Contábil
            </span>
            <span className="text-xs text-slate-400">America/Sao_Paulo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
            DRE Simplificado
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">
            Demonstração do Resultado do Exercício com apuração automática de margens e CMV.
          </p>
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
            onClick={handleExportCSV}
            disabled={isLoading || !dreData}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            title="Baixar planilha Excel (CSV UTF-8)"
          >
            <Download size={16} />
            Exportar Excel
          </button>

          <button
            onClick={handlePrint}
            disabled={isLoading || !dreData}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            title="Gerar PDF estruturado ou Imprimir"
          >
            <FileText size={16} />
            Imprimir PDF
          </button>

          <button
            onClick={loadDre}
            disabled={isLoading}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Atualizar DRE"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-300 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-center gap-3 text-red-800 dark:text-red-300">
          <AlertCircle size={20} className="shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading && !dreData ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Calculando DRE e CMV dos itens...
          </p>
        </div>
      ) : dreData ? (
        <div className="space-y-6">
          {/* Alerta de status do CMV */}
          {dreData.cmv?.status === 'PARTIAL' && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3 print:hidden">
              <ShieldAlert
                size={20}
                className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
              />
              <div className="text-xs md:text-sm text-amber-900 dark:text-amber-200">
                <span className="font-bold">Atenção ao CMV Estimado (Parcial):</span> Foram
                encontrados {dreData.cmv.unreliableProducts?.length || 0} produtos vendidos sem
                ficha técnica ou custos cadastrados. O sistema não inventou custos para esses itens
                a fim de preservar a precisão contábil.
              </div>
            </div>
          )}

          {dreData.cmv?.status === 'COMPLETE' && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 flex items-center gap-3 print:hidden">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-xs md:text-sm text-emerald-900 dark:text-emerald-200 font-medium">
                <span className="font-bold">CMV 100% Preciso:</span> Todos os{' '}
                {dreData.cmv.itemsAnalyzed} itens vendidos no período possuem ficha técnica
                cadastrada no estoque.
              </div>
            </div>
          )}

          {/* Estrutura do DRE em Painel Contábil */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 md:p-8">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Demonstração do Resultado do Exercício
                </h2>
                <p className="text-xs text-slate-500">
                  Apuração baseada em receitas pagas e despesas liquidadas no período.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase block">
                  Margem Líquida
                </span>
                <span
                  className={`text-2xl font-black ${dreData.netMargin >= 15 ? 'text-emerald-600 dark:text-emerald-400' : dreData.netMargin > 0 ? 'text-amber-500' : 'text-red-600'}`}
                >
                  {dreData.netMargin ? dreData.netMargin.toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>

            <div className="space-y-4 font-mono text-sm">
              {/* 1. Receita Bruta */}
              <div className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  <span className="text-slate-400 mr-2">(+)</span> 1. Receita Bruta de Vendas (
                  {dreData.breakdown?.paidOrdersCount || 0} pedidos pagos)
                </div>
                <div className="font-black text-slate-900 dark:text-white text-base">
                  {formatCurrencySafe(dreData.grossRevenue)}
                </div>
              </div>

              {/* 2. Deduções */}
              <div className="flex items-center justify-between py-2 px-4 text-red-600 dark:text-red-400 pl-8">
                <div>
                  <span className="mr-2">(-)</span> 2. Deduções e Pedidos Cancelados (
                  {dreData.breakdown?.canceledOrdersCount || 0} cancelados)
                </div>
                <div className="font-bold">({formatCurrencySafe(dreData.deductions)})</div>
              </div>

              {/* 3. Receita Líquida */}
              <div className="flex items-center justify-between py-3 px-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="font-black text-blue-900 dark:text-blue-300">
                  <span className="mr-2">(=)</span> 3. Receita Líquida Operacional
                </div>
                <div className="font-black text-blue-900 dark:text-blue-300 text-base">
                  {formatCurrencySafe(dreData.netRevenue)}
                </div>
              </div>

              {/* 4. CMV */}
              <div className="flex items-center justify-between py-2 px-4 text-amber-700 dark:text-amber-400 pl-8">
                <div>
                  <span className="mr-2">(-)</span> 4. Custo da Mercadoria Vendida (CMV Estimado via
                  Fichas Técnicas)
                  {dreData.cmv?.cmvPercentage > 0 && (
                    <span className="ml-2 text-xs font-sans px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                      {dreData.cmv.cmvPercentage.toFixed(1)}% da Rec. Líquida
                    </span>
                  )}
                </div>
                <div className="font-bold">
                  ({formatCurrencySafe(dreData.cmv?.totalEstimatedCost || 0)})
                </div>
              </div>

              {/* 5. Lucro Bruto */}
              <div className="flex items-center justify-between py-3 px-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl font-bold">
                <div className="text-slate-900 dark:text-white">
                  <span className="mr-2">(=)</span> 5. Lucro Bruto (Margem de Contribuição)
                  {dreData.grossMargin > 0 && (
                    <span className="ml-2 text-xs font-sans text-slate-500">
                      Margem Bruta: {dreData.grossMargin.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="text-slate-900 dark:text-white text-base">
                  {formatCurrencySafe(dreData.grossProfit)}
                </div>
              </div>

              {/* 6. Despesas Operacionais */}
              <div className="flex items-center justify-between py-2 px-4 text-red-600 dark:text-red-400 pl-8">
                <div>
                  <span className="mr-2">(-)</span> 6. Despesas Operacionais e Administrativas (
                  {dreData.breakdown?.payablesCount || 0} contas pagas)
                </div>
                <div className="font-bold">({formatCurrencySafe(dreData.operatingExpenses)})</div>
              </div>

              {/* 7. Lucro Operacional */}
              <div className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl font-bold">
                <div className="text-slate-800 dark:text-slate-200">
                  <span className="mr-2">(=)</span> 7. Lucro Operacional (EBITDA Gerencial)
                </div>
                <div className="text-base text-slate-800 dark:text-slate-200">
                  {formatCurrencySafe(dreData.operatingProfit)}
                </div>
              </div>

              {/* 8. Impostos e Taxas */}
              <div className="flex items-center justify-between py-2 px-4 text-red-600 dark:text-red-400 pl-8">
                <div>
                  <span className="mr-2">(-)</span> 8. Impostos e Taxas de Gateway/Cartão
                  (Estimativa 3.5%)
                </div>
                <div className="font-bold">({formatCurrencySafe(dreData.taxesAndFees)})</div>
              </div>

              {/* 9. Lucro Líquido Final */}
              <div
                className={`flex items-center justify-between py-4 px-6 rounded-2xl border-2 font-black text-lg ${dreData.netIncome >= 0 ? 'bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800' : 'bg-red-500 text-white border-red-600 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800'}`}
              >
                <div>
                  <span className="mr-2">(=)</span> 9. LUCRO LÍQUIDO DO PERÍODO
                  <span className="block text-xs font-sans font-normal opacity-80 mt-0.5">
                    Resultado final após todas as deduções, custos, despesas e taxas.
                  </span>
                </div>
                <div className="text-2xl">{formatCurrencySafe(dreData.netIncome)}</div>
              </div>
            </div>
          </div>

          {/* Lista de produtos sem custo se houver */}
          {dreData.cmv?.unreliableProducts?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm print:hidden">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-500" />
                Produtos Vendidos Sem Ficha Técnica ({dreData.cmv.unreliableProducts.length})
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Para que o CMV seja calculado com precisão centesimal, acesse o cardápio ou fichas
                técnicas e defina os ingredientes ou custo unitário dos seguintes itens:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {dreData.cmv.unreliableProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      {p.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
