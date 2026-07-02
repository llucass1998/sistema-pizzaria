import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  CreditCard,
  Download,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import ERPLayout from '../../components/ERPLayout.jsx';
import { formatCurrency } from '../../data/menuData.js';

const savedAdminKey = 'pizzaria-admin';

const fallbackSummary = {
  todayRevenue: 1250,
  pendingAmount: 345,
  averageTicket: 68.5,
  orderCount: 18,
  paidCount: 14,
  pendingCount: 4,
  paymentMix: [
    { method: 'PIX', total: 620 },
    { method: 'CREDIT', total: 410 },
    { method: 'CASH', total: 220 },
    { method: 'A RECEBER', total: 345 },
  ],
  hourlyRevenue: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}h`,
    total: [18, 19, 20, 21, 22].includes(hour) ? (hour - 17) * 180 : 0,
    orders: [18, 19, 20, 21, 22].includes(hour) ? hour - 16 : 0,
  })),
  transactions: [
    {
      id: 'FAT-001',
      customer: 'Joao Silva',
      date: '2026-06-26T14:30:00.000Z',
      total: 150,
      status: 'PAID',
      paymentMethod: 'PIX',
      items: 2,
    },
    {
      id: 'FAT-002',
      customer: 'Maria Oliveira',
      date: '2026-06-26T15:45:00.000Z',
      total: 45,
      status: 'PENDING',
      paymentMethod: 'A RECEBER',
      items: 1,
    },
    {
      id: 'FAT-003',
      customer: 'Carlos Mendes',
      date: '2026-06-26T18:00:00.000Z',
      total: 320,
      status: 'PAID',
      paymentMethod: 'CREDIT',
      items: 5,
    },
  ],
};

function getSavedAdminSession() {
  try {
    return JSON.parse(window.localStorage.getItem(savedAdminKey) ?? 'null');
  } catch (error) {
    
    return null;
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getStatusConfig(status) {
  if (status === 'PAID' || status === 'COMPLETED') {
    return {
      label: 'Pago',
      className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    };
  }

  if (status === 'CANCELED') {
    return {
      label: 'Cancelado',
      className: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    };
  }

  if (status === 'PARTIAL' || status === 'PARTIALLY_PAID') {
    return {
      label: 'Parcial',
      className: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    };
  }

  return {
    label: 'Pendente',
    className: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  };
}

function getPaymentMethodLabel(method) {
  const labels = {
    PIX: 'PIX',
    CASH: 'Dinheiro',
    CREDIT: 'Credito',
    DEBIT: 'Debito',
    CREDIT_CARD: 'Credito',
    DEBIT_CARD: 'Debito',
    ONLINE_CARD: 'Online',
    CARD: 'Cartao',
    'A RECEBER': 'A receber',
  };

  return labels[method] ?? method;
}

export default function Billing({ apiBaseUrl }) {
  const [session] = useState(getSavedAdminSession);
  const [summary, setSummary] = useState(fallbackSummary);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.token ?? ''}`,
    }),
    [session?.token],
  );

  const chartHours = useMemo(
    () => (summary.hourlyRevenue ?? []).filter((entry) => entry.total > 0 || entry.hour >= 16),
    [summary.hourlyRevenue],
  );
  const maxHourlyTotal = useMemo(
    () => Math.max(1, ...chartHours.map((entry) => Number(entry.total ?? 0))),
    [chartHours],
  );
  const totalPaymentMix = useMemo(
    () =>
      Math.max(
        1,
        (summary.paymentMix ?? []).reduce((sum, item) => sum + Number(item.total), 0),
      ),
    [summary.paymentMix],
  );

  const loadBilling = useCallback(async () => {
    setError('');

    if (!session?.token) {
      setError('Entre como administrador para ver o faturamento real.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/billing/summary`, {
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Nao foi possivel carregar o faturamento.');
      }

      setSummary(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o faturamento.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, authHeaders, session?.token]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  return (
    <ERPLayout activeTab="faturamento">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-sky-300">Finance command</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-white">
              Faturamento gerencial
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-400">
              Receita, contas a receber, mix de pagamento e desempenho por horario.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={loadBilling}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-slate-200 transition hover:border-sky-300/40 hover:bg-sky-300/10"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-300 px-5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(125,211,252,0.2)] transition hover:bg-sky-200"
            >
              <Download size={18} />
              Exportar
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Wallet}
            label="Recebido hoje"
            value={formatCurrency(summary.todayRevenue ?? 0)}
            detail={`${summary.paidCount ?? 0} recebimentos`}
            tone="emerald"
            trendIcon={ArrowUpRight}
            trend="+14%"
          />
          <MetricCard
            icon={Clock}
            label="A receber"
            value={formatCurrency(summary.pendingAmount ?? 0)}
            detail={`${summary.pendingCount ?? 0} pendencias`}
            tone="amber"
          />
          <MetricCard
            icon={TrendingUp}
            label="Ticket medio"
            value={formatCurrency(summary.averageTicket ?? 0)}
            detail={`${summary.orderCount ?? 0} pedidos no dia`}
            tone="sky"
            trendIcon={ArrowDownRight}
            trend="-2%"
          />
          <MetricCard
            icon={Receipt}
            label="Lancamentos"
            value={summary.orderCount ?? 0}
            detail="Pedidos faturaveis"
            tone="rose"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white">Vendas por hora</h3>
                <p className="text-sm font-medium text-slate-400">
                  Concentracao do movimento de hoje.
                </p>
              </div>
              <TrendingUp className="text-sky-300" size={22} />
            </div>

            <div className="flex h-72 items-end gap-2 overflow-x-auto pb-2">
              {chartHours.map((entry) => {
                const height = Math.max(8, (Number(entry.total) / maxHourlyTotal) * 100);

                return (
                  <div
                    key={entry.hour}
                    className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div className="flex h-56 w-full items-end rounded-lg border border-white/10 bg-black/20 p-1">
                      <div
                        className="w-full rounded-md bg-gradient-to-t from-sky-400 via-indigo-400 to-orange-300 shadow-[0_0_18px_rgba(125,211,252,0.24)] transition-all"
                        style={{ height: `${height}%` }}
                        title={`${entry.label}: ${formatCurrency(entry.total)}`}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-slate-300">{entry.label}</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {entry.orders} ped.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white">Mix de pagamento</h3>
                <p className="text-sm font-medium text-slate-400">Participacao por meio.</p>
              </div>
              <CreditCard className="text-orange-300" size={22} />
            </div>

            <div className="space-y-4">
              {(summary.paymentMix ?? []).map((item) => {
                const percent = Math.round((Number(item.total) / totalPaymentMix) * 100);

                return (
                  <div key={item.method}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-white">
                        {getPaymentMethodLabel(item.method)}
                      </span>
                      <span className="text-sm font-bold text-slate-300">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-300 to-sky-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-white">Transacoes recentes</h3>
              <p className="text-sm font-medium text-slate-400">
                Pedidos, faturas e status financeiro.
              </p>
            </div>
            <Receipt className="text-slate-500" size={20} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-white/10 bg-black/20 text-xs font-black uppercase text-slate-500">
                  <th className="px-5 py-3">Fatura/Pedido</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Pagamento</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(summary.transactions ?? []).map((transaction) => {
                  const status = getStatusConfig(transaction.status);

                  return (
                    <tr key={transaction.id} className="transition hover:bg-white/[0.04]">
                      <td className="px-5 py-4">
                        <p className="font-black text-white">
                          #{String(transaction.id).slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase text-slate-500">
                          {transaction.items ?? 0} itens
                        </p>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-300">{transaction.customer}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-400">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-slate-300">
                        {getPaymentMethodLabel(transaction.paymentMethod)}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-white">
                        {formatCurrency(transaction.total)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ERPLayout>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone, trendIcon: TrendIcon, trend }) {
  const toneClasses = {
    emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-300/20',
    amber: 'bg-amber-400/10 text-amber-200 border-amber-300/20',
    sky: 'bg-sky-400/10 text-sky-300 border-sky-300/20',
    rose: 'bg-rose-400/10 text-rose-300 border-rose-300/20',
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">{detail}</p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${toneClasses[tone]}`}
        >
          <Icon size={22} />
        </div>
      </div>
      {TrendIcon && trend ? (
        <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-black text-slate-300">
          <TrendIcon size={14} />
          {trend} vs. ontem
        </div>
      ) : null}
    </div>
  );
}
