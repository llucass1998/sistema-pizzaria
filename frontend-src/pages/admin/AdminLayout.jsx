import { Outlet, Navigate, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  LogOut,
  Menu,
  Package,
  Tags,
  Layers,
  Users,
  Ticket,
  Settings,
  Truck,
  Store,
  FileText,
  Wallet,
  Archive,
  List,
  UserCog,
  Moon,
  Sun,
  ChefHat,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Scale,
  Receipt,
  Globe,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useMemo, Suspense, useEffect } from 'react';
import pizzariaLogo from '../../assets/rio-pizzas-logo.png';

function AdminLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-pulse">
      <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin mb-4"></div>
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Carregando módulo...</p>
    </div>
  );
}

export function AdminLayout({ isDarkMode = false, onToggleTheme = () => {} }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer state
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return localStorage.getItem('adminSidebarExpanded') !== 'false';
  });

  const toggleSidebar = () => {
    const newState = !sidebarExpanded;
    setSidebarExpanded(newState);
    localStorage.setItem('adminSidebarExpanded', String(newState));
  };

  const adminDataString = window.localStorage.getItem('pizzaria-admin');

  if (!adminDataString) {
    return <Navigate to="/admin/login" replace />;
  }

  const { admin } = JSON.parse(adminDataString);
  const role = adminDataString ? JSON.parse(adminDataString).role || 'ADMIN' : 'ADMIN';

  const operationItems = useMemo(() => {
    return [
      {
        to: '/admin/pos',
        icon: Store,
        label: 'Frente de Caixa (PDV)',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'],
      },
      {
        to: '/admin/caixa',
        icon: Wallet,
        label: 'Caixa & Turnos',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'],
      },
      {
        to: '/admin/orders',
        icon: ClipboardList,
        label: 'Pedidos Live',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN'],
      },
      {
        to: '/admin/kds',
        icon: ChefHat,
        label: 'KDS',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'KITCHEN'],
      },
      {
        to: '/admin/dispatch',
        icon: Truck,
        label: 'Despacho',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'DRIVER'],
      },
    ].filter((item) => item.roles.includes(role));
  }, [role]);

  const managementItems = useMemo(() => {
    return [
      {
        to: '/admin/products',
        icon: Package,
        label: 'Produtos',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/categories',
        icon: Tags,
        label: 'Categorias',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/options',
        icon: Layers,
        label: 'Opções Extras',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/inventory',
        icon: Archive,
        label: 'Estoque',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/recipes',
        icon: List,
        label: 'Fichas Técnicas',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      { to: '/admin/crm', icon: Users, label: 'Clientes', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/coupons', icon: Ticket, label: 'Cupons', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/users', icon: UserCog, label: 'Equipe', roles: ['OWNER', 'ADMIN'] },
      { to: '/admin/settings', icon: Settings, label: 'Configurações', roles: ['OWNER', 'ADMIN'] },
    ].filter((item) => item.roles.includes(role));
  }, [role]);

  const allErpItems = useMemo(() => {
    return [
      {
        to: '/admin/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard Executivo',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/fluxo-caixa',
        icon: TrendingUp,
        label: 'Fluxo de Caixa',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/dre',
        icon: BarChart3,
        label: 'DRE Simplificado',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/relatorios',
        icon: PieChart,
        label: 'Relatórios & BI',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/conciliacao',
        icon: Scale,
        label: 'Conciliação',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'],
      },
      {
        to: '/admin/payables',
        icon: DollarSign,
        label: 'Contas a Pagar',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/receivables',
        icon: Wallet,
        label: 'Contas a Receber',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/purchases',
        icon: Truck,
        label: 'Compras & Pedidos',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'],
      },
      {
        to: '/admin/invoices',
        icon: FileText,
        label: 'Notas Fiscais',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'],
      },
      {
        to: '/admin/suppliers',
        icon: Truck,
        label: 'Fornecedores',
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'],
      },
      {
        to: '/admin/quotes',
        icon: FileText,
        label: 'Orçamentos',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/fiscal',
        icon: Receipt,
        label: 'Emissão Fiscal (NFC-e)',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/integrations',
        icon: Globe,
        label: 'Integrações (iFood)',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
    ].filter((item) => item.roles.includes(role));
  }, [role]);

  function handleLogout() {
    window.localStorage.removeItem('pizzaria-admin');
    window.location.hash = '/';
  }

  // Componente utilitário para renderizar links adaptáveis
  const NavItem = ({ item }) => (
    <NavLink
      to={item.to}
      onClick={() => setIsSidebarOpen(false)} // Fecha gaveta no mobile
      title={!sidebarExpanded ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 relative group ${
          sidebarExpanded ? 'justify-start gap-3' : 'justify-center'
        } ${
          isActive ? 'bg-red-600 text-white' : 'hover:bg-slate-800 hover:text-white text-slate-300'
        }`
      }
    >
      <item.icon size={20} className="shrink-0" />
      <span
        className={`whitespace-nowrap transition-all duration-300 ${
          sidebarExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
        }`}
      >
        {item.label}
      </span>
      {/* Tooltip para modo recolhido */}
      {!sidebarExpanded && (
        <span className="absolute left-full ml-3 w-max bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
          {item.label}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden print:overflow-visible w-full">
      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col transform transition-all duration-300 ease-in-out print:hidden ${
          sidebarExpanded ? 'w-64' : 'w-20'
        } lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header da Sidebar */}
        <div className="h-16 flex items-center px-4 bg-slate-950 shrink-0 relative justify-between">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${sidebarExpanded ? 'w-full' : 'w-10 justify-center'}`}>
            <img src={pizzariaLogo} alt="Logo" className="h-8 w-8 rounded-full shrink-0" />
            <span
              className={`ml-3 font-black text-white text-lg tracking-tight uppercase whitespace-nowrap transition-all duration-300 ${
                sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'
              }`}
            >
              Admin
            </span>
          </div>

          <button
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
            aria-expanded={sidebarExpanded}
            className={`hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-300 hover:text-white rounded-full p-1 border border-slate-700 shadow-lg z-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500`}
          >
            {sidebarExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {operationItems.length > 0 && (
            <>
              <div className="mb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider h-4 flex items-center justify-center">
                {sidebarExpanded ? <span className="w-full text-left">Operação</span> : <div className="w-4 h-px bg-slate-700" />}
              </div>
              {operationItems.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </>
          )}

          {allErpItems.length > 0 && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider h-4 flex items-center justify-center">
                {sidebarExpanded ? <span className="w-full text-left">ERP & Financeiro</span> : <div className="w-4 h-px bg-slate-700" />}
              </div>
              {allErpItems.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </>
          )}

          {managementItems.length > 0 && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider h-4 flex items-center justify-center">
                {sidebarExpanded ? <span className="w-full text-left">Cadastros</span> : <div className="w-4 h-px bg-slate-700" />}
              </div>
              {managementItems.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* Footer (User, Configs) */}
        <div className="p-4 bg-slate-950 shrink-0">
          <div
            className={`flex items-center mb-4 transition-all duration-300 ${
              sidebarExpanded ? 'gap-3 px-2 justify-start' : 'justify-center'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white uppercase shrink-0">
              {admin.name.charAt(0)}
            </div>
            <div
              className={`min-w-0 flex-1 whitespace-nowrap overflow-hidden transition-all duration-300 ${
                sidebarExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
              }`}
            >
              <p className="text-sm font-bold text-white truncate">{admin.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {role === 'DRIVER' ? 'Entregador' : 'Administrador'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {role === 'SUPER_ADMIN' && (
              <a
                href="#/saas/dashboard"
                title={!sidebarExpanded ? 'Hub SaaS' : undefined}
                className={`flex items-center py-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 hover:bg-slate-900 rounded-lg transition relative group ${
                  sidebarExpanded ? 'px-3 gap-2 w-full justify-start' : 'px-0 w-full justify-center'
                }`}
              >
                <Building2 size={18} className="shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-300 ${sidebarExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                  Hub SaaS
                </span>
                {!sidebarExpanded && (
                  <span className="absolute left-full ml-3 w-max bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                    Hub SaaS
                  </span>
                )}
              </a>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              title={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
              className={`flex items-center py-2 text-sm font-bold text-slate-300 hover:bg-slate-900 hover:text-white rounded-lg transition relative group ${
                sidebarExpanded ? 'px-3 gap-2 w-full justify-between' : 'px-0 w-full justify-center'
              }`}
            >
              <span className="flex items-center gap-2">
                {isDarkMode ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
                <span className={`whitespace-nowrap transition-all duration-300 ${sidebarExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                  Modo {isDarkMode ? 'claro' : 'escuro'}
                </span>
              </span>
              {sidebarExpanded && (
                <span className="text-xs uppercase text-slate-500 shrink-0">
                  {isDarkMode ? 'On' : 'Off'}
                </span>
              )}
              {!sidebarExpanded && (
                <span className="absolute left-full ml-3 w-max bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                  {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
                </span>
              )}
            </button>

            <button
              onClick={handleLogout}
              className={`flex items-center py-2 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-slate-900 rounded-lg transition relative group ${
                sidebarExpanded ? 'px-3 gap-2 w-full justify-start' : 'px-0 w-full justify-center'
              }`}
            >
              <LogOut size={18} className="shrink-0" />
              <span className={`whitespace-nowrap transition-all duration-300 ${sidebarExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                Sair do Painel
              </span>
              {!sidebarExpanded && (
                <span className="absolute left-full ml-3 w-max bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                  Sair do Painel
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden print:overflow-visible print:h-auto">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 lg:hidden shrink-0 shadow-sm print:hidden justify-between">
          <div className="flex min-w-0 flex-1 items-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Abrir menu mobile"
            >
              <Menu size={24} />
            </button>
            <span className="ml-2 truncate font-black text-slate-900 dark:text-white">
              Pizzaria ADM
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            title={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
            aria-label={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 print:overflow-visible print:bg-white dark:print:bg-white relative">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
