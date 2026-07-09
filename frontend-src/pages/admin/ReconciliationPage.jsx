import React, { useEffect, useState } from 'react';
import { formatCurrencySafe } from '../../data/menuData.js';
import {
  Scale,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Smartphone,
  ShieldCheck,
  Link2,
  Unlink,
  FileText,
  ShoppingBag,
  ArrowRight,
  Check,
  XCircle,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState('ERP'); // 'ERP' | 'FINANCIAL'
  const [period, setPeriod] = useState('LAST_30_DAYS');

  // States para ERP
  const [erpData, setErpData] = useState(null);
  const [loadingErp, setLoadingErp] = useState(true);

  // States para Financial / Vendas
  const [reconcileData, setReconcileData] = useState(null);
  const [loadingFin, setLoadingFin] = useState(true);

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal conciliação manual
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchNotes, setMatchNotes] = useState('');

  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminData = adminDataStr ? JSON.parse(adminDataStr) : null;
  const token = adminData?.token || '';
  const userRole = adminData?.user?.role || adminData?.role || ''; // RBAC no Frontend
  if (userRole === 'KITCHEN' || userRole === 'DRIVER' || userRole === 'DELIVERY') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-black text-slate-950 mb-2">Acesso Restrito</h2>
          <p className="text-slate-600 font-bold max-w-md mx-auto">
            O seu perfil (<span className="text-red-600 font-black">{userRole}</span>) não possui
            permissões para acessar a Conciliação Financeira e ERP.
          </p>
        </div>
      </div>
    );
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const loadErpReconciliation = async () => {
    try {
      setLoadingErp(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/admin/reconciliation/summary?period=${period}`, {
        headers,
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Acesso negado.');
        throw new Error('Falha ao carregar dados ERP.');
      }
      const data = await res.json();
      setErpData(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingErp(false);
    }
  };

  const loadFinancialReconciliation = async () => {
    try {
      setLoadingFin(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/admin/financial/reconciliation?period=${period}`, {
        headers,
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Acesso negado.');
        throw new Error('Falha ao carregar conciliação financeira.');
      }
      const data = await res.json();
      setReconcileData(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingFin(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ERP') {
      loadErpReconciliation();
    } else {
      loadFinancialReconciliation();
    }
  }, [activeTab, period]);

  const handleUnmatch = async (invoiceId) => {
    if (!window.confirm('Confirma a remoção do vínculo deste pedido com a nota fiscal?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reconciliation/unmatch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ invoiceId }),
      });
      if (!res.ok) throw new Error('Erro ao desvincular.');
      loadErpReconciliation();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMatchManual = async (e) => {
    e.preventDefault();
    if (!selectedIssue) return;
    try {
      setSubmitting(true);
      const payload = {
        invoiceId: selectedIssue.invoiceId,
        purchaseOrderId: selectedIssue.purchaseOrderId,
        notes: matchNotes,
      };
      const res = await fetch(`${API_BASE_URL}/admin/reconciliation/match`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Erro na conciliação manual.');
      setIsMatchModalOpen(false);
      setMatchNotes('');
      loadErpReconciliation();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getMethodIcon = (method) => {
    switch (method?.toUpperCase()) {
      case 'PIX':
      case 'QR_CODE':
        return <Smartphone className="w-4 h-4 text-emerald-600" />;
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
      case 'CARD':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'CASH':
      case 'DINHEIRO':
        return <DollarSign className="w-4 h-4 text-amber-600" />;
      default:
        return <Scale className="w-4 h-4 text-slate-500" />;
    }
  };

  const methodsList = Array.isArray(reconcileData?.methodsSummary)
    ? reconcileData.methodsSummary
    : Array.isArray(reconcileData?.salesByMethod)
      ? reconcileData.salesByMethod
      : Array.isArray(reconcileData)
        ? reconcileData
        : [];

  const finTotals = {
    totalSold: methodsList.reduce((acc, m) => acc + Number(m?.totalSold || 0), 0),
    totalReceived: methodsList.reduce((acc, m) => acc + Number(m?.received || 0), 0),
    totalPending: methodsList.reduce((acc, m) => acc + Number(m?.pending || 0), 0),
    netAfterFees: methodsList.reduce((acc, m) => acc + Number(m?.net || 0), 0),
    totalFeeEstimated: methodsList.reduce((acc, m) => acc + Number(m?.fee || 0), 0),
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header com Abas */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Auditoria Contábil
              </span>
              <span className="text-xs font-bold text-slate-500">Multi-Loja Protegido</span>
            </div>
            <h1 className="text-3xl font-black text-slate-950 flex items-center gap-3">
              <Scale className="w-8 h-8 text-indigo-600" />
              Conciliação Geral & Auditoria
            </h1>
            <p className="text-slate-600 text-sm font-semibold mt-1">
              Cruze dados de Pedidos de Compra com Notas Fiscais (ERP) ou audite vendas e caixas
              físicos (PDV).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeTab === 'FINANCIAL' && (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-2 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="TODAY">Hoje (Turno Atual)</option>
                <option value="YESTERDAY">Ontem</option>
                <option value="THIS_WEEK">Esta Semana</option>
                <option value="LAST_30_DAYS">Últimos 30 Dias</option>
                <option value="MONTH">Este Mês</option>
              </select>
            )}

            <button
              onClick={activeTab === 'ERP' ? loadErpReconciliation : loadFinancialReconciliation}
              disabled={loadingErp || loadingFin}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-all border border-slate-300 shadow-sm active:scale-95 disabled:opacity-50"
              title="Atualizar conciliação"
            >
              <RefreshCw
                size={20}
                className={`text-slate-700 ${loadingErp || loadingFin ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setActiveTab('ERP')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'ERP'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Conciliação ERP (Compras vs Notas Fiscais)
          </button>
          <button
            onClick={() => setActiveTab('FINANCIAL')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'FINANCIAL'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Conciliação PDV & Vendas (Meios de Pagamento)
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700 shadow-sm">
          <AlertCircle size={24} className="shrink-0 text-red-600" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ABA 1: CONCILIAÇÃO ERP (COMPRAS vs NOTAS) */}
      {activeTab === 'ERP' && (
        <div className="space-y-8 animate-fadeIn">
          {loadingErp ? (
            <div className="p-16 text-center text-slate-600 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm font-bold">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <span>Analisando notas fiscais, pedidos e contas a pagar...</span>
            </div>
          ) : !erpData ? (
            <div className="p-12 text-center text-slate-600 font-bold bg-white rounded-2xl border border-slate-200 shadow-sm">
              Nenhum dado de conciliação ERP disponível.
            </div>
          ) : (
            <>
              {/* Cards de Resumo ERP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-emerald-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Total Conciliado
                      </p>
                      <h3 className="text-3xl font-black text-emerald-700 mt-1">
                        {formatCurrencySafe(erpData.summary?.matchedAmount)}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        {erpData.summary?.matchedCount || 0} documentos verificados
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700 border border-emerald-200 group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-amber-200 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-amber-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Pendente de Vínculo
                      </p>
                      <h3 className="text-3xl font-black text-amber-700 mt-1">
                        {formatCurrencySafe(erpData.summary?.pendingAmount)}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        {erpData.summary?.pendingCount || 0} compras ou notas pendentes
                      </p>
                    </div>
                    <div className="p-3 bg-amber-100 rounded-xl text-amber-700 border border-amber-200 group-hover:scale-110 transition-transform">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-red-200 bg-gradient-to-br from-red-500/10 to-red-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-red-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Divergências Detectadas
                      </p>
                      <h3 className="text-3xl font-black text-red-700 mt-1">
                        {formatCurrencySafe(erpData.summary?.divergentAmount)}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        {erpData.summary?.divergentCount || 0} alertas de diferença de valor
                      </p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-xl text-red-700 border border-red-200 group-hover:scale-110 transition-transform">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 1: Divergências Detectadas */}
              {erpData.issues?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 text-red-700">
                    <AlertCircle className="w-6 h-6 animate-bounce" />
                    <h3 className="text-lg font-black">Divergências de Valor (Nota vs Pedido)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {erpData.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="bg-white border border-red-200 p-4 rounded-xl flex flex-col justify-between gap-3 shadow-sm"
                      >
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-red-700">
                            {issue.type}
                          </span>
                          <h4 className="font-bold text-slate-950 mt-1">{issue.title}</h4>
                          <p className="text-xs text-slate-700 mt-1">{issue.description}</p>
                          <div className="mt-2 text-xs font-semibold text-slate-600">
                            Fornecedor:{' '}
                            <strong className="text-slate-900">{issue.supplierName}</strong> |
                            Diferença:{' '}
                            <strong className="text-red-700 font-mono">
                              {formatCurrencySafe(issue.differenceAmount)}
                            </strong>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleUnmatch(issue.invoiceId)}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 transition-all flex items-center gap-1 font-bold"
                          >
                            <Unlink className="w-3.5 h-3.5" /> Desvincular
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIssue(issue);
                              setIsMatchModalOpen(true);
                            }}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm font-bold"
                          >
                            <Check className="w-3.5 h-3.5" /> Aprovar e Conciliar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção 2: Compras sem Nota Vinculada */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-amber-600" />
                      Pedidos de Compra Aprovados Sem Nota Fiscal Vinculada
                    </h3>
                    <p className="text-xs font-semibold text-slate-600">
                      Ordens de compra que aguardam recebimento de nota fiscal de entrada do
                      fornecedor.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                    {erpData.unlinkedPurchases?.length || 0} pendentes
                  </span>
                </div>

                {!erpData.unlinkedPurchases || erpData.unlinkedPurchases.length === 0 ? (
                  <div className="p-8 text-center font-bold text-slate-600 text-sm italic">
                    Excelente! Todos os pedidos de compra estão devidamente conciliados com notas
                    fiscais.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider bg-slate-100">
                          <th className="p-4">Pedido / Emissão</th>
                          <th className="p-4">Fornecedor</th>
                          <th className="p-4 text-right">Valor Estimado</th>
                          <th className="p-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {erpData.unlinkedPurchases.map((po) => (
                          <tr key={po.id} className="hover:bg-slate-50">
                            <td className="p-4 font-mono font-bold text-slate-950">
                              #{po.id?.slice(0, 8)}
                            </td>
                            <td className="p-4 font-semibold text-slate-800">
                              {po.supplier?.name}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-amber-700">
                              {formatCurrencySafe(po.totalAmount)}
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Aguardando NF
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Seção 3: Notas Fiscais Recebidas Sem Pedido Vinculado */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      Notas Fiscais de Entrada Sem Ordem de Compra Vinculada
                    </h3>
                    <p className="text-xs font-semibold text-slate-600">
                      Documentos de entrada direta que não foram vinculados a um pedido de compra
                      (PO).
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200">
                    {erpData.unlinkedInvoices?.length || 0} pendentes
                  </span>
                </div>

                {!erpData.unlinkedInvoices || erpData.unlinkedInvoices.length === 0 ? (
                  <div className="p-8 text-center font-bold text-slate-600 text-sm italic">
                    Todas as notas fiscais de entrada estão vinculadas ou conciliadas.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider bg-slate-100">
                          <th className="p-4">NF / Emissão</th>
                          <th className="p-4">Fornecedor</th>
                          <th className="p-4 text-right">Valor da Nota</th>
                          <th className="p-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {erpData.unlinkedInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="p-4 font-mono font-bold text-slate-950">
                              NF {inv.number || 'S/N'}
                            </td>
                            <td className="p-4 font-semibold text-slate-800">
                              {inv.supplier?.name}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-emerald-700">
                              {formatCurrencySafe(inv.totalAmount)}
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Sem Vínculo
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ABA 2: CONCILIAÇÃO FINANCEIRA E VENDAS PDV */}
      {activeTab === 'FINANCIAL' && (
        <div className="space-y-8 animate-fadeIn">
          {loadingFin ? (
            <div className="p-16 text-center text-slate-600 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm font-bold">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <span>Analisando liquidações, adquirentes e caixa físico...</span>
            </div>
          ) : !reconcileData ? (
            <div className="p-12 text-center text-slate-600 font-bold bg-white rounded-2xl border border-slate-200 shadow-sm">
              Nenhum dado financeiro disponível para este período.
            </div>
          ) : (
            <>
              {/* Cards Executivos Seguros (sem erro de undefined) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Total Faturado Bruto
                  </span>
                  <div className="mt-2 text-2xl font-black text-slate-950 font-mono">
                    {formatCurrencySafe(finTotals.totalSold)}
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Soma de todas as vendas registradas
                  </p>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Total Liquidado (Pago)
                  </span>
                  <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
                    {formatCurrencySafe(finTotals.totalReceived)}
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Confirmado em caixas e gateways
                  </p>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    A Liquidar (Pendente)
                  </span>
                  <div className="mt-2 text-2xl font-black text-amber-700 font-mono">
                    {formatCurrencySafe(finTotals.totalPending)}
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Vendas aguardando compensação
                  </p>
                </div>

                <div className="bg-white border border-indigo-200 p-5 rounded-2xl relative overflow-hidden shadow-sm bg-gradient-to-br from-indigo-500/10 to-indigo-500/5">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Líquido Estimado (Pós-Taxas)
                  </span>
                  <div className="mt-2 text-2xl font-black text-indigo-700 font-mono">
                    {formatCurrencySafe(finTotals.netAfterFees)}
                  </div>
                  <p className="text-xs text-indigo-700 font-semibold mt-1 font-mono">
                    Taxas Est.: {formatCurrencySafe(finTotals.totalFeeEstimated)}
                  </p>
                </div>
              </div>

              {/* Tabela Analítica por Método */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-lg font-bold text-slate-950">
                    Detalhamento Operacional por Meio de Pagamento
                  </h3>
                  <p className="text-xs font-semibold text-slate-600">
                    Taxas, status de liquidação e divergências por adquirente.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider bg-slate-100">
                        <th className="p-4">Método</th>
                        <th className="p-4 text-center">Transações</th>
                        <th className="p-4 text-right">Vendido Bruto</th>
                        <th className="p-4 text-right">Taxas Est.</th>
                        <th className="p-4 text-right">Recebido / Liquidado</th>
                        <th className="p-4 text-right">Pendente</th>
                        <th className="p-4 text-right">Líquido</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {methodsList.length === 0 ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="p-8 text-center text-slate-600 font-bold italic"
                          >
                            Nenhuma transação registrada neste período.
                          </td>
                        </tr>
                      ) : (
                        methodsList.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-4 flex items-center gap-3 font-bold text-slate-950">
                              {getMethodIcon(m.method)}
                              <span>{m.method}</span>
                            </td>
                            <td className="p-4 text-center font-mono font-semibold text-slate-700">
                              {Number(m.count || 0)}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-slate-800">
                              {formatCurrencySafe(m.totalSold)}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-red-600">
                              {formatCurrencySafe(m.fee)}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-emerald-700">
                              {formatCurrencySafe(m.received)}
                            </td>
                            <td className="p-4 text-right font-mono font-semibold text-amber-700">
                              {formatCurrencySafe(m.pending)}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-indigo-700">
                              {formatCurrencySafe(m.net)}
                            </td>
                            <td className="p-4 text-center">
                              {Number(m.pending || 0) === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={12} /> Conciliado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock size={12} /> Em Compensação
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Auditoria do Caixa Físico (Gaveta vs Sistema) */}
              {reconcileData.physicalCashAudit && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-amber-600" />
                        Auditoria de Dinheiro em Especie (Gaveta de PDV)
                      </h3>
                      <p className="text-xs font-semibold text-slate-600">
                        Conferência de caixas físicos: Abertura, Vendas confirmadas, Sangrias,
                        Suprimentos e Fechamento.
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 font-mono">
                      {reconcileData.physicalCashAudit.shiftsCount}{' '}
                      {reconcileData.physicalCashAudit.shiftsCount === 1
                        ? 'turno analisado'
                        : 'turnos analisados'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-mono">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-600 block font-sans">
                        Fundo Inicial (Abertura)
                      </span>
                      <span className="text-lg font-bold text-slate-950">
                        {formatCurrencySafe(reconcileData.physicalCashAudit.totalOpeningCash)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-600 block font-sans">
                        Vendas em Dinheiro (PDV)
                      </span>
                      <span className="text-lg font-bold text-emerald-700">
                        {formatCurrencySafe(reconcileData.physicalCashAudit.posRecordedCashSales)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-600 block font-sans">
                        Suprimentos
                      </span>
                      <span className="text-lg font-bold text-blue-700">
                        + {formatCurrencySafe(reconcileData.physicalCashAudit.totalSuprimento)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-600 block font-sans">
                        Sangrias
                      </span>
                      <span className="text-lg font-bold text-red-700">
                        - {formatCurrencySafe(reconcileData.physicalCashAudit.totalSangria)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                    <div className="text-sm">
                      <span className="font-bold text-slate-600 mr-2 font-sans">
                        Esperado em Gaveta:
                      </span>
                      <strong className="text-slate-950 text-base">
                        {formatCurrencySafe(reconcileData.physicalCashAudit.totalExpectedCash)}
                      </strong>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-slate-600 mr-2 font-sans">
                        Fechamento Real Informado:
                      </span>
                      <strong className="text-slate-950 text-base">
                        {formatCurrencySafe(reconcileData.physicalCashAudit.totalActualCash)}
                      </strong>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-slate-600 mr-2 font-sans">
                        Diferença/Quebra de Caixa:
                      </span>
                      <strong
                        className={`text-base font-black ${Number(reconcileData.physicalCashAudit.totalCashDifference || 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                      >
                        {formatCurrencySafe(reconcileData.physicalCashAudit.totalCashDifference)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal Conciliar Manual */}
      {isMatchModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                <Check className="w-6 h-6 text-indigo-600" />
                Conciliar Divergência
              </h3>
              <button
                onClick={() => setIsMatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMatchManual} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-2">
                <div className="text-slate-950 font-bold">{selectedIssue.title}</div>
                <div className="text-slate-700 font-semibold text-xs">
                  {selectedIssue.description}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Parecer da Auditoria *
                </label>
                <textarea
                  value={matchNotes}
                  onChange={(e) => setMatchNotes(e.target.value)}
                  placeholder="Justifique a aprovação desta divergência para registro de auditoria..."
                  rows={3}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMatchModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Gravando...' : 'Confirmar e Conciliar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
