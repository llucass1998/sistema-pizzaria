import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  Trash2,
  FileText,
  Clock,
  TrendingDown,
  Building,
  CreditCard,
} from 'lucide-react';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');
import { PageContainer } from '../../components/ui/PageContainer.jsx';
import { NewPayableModal } from './NewPayableModal.jsx';
import { PayablePaymentModal } from './PayablePaymentModal.jsx';

const STATUS_LABELS = {
  ALL: 'Todos os Status',
  PENDING: 'Pendentes',
  PARTIALLY_PAID: 'Pago Parcial',
  PAID: 'Quitados',
  OVERDUE: 'Atrasados / Vencidos',
  CANCELED: 'Cancelados',
};

const CATEGORY_BADGES = {
  SUPPLIER: { label: 'Insumos', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  RENT: { label: 'Imóvel/Aluguel', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  ENERGY: { label: 'Energia', bg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
  WATER: { label: 'Água', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  INTERNET: { label: 'Internet/Tel', bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
  SALARY: { label: 'Salário/Pessoal', bg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
  MARKETING: { label: 'Marketing', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  TAX: { label: 'Impostos', bg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  MAINTENANCE: { label: 'Manutenção', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  OTHER: { label: 'Outros', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
};

export default function AccountsPayable() {
  const [payables, setPayables] = useState([]);
  const [summary, setSummary] = useState({
    totalOverdue: 0,
    dueIn7Days: 0,
    dueIn30Days: 0,
    totalPending: 0,
    paidThisMonth: 0,
  });
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedForPayment, setSelectedForPayment] = useState(null);
  const [selectedForDetails, setSelectedForDetails] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';
      const headers = { 'Authorization': `Bearer ${token}` };

      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      if (categoryFilter !== 'ALL') queryParams.append('category', categoryFilter);
      if (search.trim()) queryParams.append('search', search.trim());

      const [payRes, sumRes, supRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/payables?${queryParams.toString()}`, { headers }),
        fetch(`${API_BASE_URL}/admin/payables/summary`, { headers }),
        fetch(`${API_BASE_URL}/purchases/suppliers`, { headers }).catch(() => ({ ok: false })),
      ]);

      if (payRes.ok) setPayables(await payRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
      if (supRes && supRes.ok) setSuppliers(await supRes.json());
    } catch (e) {
      console.error('Erro ao carregar Contas a Pagar:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter]);

  async function handleCancelPayable(id) {
    if (!window.confirm('Tem certeza que deseja cancelar esta conta a pagar?')) return;
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';
      const res = await fetch(`${API_BASE_URL}/admin/payables/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Erro ao cancelar conta.');
      }
    } catch (e) {
      alert('Erro ao cancelar despesa.');
    }
  }

  const filteredPayables = payables.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.description?.toLowerCase().includes(q) ||
      p.supplier?.name?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Cabeçalho */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <a
              href="#/admin"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ArrowLeft size={22} />
            </a>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                Contas a Pagar
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                ERP Financeiro — Gestão de despesas, insumos, fornecedores e vencimentos
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-amber-500 active:scale-95"
          >
            <Plus size={20} />
            <span>Nova Despesa</span>
          </button>
        </header>

        {/* KPIs Executivos */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-rose-200/60 bg-gradient-to-br from-rose-500/10 to-rose-600/5 p-5 shadow-sm dark:border-rose-900/30 dark:from-rose-950/40 dark:to-slate-900">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
              <span className="text-xs font-black uppercase tracking-wider">Total Atrasado</span>
              <AlertCircle size={22} />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">
              R$ {Number(summary.totalOverdue).toFixed(2)}
            </p>
            <p className="mt-1 text-xs font-semibold text-rose-600/80 dark:text-rose-400/80">
              Ação imediata necessária
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5 shadow-sm dark:border-amber-900/30 dark:from-amber-950/40 dark:to-slate-900">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-xs font-black uppercase tracking-wider">Vence em 7 Dias</span>
              <Clock size={22} />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">
              R$ {Number(summary.dueIn7Days).toFixed(2)}
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-600/80 dark:text-amber-400/80">
              Previsão de curto prazo
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-5 shadow-sm dark:border-blue-900/30 dark:from-blue-950/40 dark:to-slate-900">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
              <span className="text-xs font-black uppercase tracking-wider">Total Pendente</span>
              <TrendingDown size={22} />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">
              R$ {Number(summary.totalPending).toFixed(2)}
            </p>
            <p className="mt-1 text-xs font-semibold text-blue-600/80 dark:text-blue-400/80">
              Saldo devedor total
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/40 dark:to-slate-900">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-black uppercase tracking-wider">Pago Este Mês</span>
              <CheckCircle2 size={22} />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">
              R$ {Number(summary.paidThisMonth).toFixed(2)}
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/80">
              Baixas realizadas no mês
            </p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descrição, fornecedor ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="ALL">Todas Categorias</option>
              {Object.entries(CATEGORY_BADGES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela / Lista de Contas a Pagar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
              <p className="mt-2 text-sm font-semibold">Carregando despesas...</p>
            </div>
          ) : filteredPayables.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
              <h3 className="mt-3 text-lg font-bold text-slate-700 dark:text-slate-300">
                Nenhuma conta encontrada
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Tente alterar os filtros ou clique em "Nova Despesa" para cadastrar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayables.map((item) => {
                const badge = CATEGORY_BADGES[item.category] || CATEGORY_BADGES.OTHER;
                const totalAmount = Number(item.amount);
                const paidAmount = Number(item.paidAmount || 0);
                const remaining = Number(item.remainingAmount ?? totalAmount - paidAmount);
                const isPaid = item.status === 'PAID';
                const isOverdue = item.status === 'OVERDUE';
                const isCanceled = item.status === 'CANCELED';

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition hover:bg-slate-100/50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-950 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.bg}`}
                        >
                          {badge.label}
                        </span>

                        {isPaid && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            <CheckCircle2 size={13} /> Quitada
                          </span>
                        )}
                        {isOverdue && (
                          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 animate-pulse">
                            <AlertCircle size={13} /> Vencida / Atrasada
                          </span>
                        )}
                        {item.status === 'PENDING' && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            Pendente
                          </span>
                        )}
                        {item.status === 'PARTIALLY_PAID' && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            Pago Parcial
                          </span>
                        )}
                        {isCanceled && (
                          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400 line-through">
                            Cancelada
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {item.description}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Building size={14} className="text-slate-400" />
                          {item.supplier?.name || 'Fornecedor Avulso'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} className="text-slate-400" />
                          Vence: {new Date(item.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        {item.recurrenceType && item.recurrenceType !== 'NONE' && (
                          <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {item.recurrenceType}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-slate-200/60 pt-4 dark:border-slate-800/60 sm:flex-row sm:items-center sm:justify-between lg:border-t-0 lg:pt-0">
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-semibold text-slate-400">Valor Total</span>
                        <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                          R$ {totalAmount.toFixed(2)}
                        </span>
                        {paidAmount > 0 && !isPaid && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Pago: R$ {paidAmount.toFixed(2)} | Resta: R$ {remaining.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isPaid && !isCanceled && (
                          <button
                            onClick={() => setSelectedForPayment(item)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/10 transition hover:bg-emerald-400 active:scale-95"
                          >
                            <DollarSign size={16} />
                            <span>Baixar / Pagar</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedForDetails(item)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Histórico
                        </button>

                        {!isPaid && !isCanceled && (
                          <button
                            onClick={() => handleCancelPayable(item.id)}
                            title="Cancelar despesa"
                            className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modais */}
      <NewPayableModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={loadData}
        suppliers={suppliers}
      />

      <PayablePaymentModal
        isOpen={!!selectedForPayment}
        onClose={() => setSelectedForPayment(null)}
        onSuccess={loadData}
        payable={selectedForPayment}
      />

      {/* Modal Detalhes/Histórico */}
      {selectedForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Detalhes da Despesa
              </h3>
              <button
                onClick={() => setSelectedForDetails(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedForDetails.description}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Categoria: {selectedForDetails.category} | Vencimento:{' '}
                  {new Date(selectedForDetails.dueDate + 'T00:00:00').toLocaleDateString()}
                </p>
                {selectedForDetails.notes && (
                  <p className="mt-2 text-xs italic text-slate-500">"{selectedForDetails.notes}"</p>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Histórico de Baixas / Pagamentos ({selectedForDetails.payments?.length || 0})
                </h4>
                {selectedForDetails.payments && selectedForDetails.payments.length > 0 ? (
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {selectedForDetails.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
                      >
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {p.paymentMethod}
                          </span>
                          <span className="ml-2 text-slate-400">
                            em {new Date(p.createdAt).toLocaleDateString()}
                          </span>
                          {p.notes && <p className="text-[11px] text-slate-500">{p.notes}</p>}
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          + R$ {Number(p.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Nenhum pagamento registrado ainda.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedForDetails(null)}
                className="rounded-xl bg-slate-100 px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
