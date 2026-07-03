import { useMemo, useState } from 'react';
import {
  Bell,
  ChefHat,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Command,
  Home,
  LayoutDashboard,
  Menu,
  MonitorPlay,
  Package,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '#/admin', id: 'admin' },
  { name: 'PDV / Caixa', icon: MonitorPlay, href: '#/pdv', id: 'pdv' },
  { name: 'KDS / Cozinha', icon: ChefHat, href: '#/kds', id: 'kds' },
  { name: 'Estoque', icon: Package, href: '#/estoque', id: 'estoque' },
  { name: 'Faturamento', icon: CircleDollarSign, href: '#/faturamento', id: 'faturamento' },
];

function getTodayLabel() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date());
}

export default function ERPLayout({ children, activeTab }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const activeItem = useMemo(
    () => navItems.find((item) => item.id === activeTab) ?? navItems[0],
    [activeTab],
  );

  return (
    <div className="erp-shell min-h-screen bg-[#090c14] text-slate-100 lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(244,63,94,0.10)_0%,transparent_28%),linear-gradient(225deg,rgba(14,165,233,0.12)_0%,transparent_32%),linear-gradient(180deg,#090c14_0%,#101421_48%,#080a10_100%)]" />

      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white shadow-xl backdrop-blur lg:hidden"
        aria-label="Abrir menu ERP"
      >
        <Menu size={20} />
      </button>

      {isSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Fechar menu ERP"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-white/10 bg-[#090c14]/92 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <a href="#/admin" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 via-red-500 to-amber-300 text-slate-950 shadow-[0_0_24px_rgba(251,146,60,0.34)]">
              <Command size={23} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase text-white">Rio ERP</p>
              <p className="truncate text-xs font-semibold text-slate-400">Pizzaria Operations</p>
            </div>
          </a>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <a
                key={item.id}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`group flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-bold transition ${
                  isActive
                    ? 'border border-white/10 bg-white/[0.09] text-white shadow-[inset_3px_0_0_#fb923c,0_16px_35px_rgba(0,0,0,0.22)]'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    isActive
                      ? 'bg-red-400 text-slate-950'
                      : 'bg-white/[0.06] text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {isActive ? <ChevronRight size={16} className="text-slate-300" /> : null}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                <ClipboardList size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">Operacao ativa</p>
                <p className="truncate text-xs text-slate-400">Dados em tempo real</p>
              </div>
            </div>
          </div>
          <a
            href="#/admin"
            className="mt-3 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-bold text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Settings size={18} />
            Configuracoes
          </a>
        </div>
      </aside>

      <div className="relative z-10 flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090c14]/70 backdrop-blur-xl">
          <div className="flex min-h-20 flex-col gap-3 px-4 py-3 pl-20 sm:px-6 lg:px-8 lg:pl-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-slate-500">
                <a
                  href="#/admin"
                  className="inline-flex items-center gap-1 transition hover:text-white"
                >
                  <Home size={14} />
                  ERP
                </a>
                <ChevronRight size={14} />
                <span className="text-slate-300">{activeItem.name}</span>
              </div>
              <h1 className="mt-1 truncate text-xl font-black text-white sm:text-2xl">
                {activeItem.name}
              </h1>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block w-full sm:w-[min(36vw,360px)]">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-10 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-slate-300 dark:border-slate-700/70 focus:bg-white/[0.09] focus:ring-2 focus:ring-slate-300/15"
                  placeholder="Buscar pedido, produto ou insumo"
                />
              </label>

              <div className="flex items-center gap-2">
                <div className="hidden h-11 items-center rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-slate-300 md:flex">
                  {getTodayLabel()}
                </div>
                <button
                  type="button"
                  className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-300 transition hover:border-slate-300 dark:border-slate-700/40 hover:text-white"
                  aria-label="Notificacoes"
                  title="Notificacoes"
                >
                  <Bell size={19} />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)]" />
                </button>
                <div className="flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-2.5">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-black text-white">Admin</p>
                    <p className="text-[11px] font-semibold text-slate-500">Gerencia</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300">
                    <User size={17} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
