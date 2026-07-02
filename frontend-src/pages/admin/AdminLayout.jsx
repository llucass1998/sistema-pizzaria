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
} from 'lucide-react';
import { useState, useMemo } from 'react';
import pizzariaLogo from '../../assets/rio-pizzas-logo.png';

export function AdminLayout({ isDarkMode = false, onToggleTheme = () => {} }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const adminDataString = window.localStorage.getItem('pizzaria-admin');

  if (!adminDataString) {
    return <Navigate to="/admin/login" replace />;
  }

  const { admin } = JSON.parse(adminDataString);

  const role = adminDataString ? JSON.parse(adminDataString).role || 'ADMIN' : 'ADMIN';

  const allNavItems = useMemo(() => {
    return [
      {
        to: '/admin/pos',
        icon: Store,
        label: 'Frente de Caixa (PDV)',
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
      {
        to: '/admin/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
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
        to: '/admin/purchases',
        icon: Truck,
        label: 'Compras & Notas',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/quotes',
        icon: FileText,
        label: 'Orçamentos',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      {
        to: '/admin/receivables',
        icon: Wallet,
        label: 'Contas a Receber',
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
    ].filter((item) => item.roles.includes(role));
  }, [role]);

  function handleLogout() {
    window.localStorage.removeItem('pizzaria-admin');
    window.location.hash = '/';
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden print:overflow-visible w-full">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 print:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 bg-slate-950 shrink-0">
            <img src={pizzariaLogo} alt="Logo" className="h-8 w-8 rounded-full" />
            <span className="ml-3 font-black text-white text-lg tracking-tight uppercase">
              Admin
            </span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {allNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                    isActive ? 'bg-red-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}

            {allErpItems.length > 0 && (
              <>
                <div className="mt-8 mb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  ERP & Financeiro
                </div>
                {allErpItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                        isActive ? 'bg-red-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={20} />
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          <div className="p-4 bg-slate-950 shrink-0">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white uppercase">
                {admin.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{admin.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {role === 'DRIVER' ? 'Entregador' : 'Administrador'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-900 hover:text-white"
                title={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
                aria-label={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
              >
                <span className="flex items-center gap-2">
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                  {isDarkMode ? 'Modo claro' : 'Modo escuro'}
                </span>
                <span className="text-xs uppercase text-slate-500">
                  {isDarkMode ? 'On' : 'Off'}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-slate-900 rounded-lg transition"
              >
                <LogOut size={18} />
                Sair do Painel
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden print:overflow-visible print:h-auto">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 lg:hidden shrink-0 shadow-sm print:hidden">
          <div className="flex min-w-0 flex-1 items-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
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
            className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
            aria-label={isDarkMode ? 'Usar modo claro' : 'Usar modo escuro'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 print:overflow-visible print:bg-white dark:print:bg-white">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
