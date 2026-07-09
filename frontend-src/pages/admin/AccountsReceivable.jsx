import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  DollarSign,
  Clock,
  AlertTriangle,
  FileText,
  Edit,
  RotateCcw,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { formatCurrencySafe } from '../../data/menuData.js';
import { RecordPaymentModal } from './RecordPaymentModal.jsx';
import { EditInvoiceModal } from './EditInvoiceModal.jsx';
import { ReversePaymentModal } from './ReversePaymentModal.jsx';

function isInvoicePaid(status) {
  return ['PAID', 'COMPLETED'].includes(status);
}

const STATUS_LABELS = {
  ALL: 'Todos os Status',
  PENDING: 'Pendente',
  PARTIALLY_PAID: 'Pago Parcial',
  PAID: 'Pago / Quitado',
  OVERDUE: 'Atrasado / Vencido',
  CANCELED: 'Cancelado',
};

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export default function AccountsReceivable() {
  const adminDataStr =
    typeof window !== 'undefined' ? window.localStorage.getItem('pizzaria-admin') : null;
  const adminData = adminDataStr ? JSON.parse(adminDataStr) : null;
  const userRole = adminData?.user?.role || adminData?.role || '';

  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalPaid: 0,
    totalOverdue: 0,
    countPending: 0,
    countPaid: 0,
    countOverdue: 0,
    totalInvoices: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Paginação
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modais
  const [selectedForPayment, setSelectedForPayment] = useState(null);
  const [selectedForEdit, setSelectedForEdit] = useState(null);
  const [selectedForReverse, setSelectedForReverse] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';
      const headers = { Authorization: `Bearer ${token}` };

      // Carregar Summary
      fetch(`${API_BASE_URL}/admin/receivables/invoices/summary`, { headers })
        .then((r) => (r.ok ? r.json() : {}))
        .then((sum) => {
          if (sum && typeof sum.totalPending !== 'undefined') {
            setSummary(sum);
          }
        })
        .catch(() => {});

      // Carregar Invoices com paginação e filtros
      const params = new URLSearchParams({
        paginated: 'true',
        page: page.toString(),
        limit: '10',
      });
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`${API_BASE_URL}/admin/receivables/invoices?${params.toString()}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          setInvoices(data.data);
          setPagination(
            data.pagination || { page: 1, limit: 10, total: data.data.length, totalPages: 1 },
          );
        } else if (Array.isArray(data)) {
          setInvoices(data);
          setPagination({ page: 1, limit: 10, total: data.length, totalPages: 1 });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const resetFilters = () => {
    setStatusFilter('ALL');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  if (userRole === 'KITCHEN' || userRole === 'DRIVER' || userRole === 'DELIVERY') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center backdrop-blur-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-slate-300 max-w-md mx-auto">
            O seu perfil (<span className="text-red-400 font-semibold">{userRole}</span>) não possui
            permissões para acessar Contas a Receber.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                Contas a Receber
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Gestão financeira ERP, recebíveis, conciliação e estornos
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar Dados
          </button>
        </header>

        {/* KPIs ERP Premium */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-6 shadow-sm dark:border-amber-900/40 dark:from-amber-950/40 dark:to-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                A Receber / Pendente
              </span>
              <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                <Clock size={20} />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
              {formatCurrencySafe(summary?.totalPending ?? 0)}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {summary.countPending || 0} fatura(s) pendente(s)
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Total Recebido
              </span>
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
              {formatCurrencySafe(summary?.totalPaid ?? 0)}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {summary.countPaid || 0} fatura(s) quitada(s)
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-500/10 to-red-500/5 p-6 shadow-sm dark:border-red-900/40 dark:from-red-950/40 dark:to-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-400">
                Vencido / Atrasado
              </span>
              <div className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/60 dark:text-red-300">
                <AlertTriangle size={20} />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
              {formatCurrencySafe(summary?.totalOverdue ?? 0)}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {summary.countOverdue || 0} fatura(s) vencida(s)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-500/10 to-slate-500/5 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Total de Faturas
              </span>
              <div className="rounded-full bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <FileText size={20} />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
              {summary.totalInvoices || 0}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              Registros no período
            </p>
          </div>
        </div>

        {/* Barra de Filtros */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5"
          >
            <div className="md:col-span-2 lg:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Buscar (Pedido, Cliente ou Telefone)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: PED-1234 ou Nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-red-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
                />
                <Search size={18} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Emissão (Início)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  Emissão (Fim)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-end gap-2 md:col-span-4 lg:col-span-5 justify-end mt-2">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Limpar Filtros
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Filter size={14} />
                Filtrar
              </button>
            </div>
          </form>
        </section>

        {/* Tabela de Recebíveis ERP */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              Listagem de Faturas ({pagination.total || invoices.length})
            </h2>
          </div>

          {loading ? (
            <div className="py-12 text-center font-bold text-slate-500 dark:text-slate-400">
              Carregando recebíveis...
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <Wallet size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold">Nenhuma fatura encontrada com os critérios selecionados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((inv) => {
                const isCompleted = isInvoicePaid(inv.status);
                const totalPaid = inv.payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
                const totalAmount = Number(inv.totalAmount || 0);
                const remaining = Math.max(0, totalAmount - totalPaid);
                const progress =
                  totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0;
                const isOverdue = !isCompleted && inv.dueDate && new Date(inv.dueDate) < new Date();

                return (
                  <div
                    key={inv.id}
                    className={`flex flex-col gap-4 rounded-xl border p-5 transition ${
                      isOverdue
                        ? 'border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/10'
                        : isCompleted
                          ? 'border-emerald-200/60 bg-emerald-50/10 dark:border-emerald-900/30 dark:bg-emerald-950/10'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                            {inv.order?.customer?.name || 'Cliente Avulso'}
                          </h3>
                          {inv.orderId && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              #{inv.orderId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <span>
                            Emissão:{' '}
                            {new Date(
                              inv.issueDate || inv.createdAt || Date.now(),
                            ).toLocaleDateString()}
                          </span>
                          <span className={isOverdue ? 'text-red-600 font-black' : ''}>
                            Vencimento:{' '}
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'À vista'}
                          </span>
                          {inv.order?.customer?.phone && (
                            <span>Tel: {inv.order.customer.phone}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right mr-2">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Valor Total
                          </p>
                          <p className="text-lg font-black text-slate-900 dark:text-white">
                            {formatCurrencySafe(totalAmount)}
                          </p>
                        </div>

                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 size={14} /> Quitado
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1.5 text-xs font-black text-red-800 dark:bg-red-950 dark:text-red-300">
                            <AlertTriangle size={14} /> Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertCircle size={14} />{' '}
                            {['PARTIALLY_PAID', 'PARTIAL'].includes(inv.status)
                              ? 'Pago Parcial'
                              : 'Pendente'}
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          {!isCompleted && (
                            <button
                              onClick={() => setSelectedForPayment(inv)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
                            >
                              <DollarSign size={14} />
                              Receber
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedForEdit(inv)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            title="Editar Fatura"
                          >
                            <Edit size={14} />
                            Editar
                          </button>
                          <button
                            onClick={() => setSelectedForReverse(inv)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            title="Ver Pagamentos / Estornar"
                          >
                            <RotateCcw size={14} />
                            Estorno ({inv.payments?.length || 0})
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progresso de Pagamento */}
                    <div className="w-full">
                      <div className="mb-1 flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrencySafe(totalPaid)} recebido ({progress.toFixed(0)}%)
                        </span>
                        <span>{formatCurrencySafe(remaining)} restante</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted
                              ? 'bg-emerald-500'
                              : isOverdue
                                ? 'bg-red-500'
                                : 'bg-amber-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Controle de Paginação */}
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(Math.max(1, pagination.page - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(Math.min(pagination.totalPages, pagination.page + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Próxima
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <RecordPaymentModal
        isOpen={!!selectedForPayment}
        onClose={() => setSelectedForPayment(null)}
        onSuccess={loadData}
        invoice={selectedForPayment}
      />

      <EditInvoiceModal
        isOpen={!!selectedForEdit}
        onClose={() => setSelectedForEdit(null)}
        onSuccess={loadData}
        invoice={selectedForEdit}
      />

      <ReversePaymentModal
        isOpen={!!selectedForReverse}
        onClose={() => setSelectedForReverse(null)}
        onSuccess={loadData}
        invoice={selectedForReverse}
      />
    </>
  );
}
