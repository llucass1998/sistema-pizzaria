import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Filter,
  PackagePlus,
  RefreshCw,
  Save,
  Scale,
  Search,
  TrendingUp,
} from 'lucide-react';
import ERPLayout from '../../components/ERPLayout.jsx';
import { formatCurrency } from '../../data/menuData.js';

const savedAdminKey = 'pizzaria-admin';

const sampleIngredients = [
  {
    id: 'sample-1',
    name: 'Mussarela Premium',
    stock: 12.5,
    minStock: 5,
    unit: 'kg',
    cost: 38,
    stockValue: 475,
    stockPercent: 100,
    reorderQuantity: 0,
    status: 'OK',
  },
  {
    id: 'sample-2',
    name: 'Calabresa Defumada',
    stock: 3,
    minStock: 5,
    unit: 'kg',
    cost: 32,
    stockValue: 96,
    stockPercent: 30,
    reorderQuantity: 7,
    status: 'CRITICAL',
  },
  {
    id: 'sample-3',
    name: 'Farinha Italiana 00',
    stock: 50,
    minStock: 25,
    unit: 'kg',
    cost: 7.5,
    stockValue: 375,
    stockPercent: 100,
    reorderQuantity: 0,
    status: 'OK',
  },
  {
    id: 'sample-4',
    name: 'Molho de Tomate',
    stock: 8,
    minStock: 10,
    unit: 'L',
    cost: 9,
    stockValue: 72,
    stockPercent: 40,
    reorderQuantity: 12,
    status: 'LOW',
  },
];

function getSavedAdminSession() {
  try {
    return JSON.parse(window.localStorage.getItem(savedAdminKey) ?? 'null');
  } catch (error) {
    
    return null;
  }
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));
}

function getStatusConfig(status) {
  if (status === 'OUT') {
    return {
      label: 'Sem saldo',
      className: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
      bar: 'bg-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.65)]',
      Icon: AlertTriangle,
    };
  }

  if (status === 'CRITICAL') {
    return {
      label: 'Critico',
      className: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
      bar: 'bg-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.65)]',
      Icon: AlertTriangle,
    };
  }

  if (status === 'LOW') {
    return {
      label: 'Baixo',
      className: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
      bar: 'bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.5)]',
      Icon: AlertTriangle,
    };
  }

  return {
    label: 'Saudavel',
    className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    bar: 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]',
    Icon: CheckCircle2,
  };
}

export default function Inventory({ apiBaseUrl }) {
  const [session] = useState(getSavedAdminSession);
  const [ingredients, setIngredients] = useState(sampleIngredients);
  const [transactions, setTransactions] = useState([]);
  const [query, setQuery] = useState('');
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    unit: 'kg',
    cost: '',
    stock: '',
    minStock: '',
  });
  const [movement, setMovement] = useState({
    ingredientId: '',
    type: 'IN',
    quantity: '',
    cost: '',
    notes: '',
  });
  const [summary, setSummary] = useState({
    totalItems: sampleIngredients.length,
    totalStockValue: sampleIngredients.reduce((sum, item) => sum + item.stockValue, 0),
    criticalCount: sampleIngredients.filter((item) => item.status === 'CRITICAL').length,
    lowCount: sampleIngredients.filter((item) => item.status === 'LOW').length,
    purchaseSuggestion: sampleIngredients.reduce(
      (sum, item) => sum + item.reorderQuantity * item.cost,
      0,
    ),
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.token ?? ''}`,
    }),
    [session?.token],
  );

  const filteredIngredients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return ingredients;
    }

    return ingredients.filter((item) =>
      [item.name, item.unit, item.status].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    );
  }, [ingredients, query]);

  const purchaseList = useMemo(
    () =>
      ingredients
        .filter((item) => Number(item.reorderQuantity) > 0)
        .sort((a, b) => Number(b.reorderQuantity) - Number(a.reorderQuantity))
        .slice(0, 5),
    [ingredients],
  );

  const request = useCallback(
    async (path, options = {}) => {
      if (!session?.token) {
        throw new Error('Entre como administrador para gerenciar o estoque.');
      }

      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers ?? {}),
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? 'Nao foi possivel concluir a operacao.');
      }

      return data;
    },
    [apiBaseUrl, authHeaders, session?.token],
  );

  const loadInventory = useCallback(async () => {
    setError('');

    try {
      setIsLoading(true);
      const [nextSummary, nextTransactions] = await Promise.all([
        request('/inventory/summary'),
        request('/inventory/transactions?limit=12'),
      ]);

      setSummary(nextSummary);
      setIngredients(nextSummary.ingredients ?? []);
      setTransactions(nextTransactions);
      setMovement((current) => ({
        ...current,
        ingredientId: current.ingredientId || nextSummary.ingredients?.[0]?.id || '',
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o estoque.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (!message && !error) return undefined;
    const timeoutId = window.setTimeout(() => {
      setMessage('');
      setError('');
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [message, error]);

  async function createIngredient(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      await request('/inventory/ingredients', {
        method: 'POST',
        body: JSON.stringify(newIngredient),
      });
      setNewIngredient({ name: '', unit: 'kg', cost: '', stock: '', minStock: '' });
      setMessage('Insumo cadastrado.');
      await loadInventory();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Nao foi possivel cadastrar o insumo.',
      );
    }
  }

  async function createMovement(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      await request('/inventory/transactions', {
        method: 'POST',
        body: JSON.stringify(movement),
      });
      setMovement((current) => ({
        ...current,
        quantity: '',
        cost: current.type === 'IN' ? current.cost : '',
        notes: '',
      }));
      setMessage('Movimentacao registrada.');
      await loadInventory();
    } catch (movementError) {
      setError(
        movementError instanceof Error
          ? movementError.message
          : 'Nao foi possivel movimentar o estoque.',
      );
    }
  }

  return (
    <ERPLayout activeTab="estoque">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-orange-300">Supply control</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-white">
              Estoque inteligente
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-400">
              Controle de insumos com nivel minimo, sugestao de compra, perdas e auditoria de
              movimentacoes.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block w-full sm:min-w-[260px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={18}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-10 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-orange-300/70 focus:ring-2 focus:ring-orange-300/15"
                placeholder="Buscar insumo"
              />
            </label>
            <button
              type="button"
              onClick={loadInventory}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-slate-200 transition hover:border-sky-300/40 hover:bg-sky-300/10"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {message || error ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-bold ${
              error
                ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
            }`}
          >
            {error || message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Boxes}
            label="Itens ativos"
            value={summary.totalItems}
            tone="sky"
            detail="Insumos monitorados"
          />
          <MetricCard
            icon={TrendingUp}
            label="Valor em estoque"
            value={formatCurrency(summary.totalStockValue ?? 0)}
            tone="emerald"
            detail="Custo medio atual"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Criticos"
            value={summary.criticalCount}
            tone="rose"
            detail={`${summary.lowCount ?? 0} itens em atencao`}
          />
          <MetricCard
            icon={ClipboardList}
            label="Compra sugerida"
            value={formatCurrency(summary.purchaseSuggestion ?? 0)}
            tone="amber"
            detail="Para recompor PAR"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={createMovement}
            className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white">Lancamento rapido</h3>
                <p className="text-sm font-medium text-slate-400">
                  Entrada, saida, perda ou ajuste de saldo.
                </p>
              </div>
              <Scale className="text-orange-300" size={24} />
            </div>

            <div className="grid gap-3 md:grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr]">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500">Insumo</span>
                <select
                  value={movement.ingredientId}
                  onChange={(event) =>
                    setMovement((current) => ({ ...current, ingredientId: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none focus:border-orange-300/70 focus:ring-2 focus:ring-orange-300/15"
                >
                  <option value="">Selecione</option>
                  {ingredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500">Operacao</span>
                <select
                  value={movement.type}
                  onChange={(event) =>
                    setMovement((current) => ({ ...current, type: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none focus:border-orange-300/70 focus:ring-2 focus:ring-orange-300/15"
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Saida</option>
                  <option value="WASTE">Perda</option>
                  <option value="ADJUSTMENT">Ajuste</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500">Qtd</span>
                <input
                  value={movement.quantity}
                  onChange={(event) =>
                    setMovement((current) => ({ ...current, quantity: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none focus:border-orange-300/70 focus:ring-2 focus:ring-orange-300/15"
                  placeholder="0,00"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-500">Custo</span>
                <input
                  value={movement.cost}
                  onChange={(event) =>
                    setMovement((current) => ({ ...current, cost: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none focus:border-orange-300/70 focus:ring-2 focus:ring-orange-300/15"
                  placeholder="Opcional"
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={movement.notes}
                onChange={(event) =>
                  setMovement((current) => ({ ...current, notes: event.target.value }))
                }
                className="h-11 rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-orange-300/70 focus:ring-2 focus:ring-orange-300/15"
                placeholder="Observacao, fornecedor ou motivo"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-400 px-5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(251,146,60,0.25)] transition hover:bg-orange-300"
              >
                <Save size={18} />
                Confirmar
              </button>
            </div>
          </form>

          <form
            onSubmit={createIngredient}
            className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white">Novo insumo</h3>
                <p className="text-sm font-medium text-slate-400">
                  Base para ficha tecnica e compras.
                </p>
              </div>
              <PackagePlus className="text-emerald-300" size={24} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={newIngredient.name}
                onChange={(event) =>
                  setNewIngredient((current) => ({ ...current, name: event.target.value }))
                }
                className="h-11 rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15"
                placeholder="Nome do insumo"
              />
              <input
                value={newIngredient.unit}
                onChange={(event) =>
                  setNewIngredient((current) => ({ ...current, unit: event.target.value }))
                }
                className="h-11 rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15"
                placeholder="Unidade"
              />
              <input
                value={newIngredient.cost}
                onChange={(event) =>
                  setNewIngredient((current) => ({ ...current, cost: event.target.value }))
                }
                className="h-11 rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15"
                placeholder="Custo unitario"
              />
              <input
                value={newIngredient.minStock}
                onChange={(event) =>
                  setNewIngredient((current) => ({ ...current, minStock: event.target.value }))
                }
                className="h-11 rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15"
                placeholder="Estoque minimo"
              />
              <input
                value={newIngredient.stock}
                onChange={(event) =>
                  setNewIngredient((current) => ({ ...current, stock: event.target.value }))
                }
                className="h-11 rounded-lg border border-white/10 bg-[#101421] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15 sm:col-span-2"
                placeholder="Saldo inicial"
              />
            </div>

            <button
              type="submit"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(52,211,153,0.18)] transition hover:bg-emerald-300"
            >
              <PackagePlus size={18} />
              Cadastrar insumo
            </button>
          </form>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white">Posicao atual</h3>
                <p className="text-sm font-medium text-slate-400">
                  Saldo, minimo e cobertura por insumo.
                </p>
              </div>
              <Filter className="text-slate-500" size={20} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20 text-xs font-black uppercase text-slate-500">
                    <th className="px-5 py-3">Insumo</th>
                    <th className="px-5 py-3">Nivel</th>
                    <th className="px-5 py-3 text-right">Saldo</th>
                    <th className="px-5 py-3 text-right">Custo</th>
                    <th className="px-5 py-3 text-right">Reposicao</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredIngredients.map((item) => {
                    const status = getStatusConfig(item.status);
                    const StatusIcon = status.Icon;
                    const percent = Math.max(0, Math.min(100, Number(item.stockPercent ?? 0)));

                    return (
                      <tr key={item.id} className="transition hover:bg-white/[0.04]">
                        <td className="px-5 py-4">
                          <p className="font-black text-white">{item.name}</p>
                          <p className="mt-1 text-xs font-bold uppercase text-slate-500">
                            Minimo {formatNumber(item.minStock)} {item.unit}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 w-40 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full ${status.bar}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="w-10 text-xs font-black text-slate-400">
                              {percent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-white">
                          {formatNumber(item.stock)}{' '}
                          <span className="text-xs text-slate-500">{item.unit}</span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-300">
                          {formatCurrency(item.cost ?? 0)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-300">
                          {Number(item.reorderQuantity) > 0
                            ? `${formatNumber(item.reorderQuantity)} ${item.unit}`
                            : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${status.className}`}
                          >
                            <StatusIcon size={14} />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <h3 className="text-lg font-black text-white">Lista de compra</h3>
              <p className="mt-1 text-sm font-medium text-slate-400">
                Sugestao para recompor o estoque alvo.
              </p>

              <div className="mt-4 space-y-3">
                {purchaseList.length === 0 ? (
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
                    Estoque dentro do PAR.
                  </div>
                ) : (
                  purchaseList.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">{item.name}</p>
                          <p className="mt-1 text-xs font-bold uppercase text-slate-500">
                            Comprar {formatNumber(item.reorderQuantity)} {item.unit}
                          </p>
                        </div>
                        <span className="text-sm font-black text-amber-200">
                          {formatCurrency(item.reorderQuantity * item.cost)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <h3 className="text-lg font-black text-white">Ultimas movimentacoes</h3>
              <div className="mt-4 space-y-3">
                {transactions.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-500">Sem movimentos recentes.</p>
                ) : (
                  transactions.map((transaction) => {
                    const isIn = transaction.type === 'IN';
                    const Icon = isIn ? ArrowUpRight : ArrowDownRight;

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            isIn
                              ? 'bg-emerald-400/10 text-emerald-300'
                              : 'bg-rose-400/10 text-rose-300'
                          }`}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-white">
                            {transaction.ingredient?.name ?? 'Insumo'}
                          </p>
                          <p className="text-xs font-bold uppercase text-slate-500">
                            {transaction.type} - {formatNumber(transaction.quantity)}{' '}
                            {transaction.ingredient?.unit ?? ''}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </ERPLayout>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  const toneClasses = {
    sky: 'bg-sky-400/10 text-sky-300 border-sky-300/20',
    emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-300/20',
    rose: 'bg-rose-400/10 text-rose-300 border-rose-300/20',
    amber: 'bg-amber-400/10 text-amber-200 border-amber-300/20',
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">{detail}</p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-lg border ${toneClasses[tone]}`}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
