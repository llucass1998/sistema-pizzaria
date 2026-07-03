import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  DollarSign,
  PlusCircle,
  MinusCircle,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  ShieldAlert,
  CreditCard,
  User,
  Calendar,
} from 'lucide-react';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');
import { PageContainer } from '../../components/ui/PageContainer.jsx';
import {
  OpenShiftModal,
  CloseShiftModal,
  CashTransactionModal,
} from '../../components/admin/ShiftModals.jsx';

const PAYMENT_METHOD_LABELS = {
  CASH: { label: 'Dinheiro', color: 'bg-emerald-500 text-emerald-600' },
  PIX: { label: 'PIX Instantâneo', color: 'bg-cyan-500 text-cyan-600' },
  CREDIT_CARD: { label: 'Cartão de Crédito', color: 'bg-purple-500 text-purple-600' },
  DEBIT_CARD: { label: 'Cartão de Débito', color: 'bg-blue-500 text-blue-600' },
  MEAL_VOUCHER: { label: 'Vale Refeição / Alimentação', color: 'bg-amber-500 text-amber-600' },
  ONLINE: { label: 'Pagamento Online / App', color: 'bg-pink-500 text-pink-600' },
  OTHER: { label: 'Outros Métodos', color: 'bg-slate-500 text-slate-600' },
};

export default function ShiftAuditPage() {
  const [currentShift, setCurrentShift] = useState(null);
  const [auditReport, setAuditReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState(null);
  const [activeTab, setActiveTab] = useState('CURRENT'); // CURRENT | HISTORY

  // Timer do turno
  const [elapsedTime, setElapsedTime] = useState('00h 00m 00s');

  // Modais
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  useEffect(() => {
    const adminStr = window.localStorage.getItem('pizzaria-admin');
    if (adminStr) {
      setAdminData(JSON.parse(adminStr));
    }
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const token = adminData?.token || (window.localStorage.getItem('pizzaria-admin') ? JSON.parse(window.localStorage.getItem('pizzaria-admin')).token : '');
      const headers = { Authorization: `Bearer ${token}` };

      const [curRes, repRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/pos/shift/current`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_BASE_URL}/admin/pos/shift/audit`, { headers }).catch(() => ({ ok: false })),
      ]);

      if (curRes && curRes.ok) {
        const data = await curRes.json();
        setCurrentShift(data || null);
      } else {
        setCurrentShift(null);
      }

      if (repRes && repRes.ok) {
        const rep = await repRes.json();
        setAuditReport(rep);
      }
    } catch (e) {
      console.error('Erro ao carregar auditoria de caixas:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [adminData]);

  // Atualiza timer a cada segundo
  useEffect(() => {
    if (!currentShift || !currentShift.startTime || currentShift.status === 'CLOSED') {
      setElapsedTime('00h 00m 00s');
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(currentShift.startTime).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, now - start);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const h = String(hours).padStart(2, '0');
      const m = String(minutes).padStart(2, '0');
      const s = String(seconds).padStart(2, '0');
      setElapsedTime(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentShift]);

  const isShiftOpen = !!currentShift && currentShift.status === 'OPEN';
  const summary = currentShift?.summary || {};
  const salesByMethod = summary.salesByMethod || {};
  const totalSales = Number(summary.totalSales || 0);

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
                Auditoria e Caixa PDV
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Turno profissional com sangria anti-fraude, conferência de gaveta e histórico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('CURRENT')}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  activeTab === 'CURRENT'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Turno Atual
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  activeTab === 'HISTORY'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Auditoria / Histórico
              </button>
            </div>

            <button
              onClick={loadData}
              title="Atualizar dados"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-amber-500' : ''} />
            </button>
          </div>
        </header>

        {activeTab === 'CURRENT' ? (
          <>
            {/* Banner Principal do Turno */}
            {loading ? (
              <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
                <p className="mt-3 font-bold text-slate-500">Carregando status do terminal...</p>
              </div>
            ) : !isShiftOpen ? (
              <div className="mb-8 flex flex-col items-center justify-between gap-6 rounded-3xl border-2 border-dashed border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-8 text-center sm:flex-row sm:text-left dark:border-amber-500/30 dark:from-amber-950/30">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Lock size={32} />
                  </div>
                  <div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Terminal Fechado
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                      Nenhum turno aberto no momento
                    </h2>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Abra o caixa informando o fundo de troco inicial para começar a operar no PDV.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpenModalOpen(true)}
                  className="flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-500 px-8 py-4 text-lg font-black text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-95 animate-pulse"
                >
                  <Unlock size={22} />
                  <span>Abrir Caixa Agora</span>
                </button>
              </div>
            ) : (
              <div className="mb-8 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 shadow-lg dark:from-emerald-950/40 dark:to-slate-900">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30">
                      <Unlock size={32} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-slate-950">
                          <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping"></span>
                          Turno em Andamento
                        </span>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                          ID: #{currentShift.id.slice(0, 8)}
                        </span>
                      </div>
                      <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                        {currentShift.cashRegister?.name || 'Caixa Principal'}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <User size={15} className="text-emerald-500" />
                          Operador: {currentShift.admin?.name || 'Operador Admin'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={15} className="text-emerald-500" />
                          Início: {new Date(currentShift.startTime).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Relógio / Timer */}
                  <div className="flex items-center gap-6 rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur-md dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <Clock className="text-amber-500 animate-spin" size={28} style={{ animationDuration: '10s' }} />
                      <div>
                        <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                          Duração do Turno
                        </span>
                        <span className="font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                          {elapsedTime}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsCloseModalOpen(true)}
                      className="flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 font-bold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600 active:scale-95"
                    >
                      <Lock size={18} />
                      <span>Fechar Turno</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ações Rápidas (Touch Buttons) */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <button
                onClick={() => setIsOpenModalOpen(true)}
                disabled={isShiftOpen || loading}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 font-bold text-slate-700 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 active:scale-95"
              >
                <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Unlock size={24} />
                </div>
                <span>1. Abrir Caixa</span>
              </button>

              <button
                onClick={() => setIsTxModalOpen(true)}
                disabled={!isShiftOpen || loading}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 font-bold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 active:scale-95"
              >
                <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <PlusCircle size={24} />
                </div>
                <span>2. Suprimento (+)</span>
              </button>

              <button
                onClick={() => setIsTxModalOpen(true)}
                disabled={!isShiftOpen || loading}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 font-bold text-slate-700 shadow-sm transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 active:scale-95"
              >
                <div className="rounded-xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <MinusCircle size={24} />
                </div>
                <span>3. Sangria (-)</span>
              </button>

              <button
                onClick={() => setIsCloseModalOpen(true)}
                disabled={!isShiftOpen || loading}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 font-bold text-slate-700 shadow-sm transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 active:scale-95"
              >
                <div className="rounded-xl bg-rose-100 p-3 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                  <Lock size={24} />
                </div>
                <span>4. Conferência / Baixa</span>
              </button>
            </div>

            {/* Painel Financeiro da Gaveta */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Fundo de Troco Inicial
                </span>
                <p className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-200">
                  R$ {Number(summary.openingCash || 0).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Abertura de gaveta</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Vendas no Turno
                </span>
                <p className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">
                  R$ {totalSales.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Total em todas as formas</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Suprimento (+)
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Sangria (-)
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xl font-black">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    + R$ {Number(summary.suprimento || 0).toFixed(2)}
                  </span>
                  <span className="text-rose-600 dark:text-rose-400">
                    - R$ {Number(summary.sangria || 0).toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Movimentações avulsas de gaveta</p>
              </div>

              <div className="rounded-2xl border-2 border-amber-500 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 shadow-md dark:from-amber-950/40 dark:to-slate-900">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span className="text-xs font-black uppercase tracking-wider">
                    Gaveta Esperada (Dinheiro)
                  </span>
                  <Wallet size={20} />
                </div>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">
                  R$ {Number(summary.expectedClosingCash || 0).toFixed(2)}
                </p>
                <p className="mt-1 text-xs font-bold text-amber-600/80 dark:text-amber-400/80">
                  Fundo + Dinheiro + Sup - Sangria
                </p>
              </div>
            </div>

            {/* Detalhamento por Forma de Pagamento e Histórico de Transações */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="text-amber-500" size={20} />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Vendas por Forma de Pagamento
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-400">Total: R$ {totalSales.toFixed(2)}</span>
                </div>

                {Object.keys(salesByMethod).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    Nenhuma venda registrada neste turno ainda.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(salesByMethod).map(([method, amount]) => {
                      const meta = PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.OTHER;
                      const val = Number(amount || 0);
                      const pct = totalSales > 0 ? Math.round((val / totalSales) * 100) : 0;

                      return (
                        <div key={method} className="space-y-1">
                          <div className="flex items-center justify-between text-sm font-bold">
                            <span className="text-slate-700 dark:text-slate-300">{meta.label}</span>
                            <span className="text-slate-900 dark:text-slate-100">
                              R$ {val.toFixed(2)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-full ${meta.color.split(' ')[0]} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="text-blue-500" size={20} />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Últimas Movimentações no Terminal
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {summary.transactions?.length || 0} itens
                  </span>
                </div>

                {summary.transactions && summary.transactions.length > 0 ? (
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                    {summary.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                                tx.type === 'SANGRIA'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                                  : tx.type === 'SUPRIMENTO'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              }`}
                            >
                              {tx.type}
                            </span>
                            <span className="text-slate-800 dark:text-slate-200">
                              {tx.description || (tx.type === 'SALE' ? 'Venda PDV' : 'Movimentação')}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(tx.createdAt).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>

                        <span
                          className={`font-black ${
                            tx.type === 'SANGRIA' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {tx.type === 'SANGRIA' ? '-' : '+'} R$ {Number(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">
                    Nenhuma transação efetuada até o momento.
                  </p>
                )}
              </section>
            </div>
          </>
        ) : (
          /* Aba de Histórico e Auditoria */
          <div className="space-y-8 animate-in fade-in">
            {/* KPIs Consolidados do Relatório */}
            {auditReport && auditReport.kpis && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Total Turnos Auditados
                  </span>
                  <p className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-100">
                    {auditReport.kpis.totalShifts}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-600">
                    {auditReport.kpis.closedShifts} fechados
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Faturamento Acumulado
                  </span>
                  <p className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">
                    R$ {Number(auditReport.kpis.totalSales || 0).toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Todas as formas de pagamento</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Quebra Líquida de Caixa
                  </span>
                  <p
                    className={`mt-2 text-3xl font-black ${
                      Number(auditReport.kpis.netDifference) < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    R$ {Number(auditReport.kpis.netDifference || 0).toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Diferença acumulada entre esperado vs real</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Ocorrências de Quebra (Falta)
                  </span>
                  <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-400">
                    {auditReport.kpis.deficitShiftsCount} turnos
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Necessitam atenção da gerência</p>
                </div>
              </div>
            )}

            {/* Lista de Turnos Fechados / Abertos */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-6 text-xl font-bold text-slate-900 dark:text-slate-100">
                Relatório de Auditoria de Turnos
              </h3>

              {!auditReport || !auditReport.shifts || auditReport.shifts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Nenhum histórico de turno encontrado.
                </p>
              ) : (
                <div className="space-y-4">
                  {auditReport.shifts.map((s) => {
                    const isClosed = s.status === 'CLOSED';
                    const diff = Number(s.difference || 0);

                    return (
                      <div
                        key={s.id}
                        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-slate-100/50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {s.cashRegisterName}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isClosed
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                              }`}
                            >
                              {isClosed ? 'Fechado' : 'Aberto'}
                            </span>

                            {s.auditStatus === 'DEFICIT' && (
                              <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                                <AlertTriangle size={13} /> Quebra / Falta
                              </span>
                            )}
                            {s.auditStatus === 'SURPLUS' && (
                              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                <CheckCircle2 size={13} /> Sobra em Gaveta
                              </span>
                            )}
                            {s.auditStatus === 'OK' && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                <CheckCircle2 size={13} /> Caixa Batido
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Operador: {s.operatorName} | Início:{' '}
                            {new Date(s.startTime).toLocaleString('pt-BR')}
                            {s.endTime && ` | Fim: ${new Date(s.endTime).toLocaleTimeString('pt-BR')}`}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 text-right sm:justify-end">
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Vendas Total
                            </span>
                            <span className="text-base font-black text-slate-900 dark:text-slate-100">
                              R$ {Number(s.totalSales || 0).toFixed(2)}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Fundo / Esperado
                            </span>
                            <span className="text-base font-black text-slate-700 dark:text-slate-300">
                              R$ {Number(s.expectedClosingCash || 0).toFixed(2)}
                            </span>
                          </div>

                          {isClosed && (
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Quebra / Diferença
                              </span>
                              <span
                                className={`text-base font-black ${
                                  diff < 0 ? 'text-rose-600 dark:text-rose-400' : diff > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {diff < 0 ? '' : diff > 0 ? '+' : ''} R$ {diff.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Modais de Operação do Caixa */}
      <OpenShiftModal
        isOpen={isOpenModalOpen}
        adminData={adminData}
        onOpen={(shift) => {
          setCurrentShift(shift);
          setIsOpenModalOpen(false);
          loadData();
        }}
        onClose={() => setIsOpenModalOpen(false)}
      />

      <CloseShiftModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        currentShift={currentShift}
        adminData={adminData}
        onClosed={() => {
          setCurrentShift(null);
          setIsCloseModalOpen(false);
          loadData();
        }}
      />

      <CashTransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        currentShift={currentShift}
        adminData={adminData}
        onTransaction={() => {
          setIsTxModalOpen(false);
          loadData();
        }}
      />
    </PageContainer>
  );
}
