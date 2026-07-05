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
  PinOff,
  ChevronDown,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useState, useMemo, Suspense, useEffect, useCallback } from 'react';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Buscar contagem de estoque crítico
  const fetchLowStock = useCallback(async () => {
    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin') ?? 'null');
      if (!adminData?.token) return;
      const res = await fetch('/api/admin/inventory/low-stock', {
        headers: { Authorization: `Bearer ${adminData.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLowStockCount(data.count ?? 0);
      }
    } catch {
      // Ignorar erros de rede silenciosamente
    }
  }, []);

  useEffect(() => {
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 60_000); // atualizar a cada 60s
    return () => clearInterval(interval);
  }, [fetchLowStock]);

  // Limpar chaves antigas do localStorage para evitar que regras antigas controlem o layout
  useEffect(() => {
    try {
      localStorage.removeItem('adminSidebarPinned');
      localStorage.removeItem('sidebarPinned');
      localStorage.removeItem('adminSidebarFixed');
    } catch (e) {
      // Ignorar erros de armazenamento
    }
  }, []);

  // Hover state (para expansão automática no desktop)
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // No desktop, a sidebar expande exclusivamente ao passar o mouse (ou ao abrir drawer no mobile)
  const sidebarExpanded = sidebarHovered;
  const sidebarWidth = sidebarExpanded ? "280px" : "80px";

  // Accordion groups state
  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('adminSidebarGroups');
      return saved ? JSON.parse(saved) : { operation: true, erp: true, management: true };
    } catch {
      return { operation: true, erp: true, management: true };
    }
  });

  const toggleGroup = (groupKey) => {
    if (!sidebarExpanded) return; // No modo compacto, não mexe na sanfona
    const newGroups = { ...openGroups, [groupKey]: !openGroups[groupKey] };
    setOpenGroups(newGroups);
    localStorage.setItem('adminSidebarGroups', JSON.stringify(newGroups));
  };

  // Remove Dark Mode from the entire document when rendering Admin
  useEffect(() => {
    const htmlEl = document.documentElement;
    const wasDark = htmlEl.classList.contains('dark');
    
    if (wasDark) {
      htmlEl.classList.remove('dark');
    }
    
    return () => {
      if (wasDark) {
        htmlEl.classList.add('dark');
      }
    };
  }, []);

  const adminDataString = window.localStorage.getItem('pizzaria-admin');

  if (!adminDataString) {
    return <Navigate to="/admin/login" replace />;
  }

  const parsedAdminData = JSON.parse(adminDataString);
  const admin = parsedAdminData.admin || {};
  const role = parsedAdminData.role || admin.role || 'ADMIN';

  const operationItems = useMemo(() => {
    return [
      { to: '/admin/caixa', icon: Wallet, label: 'Turnos de Caixa', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'] },
      { to: '/admin/orders', icon: ClipboardList, label: 'Pedidos Live', roles: ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN'] },
      { to: '/admin/kds', icon: ChefHat, label: 'KDS', roles: ['OWNER', 'ADMIN', 'MANAGER', 'KITCHEN'] },
      { to: '/admin/dispatch', icon: Truck, label: 'Despacho', roles: ['OWNER', 'ADMIN', 'MANAGER', 'DRIVER'] },
    ].filter((item) => role === 'SUPER_ADMIN' || item.roles.includes(role));
  }, [role]);

  const allErpItems = useMemo(() => {
    return [
      { to: '/admin/fluxo-caixa', icon: TrendingUp, label: 'Fluxo de Caixa', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/dre', icon: BarChart3, label: 'DRE Simplificado', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/conciliacao', icon: Scale, label: 'Conciliação', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/payables', icon: DollarSign, label: 'Contas a Pagar', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/receivables', icon: Wallet, label: 'Contas a Receber', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/purchases', icon: Truck, label: 'Compras & Pedidos', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/invoices', icon: FileText, label: 'Notas Fiscais', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/suppliers', icon: Truck, label: 'Fornecedores', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/quotes', icon: FileText, label: 'Orçamentos', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
    ].filter((item) => role === 'SUPER_ADMIN' || item.roles.includes(role));
  }, [role]);

  const managementItems = useMemo(() => {
    return [
      { to: '/admin/products', icon: Package, label: 'Produtos', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/categories', icon: Tags, label: 'Categorias', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/options', icon: Layers, label: 'Opções Extras', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/inventory', icon: Archive, label: 'Estoque', roles: ['OWNER', 'ADMIN', 'MANAGER'], badge: lowStockCount },
      { to: '/admin/recipes', icon: List, label: 'Fichas Técnicas', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/crm', icon: Users, label: 'Clientes', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/coupons', icon: Ticket, label: 'Cupons', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/users', icon: UserCog, label: 'Equipe', roles: ['OWNER', 'ADMIN'] },
      { to: '/admin/settings', icon: Settings, label: 'Configurações', roles: ['OWNER', 'ADMIN'] },
      { to: '/admin/relatorios', icon: PieChart, label: 'Relatórios & BI', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
      { to: '/admin/integrations', icon: Globe, label: 'Integrações (iFood)', roles: ['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER'] },
      { to: '/admin/fiscal', icon: Receipt, label: 'Fiscal (NFC-e)', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
    ].filter((item) => role === 'SUPER_ADMIN' || item.roles.includes(role));
  }, [role]);

  function handleLogout() {
    window.localStorage.removeItem('pizzaria-admin');
    window.location.hash = '/';
  }

  const NavItem = ({ item, expanded }) => (
    <NavLink
      to={item.to}
      onClick={() => setIsSidebarOpen(false)}
      title={!expanded ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center px-3 py-2 rounded-lg font-bold text-sm transition-all duration-200 relative group overflow-hidden ${
          expanded ? 'justify-start gap-3 pl-11' : 'justify-center'
        } ${
          isActive ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-white/10 text-blue-50'
        }`
      }
    >
      <item.icon size={19} className="shrink-0" />
      <span
        className={`whitespace-nowrap transition-all duration-300 flex-1 ${
          expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
        }`}
      >
        {item.label}
      </span>
      {/* Badge de alerta */}
      {item.badge > 0 && (
        <span
          className={`flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black leading-none ${
            expanded ? 'px-1.5 py-0.5 min-w-[18px] h-[18px]' : 'absolute top-1 right-1 w-4 h-4'
          }`}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      {!expanded && (
        <span className="hidden lg:block absolute left-[84px] w-max bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[60] shadow-xl">
          {item.label}{item.badge > 0 ? ` (${item.badge} alerta${item.badge !== 1 ? 's' : ''})` : ''}
        </span>
      )}
    </NavLink>
  );

  const renderSidebarContent = (expanded) => (
    <>
      {/* Header da Sidebar (Logo) */}
      <div className="h-16 flex items-center justify-center shrink-0 border-b border-white/10 px-2 relative">
        <div className="flex items-center justify-center overflow-hidden transition-all duration-300 w-full h-full gap-3">
          <img src={pizzariaLogo} alt="Logo" className="h-9 w-9 rounded-full shrink-0 shadow-sm" />
          <span
            className={`font-black text-white text-lg tracking-tight uppercase whitespace-nowrap transition-all duration-300 ${
              expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
            }`}
          >
            Admin
          </span>
        </div>
      </div>

      {/* Botões do Topo: Dashboard e PDV (Caixa) Único */}
      <div className="flex flex-col gap-1.5 p-2.5 border-b border-white/10 shrink-0">
        <button
          onClick={() => { navigate('/admin/dashboard'); setIsSidebarOpen(false); }}
          title={!expanded ? "Dashboard" : undefined}
          className={`flex items-center px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 relative group overflow-hidden ${
            expanded ? 'justify-start gap-3' : 'justify-center'
          } hover:bg-white/10 text-blue-50`}
        >
          <LayoutDashboard size={20} className="shrink-0" />
          <span className={`whitespace-nowrap transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
            Dashboard
          </span>
        </button>

        <button
          onClick={() => { navigate('/admin/pos'); setIsSidebarOpen(false); }}
          title={!expanded ? "PDV (Caixa)" : undefined}
          className={`flex items-center px-3 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 relative group overflow-hidden ${
            expanded ? 'justify-start gap-3' : 'justify-center'
          } hover:bg-white/10 text-blue-50`}
        >
          <Store size={20} className="shrink-0" />
          <span className={`whitespace-nowrap transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
            PDV (Caixa)
          </span>
        </button>
      </div>

      {/* Links de Navegação (Sanfonas) - No modo reduzido, exibe apenas os ícones de grupo e oculta subitens */}
      <nav className="flex-1 px-2.5 py-3 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {operationItems.length > 0 && (
          <div className="flex flex-col">
            <button
              onClick={() => toggleGroup('operation')}
              title={!expanded ? 'Operação' : undefined}
              className={`flex items-center justify-between w-full px-3 py-2.5 text-blue-50 hover:bg-white/10 rounded-xl transition-all duration-200 group relative ${
                !expanded ? 'justify-center' : ''
              }`}
            >
              <div className={`flex items-center ${expanded ? 'gap-2' : 'justify-center w-full'}`}>
                <Layers size={18} className="shrink-0 text-blue-100 group-hover:text-white transition-colors" />
                <span className={`text-xs font-black uppercase tracking-wide text-white transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                  Operação
                </span>
              </div>
              {expanded && (
                <div className="shrink-0 text-blue-100 group-hover:text-white transition-all duration-200">
                  {openGroups.operation ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              )}
              {!expanded && (
                <span className="hidden lg:block absolute left-[84px] w-max bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[60] shadow-xl">
                  Operação
                </span>
              )}
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded && openGroups.operation ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
              <div className="space-y-1 flex flex-col">
                {operationItems.map((item) => (
                  <NavItem key={item.to} item={item} expanded={expanded} />
                ))}
              </div>
            </div>
          </div>
        )}

        {allErpItems.length > 0 && (
          <div className="flex flex-col">
            <button
              onClick={() => toggleGroup('erp')}
              title={!expanded ? 'ERP & Financeiro' : undefined}
              className={`flex items-center justify-between w-full px-3 py-2.5 text-blue-50 hover:bg-white/10 rounded-xl transition-all duration-200 group relative ${
                !expanded ? 'justify-center' : ''
              }`}
            >
              <div className={`flex items-center ${expanded ? 'gap-2' : 'justify-center w-full'}`}>
                <Wallet size={18} className="shrink-0 text-blue-100 group-hover:text-white transition-colors" />
                <span className={`text-xs font-black uppercase tracking-wide text-white transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                  ERP & Financeiro
                </span>
              </div>
              {expanded && (
                <div className="shrink-0 text-blue-100 group-hover:text-white transition-all duration-200">
                  {openGroups.erp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              )}
              {!expanded && (
                <span className="hidden lg:block absolute left-[84px] w-max bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[60] shadow-xl">
                  ERP & Financeiro
                </span>
              )}
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded && openGroups.erp ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
              <div className="space-y-1 flex flex-col">
                {allErpItems.map((item) => (
                  <NavItem key={item.to} item={item} expanded={expanded} />
                ))}
              </div>
            </div>
          </div>
        )}

        {managementItems.length > 0 && (
          <div className="flex flex-col">
            <button
              onClick={() => toggleGroup('management')}
              title={!expanded ? 'Cadastros & Gestão' : undefined}
              className={`flex items-center justify-between w-full px-3 py-2.5 text-blue-50 hover:bg-white/10 rounded-xl transition-all duration-200 group relative ${
                !expanded ? 'justify-center' : ''
              }`}
            >
              <div className={`flex items-center ${expanded ? 'gap-2' : 'justify-center w-full'}`}>
                <Settings size={18} className="shrink-0 text-blue-100 group-hover:text-white transition-colors" />
                <span className={`text-xs font-black uppercase tracking-wide text-white transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                  Cadastros & Gestão
                </span>
              </div>
              {expanded && (
                <div className="shrink-0 text-blue-100 group-hover:text-white transition-all duration-200">
                  {openGroups.management ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              )}
              {!expanded && (
                <span className="hidden lg:block absolute left-[84px] w-max bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[60] shadow-xl">
                  Cadastros & Gestão
                </span>
              )}
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded && openGroups.management ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
              <div className="space-y-1 flex flex-col">
                {managementItems.map((item) => (
                  <NavItem key={item.to} item={item} expanded={expanded} />
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer (User, Logout) */}
      <div className="p-2.5 bg-[#0F2F52] shrink-0 border-t border-white/5">
        <div
          className={`flex items-center mb-2.5 transition-all duration-300 ${
            expanded ? 'gap-3 px-2 justify-start' : 'justify-center'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase shrink-0">
            {admin.name.charAt(0)}
          </div>
          <div
            className={`min-w-0 flex-1 whitespace-nowrap overflow-hidden transition-all duration-300 ${
              expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'
            }`}
          >
            <p className="text-sm font-bold text-white truncate">{admin.name}</p>
            <p className="text-[10px] font-medium text-blue-200 uppercase tracking-wide truncate">
              {role === 'DRIVER' ? 'Entregador' : 'Administrador'}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          {role === 'SUPER_ADMIN' && (
            <a
              href="#/saas/dashboard"
              title={!expanded ? 'Hub SaaS' : undefined}
              className={`flex items-center py-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 hover:bg-white/5 rounded-lg transition relative group ${
                expanded ? 'px-3 gap-2 w-full justify-start' : 'px-0 w-full justify-center'
              }`}
            >
              <Building2 size={18} className="shrink-0" />
              <span className={`whitespace-nowrap transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
                Hub SaaS
              </span>
              {!expanded && (
                <span className="hidden lg:block absolute left-[84px] w-max bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[60] shadow-xl">
                  Hub SaaS
                </span>
              )}
            </a>
          )}

          <button
            onClick={handleLogout}
            title={!expanded ? 'Sair do Painel' : undefined}
            className={`flex items-center py-2 text-sm font-bold text-rose-400 hover:text-rose-300 hover:bg-white/5 rounded-lg transition relative group ${
              expanded ? 'px-3 gap-2 w-full justify-start' : 'px-0 w-full justify-center'
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden w-0'}`}>
              Sair
            </span>
            {!expanded && (
              <span className="hidden lg:block absolute left-[84px] w-max bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[60] shadow-xl">
                Sair
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden relative transition-all duration-300"
      style={{ "--sidebar-width": sidebarWidth }}
    >
      {/* Desktop & Notebook Sidebar */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        style={{ width: "var(--sidebar-width)" }}
        className="hidden lg:flex shrink-0 h-full bg-[#123B63] text-blue-50 flex-col shadow-2xl overflow-hidden select-none transition-all duration-300 print:hidden z-20"
      >
        {renderSidebarContent(sidebarExpanded)}
      </aside>

      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Gaveta Mobile */}
      {isSidebarOpen && (
        <aside
          className="fixed inset-y-0 left-0 z-50 bg-[#123B63] text-blue-50 flex flex-col shadow-2xl w-[280px] transform transition-transform duration-300 ease-in-out print:hidden lg:hidden translate-x-0"
        >
          {renderSidebarContent(true)}
        </aside>
      )}

      {/* Área Principal Única (Compartilhada entre Desktop e Mobile) */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative transition-all duration-300">
        {/* Cabeçalho Mobile (Apenas visível em telas menores) */}
        <header className="flex lg:hidden h-16 bg-white border-b border-slate-200 items-center px-4 shrink-0 shadow-sm justify-between z-30 relative">
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

        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 print:overflow-visible print:bg-white relative">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
