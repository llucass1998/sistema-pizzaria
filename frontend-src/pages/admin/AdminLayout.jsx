import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
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
  ChefHat,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Scale,
  Receipt,
  Globe,
  Building2,
  Pin,
  PinOff
} from 'lucide-react';
import { useState, useMemo, Suspense, useEffect } from 'react';
import pizzariaLogo from '../../assets/rio-pizzas-logo.png';

function AdminLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-pulse">
      <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin mb-4"></div>
      <p className="text-sm font-bold text-slate-500">Carregando módulo...</p>
    </div>
  );
}

export function AdminLayout({ isDarkMode = false, onToggleTheme = () => {} }) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer state
  
  // Pinned state (persisted)
  const [isPinned, setIsPinned] = useState(() => {
    return localStorage.getItem('adminSidebarPinned') === 'true';
  });

  // Hover state (temporary)
  const [isHovered, setIsHovered] = useState(false);

  // Expanded if either pinned or hovered
  const isExpanded = isPinned || isHovered;

  const togglePin = () => {
    const newState = !isPinned;
    setIsPinned(newState);
    localStorage.setItem('adminSidebarPinned', String(newState));
  };

  // Remove Dark Mode from the entire document when rendering Admin
  useEffect(() => {
    const htmlEl = document.documentElement;
    const wasDark = htmlEl.classList.contains('dark');
    
    if (wasDark) {
      htmlEl.classList.remove('dark');
    }
    
    return () => {
      // Re-apply if it was originally dark and we unmount (e.g., going back to public store)
      if (wasDark) {
        htmlEl.classList.add('dark');
      }
    };
  }, []); // Run once on mount

  const adminDataString = window.localStorage.getItem('pizzaria-admin');

  if (!adminDataString) {
    return <Navigate to="/admin/login" replace />;
  }

  const { admin } = JSON.parse(adminDataString);
  const role = adminDataString ? JSON.parse(adminDataString).role || 'ADMIN' : 'ADMIN';

  const operationItems = useMemo(() => {
    return [
      { to: '/admin/pos', icon: Store, label: 'Frente de Caixa (PDV)', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'] },
      { to: '/admin/caixa', icon: Wallet, label: 'Caixa & Turnos', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'] },
      { to: '/admin/orders', icon: ClipboardList, label: 'Pedidos Live', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN'] },
      { to: '/admin/kds', icon: ChefHat, label: 'KDS', roles: ['OWNER', 'ADMIN', 'MANAGER', 'KITCHEN'] },
      { to: '/admin/dispatch', icon: Truck, label: 'Despacho', roles: ['OWNER', 'ADMIN', 'MANAGER', 'DRIVER'] },
    ].filter((item) => item.roles.includes(role));
  }, [role]);

  const allErpItems = useMemo(() => {
    return [
      { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard Executivo', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/fluxo-caixa', icon: TrendingUp, label: 'Fluxo de Caixa', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/dre', icon: BarChart3, label: 'DRE Simplificado', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/conciliacao', icon: Scale, label: 'Conciliação', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'] },
      { to: '/admin/payables', icon: DollarSign, label: 'Contas a Pagar', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/receivables', icon: Wallet, label: 'Contas a Receber', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/purchases', icon: Truck, label: 'Compras & Pedidos', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'] },
      { to: '/admin/invoices', icon: FileText, label: 'Notas Fiscais', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'] },
      { to: '/admin/suppliers', icon: Truck, label: 'Fornecedores', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'] },
      { to: '/admin/quotes', icon: FileText, label: 'Orçamentos', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
    ].filter((item) => item.roles.includes(role));
  }, [role]);

  const managementItems = useMemo(() => {
    return [
      { to: '/admin/products', icon: Package, label: 'Produtos', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/categories', icon: Tags, label: 'Categorias', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/options', icon: Layers, label: 'Opções Extras', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/inventory', icon: Archive, label: 'Estoque', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/recipes', icon: List, label: 'Fichas Técnicas', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/crm', icon: Users, label: 'Clientes', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/coupons', icon: Ticket, label: 'Cupons', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/users', icon: UserCog, label: 'Equipe', roles: ['OWNER', 'ADMIN'] },
      { to: '/admin/settings', icon: Settings, label: 'Configurações', roles: ['OWNER', 'ADMIN'] },
      { to: '/admin/relatorios', icon: PieChart, label: 'Relatórios & BI', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/integrations', icon: Globe, label: 'Integrações (iFood)', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/fiscal', icon: Receipt, label: 'Fiscal (NFC-e)', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
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
      title={!isExpanded ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 relative group overflow-hidden ${
          isExpanded ? 'justify-start gap-3' : 'justify-center'
        } ${
          isActive ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-white/10 text-blue-50'
        }`
      }
    >
      <item.icon size={20} className="shrink-0" />
      <span
        className={`whitespace-nowrap transition-all duration-300 ${
          isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
        }`}
      >
        {item.label}
      </span>
      {/* Tooltip para modo recolhido (só visível em desktop se não estiver expandido) */}
      {!isExpanded && (
        <span className="hidden lg:block absolute left-[80px] w-max bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[60] shadow-xl">
          {item.label}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full relative text-slate-900">
      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Azul */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 bg-[#123B63] text-blue-50 flex flex-col transform transition-all duration-300 ease-in-out print:hidden shadow-2xl ${
          isExpanded ? 'w-[260px]' : 'w-[72px]'
        } lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full'}`}
      >
        {/* Header da Sidebar (Logo) */}
        <div className="h-[72px] flex items-center justify-center shrink-0 border-b border-white/10 px-2 relative">
          <div className="flex items-center justify-center overflow-hidden transition-all duration-300 w-full h-full gap-3">
            <img src={pizzariaLogo} alt="Logo" className="h-10 w-10 rounded-full shrink-0 shadow-sm" />
            <span
              className={`font-black text-white text-lg tracking-tight uppercase whitespace-nowrap transition-all duration-300 ${
                isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
              }`}
            >
              Admin
            </span>
          </div>
        </div>

        {/* Os 3 Botões de Topo (Compactos ou Expandidos) */}
        <div className="flex flex-col gap-2 p-3 border-b border-white/10 shrink-0">
          <button
            onClick={togglePin}
            title={isPinned ? "Desafixar menu" : "Fixar menu aberto"}
            className={`flex items-center px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 relative group overflow-hidden ${
              isExpanded ? 'justify-start gap-3' : 'justify-center'
            } ${isPinned ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-blue-50'}`}
          >
            {isPinned ? <PinOff size={20} className="shrink-0" /> : <Pin size={20} className="shrink-0" />}
            <span className={`whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
              {isPinned ? 'Menu Fixado' : 'Fixar Menu'}
            </span>
          </button>
          
          <button
            onClick={() => { navigate('/admin/dashboard'); setIsSidebarOpen(false); }}
            title="Dashboard"
            className={`flex items-center px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 relative group overflow-hidden ${
              isExpanded ? 'justify-start gap-3' : 'justify-center'
            } hover:bg-white/10 text-blue-50`}
          >
            <LayoutDashboard size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
              Dashboard
            </span>
          </button>

          <button
            onClick={() => { navigate('/admin/pos'); setIsSidebarOpen(false); }}
            title="Frente de Caixa (PDV)"
            className={`flex items-center px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 relative group overflow-hidden ${
              isExpanded ? 'justify-start gap-3' : 'justify-center'
            } hover:bg-white/10 text-blue-50`}
          >
            <Store size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
              PDV (Caixa)
            </span>
          </button>
        </div>

        {/* Links de Navegação (Scrollável) */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {operationItems.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 px-1 text-[10px] font-black text-blue-200/50 uppercase tracking-widest h-4 flex items-center justify-center transition-all duration-300">
                {isExpanded ? <span className="w-full text-left">Operação</span> : <div className="w-4 h-px bg-white/20" />}
              </div>
              <div className="space-y-1">
                {operationItems.map((item) => <NavItem key={item.to} item={item} />)}
              </div>
            </div>
          )}

          {allErpItems.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 px-1 text-[10px] font-black text-blue-200/50 uppercase tracking-widest h-4 flex items-center justify-center transition-all duration-300">
                {isExpanded ? <span className="w-full text-left">ERP & Financeiro</span> : <div className="w-4 h-px bg-white/20" />}
              </div>
              <div className="space-y-1">
                {allErpItems.map((item) => <NavItem key={item.to} item={item} />)}
              </div>
            </div>
          )}

          {managementItems.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 px-1 text-[10px] font-black text-blue-200/50 uppercase tracking-widest h-4 flex items-center justify-center transition-all duration-300">
                {isExpanded ? <span className="w-full text-left">Cadastros & Gestão</span> : <div className="w-4 h-px bg-white/20" />}
              </div>
              <div className="space-y-1">
                {managementItems.map((item) => <NavItem key={item.to} item={item} />)}
              </div>
            </div>
          )}
        </nav>

        {/* Footer (User, Logout) */}
        <div className="p-3 bg-[#0F2F52] shrink-0 border-t border-white/5">
          <div
            className={`flex items-center mb-3 transition-all duration-300 ${
              isExpanded ? 'gap-3 px-2 justify-start' : 'justify-center'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase shrink-0">
              {admin.name.charAt(0)}
            </div>
            <div
              className={`min-w-0 flex-1 whitespace-nowrap overflow-hidden transition-all duration-300 ${
                isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
              }`}
            >
              <p className="text-sm font-bold text-white truncate">{admin.name}</p>
              <p className="text-[10px] font-medium text-blue-200/60 uppercase tracking-wide truncate">
                {role === 'DRIVER' ? 'Entregador' : 'Administrador'}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            {role === 'SUPER_ADMIN' && (
              <a
                href="#/saas/dashboard"
                title={!isExpanded ? 'Hub SaaS' : undefined}
                className={`flex items-center py-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 hover:bg-white/5 rounded-lg transition relative group ${
                  isExpanded ? 'px-3 gap-2 w-full justify-start' : 'px-0 w-full justify-center'
                }`}
              >
                <Building2 size={18} className="shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                  Hub SaaS
                </span>
              </a>
            )}

            <button
              onClick={handleLogout}
              title={!isExpanded ? 'Sair do Painel' : undefined}
              className={`flex items-center py-2 text-sm font-bold text-rose-400 hover:text-rose-300 hover:bg-white/5 rounded-lg transition relative group ${
                isExpanded ? 'px-3 gap-2 w-full justify-start' : 'px-0 w-full justify-center'
              }`}
            >
              <LogOut size={18} className="shrink-0" />
              <span className={`whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                Sair
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden print:overflow-visible print:h-auto lg:pl-[72px] transition-all duration-300">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:hidden shrink-0 shadow-sm print:hidden justify-between z-30 relative">
          <div className="flex min-w-0 flex-1 items-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Abrir menu mobile"
            >
              <Menu size={24} />
            </button>
            <span className="ml-2 truncate font-black text-slate-900">
              Pizzaria ADM
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-slate-50 print:overflow-visible print:bg-white relative">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
