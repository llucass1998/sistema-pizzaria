import { useEffect, useState, useMemo } from 'react';
import { 
  Building2, Search, X, CheckCircle2, XCircle, 
  Users, ShoppingBag, BarChart3, AlertCircle, Play, Pause, ExternalLink
} from 'lucide-react';
import { Panel } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { BaseModal } from '../../components/ui/BaseModal.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function SaasDashboardPage() {
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showError, showSuccess } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Status Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Validação SUPER_ADMIN
  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminRole = adminDataStr ? JSON.parse(adminDataStr).role : '';
  const isSuperAdmin = adminRole === 'SUPER_ADMIN';

  useEffect(() => {
    if (!isSuperAdmin) return;
    
    let isMounted = true;
    async function fetchTenants() {
      try {
        setIsLoading(true);
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        if (!adminDataStr) return;
        const { token } = JSON.parse(adminDataStr);

        const res = await fetch(`${API_BASE_URL}/saas/admin/tenants`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          setTenants(Array.isArray(data) ? data : []);
        } else if (!res.ok) {
          throw new Error('Erro ao buscar lojas.');
        }
      } catch (error) {
        console.error('Erro SaaS Dashboard:', error);
        showError('Falha ao carregar as lojas cadastradas.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    
    fetchTenants();
    return () => { isMounted = false; };
  }, [isSuperAdmin, showError]);

  const filteredTenants = useMemo(() => {
    let list = tenants;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(t => 
        t.name?.toLowerCase().includes(q) || 
        t.slug?.toLowerCase().includes(q) ||
        t.ownerEmail?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tenants, searchTerm]);

  const metrics = useMemo(() => {
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.isActive).length;
    const totalPlatformOrders = tenants.reduce((acc, t) => acc + (t.totalOrders || 0), 0);
    const totalPlatformCustomers = tenants.reduce((acc, t) => acc + (t.totalCustomers || 0), 0);
    
    return { totalTenants, activeTenants, totalPlatformOrders, totalPlatformCustomers };
  }, [tenants]);

  const handleToggleStatus = async () => {
    if (!selectedTenant) return;
    
    try {
      setIsUpdatingStatus(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);
      const newStatus = !selectedTenant.isActive;

      const res = await fetch(`${API_BASE_URL}/saas/admin/tenants/${selectedTenant.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ isActive: newStatus })
      });

      if (!res.ok) throw new Error('Erro ao atualizar status');

      setTenants(prev => prev.map(t => t.id === selectedTenant.id ? { ...t, isActive: newStatus } : t));
      showSuccess(`Loja ${newStatus ? 'Ativada' : 'Suspensa'} com sucesso.`);
      setIsStatusModalOpen(false);
    } catch (error) {
      console.error(error);
      showError('Falha ao atualizar o status da loja.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Acesso Restrito: Nível Máximo Requerido</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Apenas usuários <strong>SUPER_ADMIN</strong> têm permissão para acessar o painel SaaS de gestão de lojas.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin dark:border-slate-700 dark:border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="text-indigo-600" size={28} />
            Hub Central SaaS
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão Multi-lojas (Tenants), métricas globais de plataforma e infraestrutura.
          </p>
        </div>
      </div>

      {/* Global Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Total de Lojas</span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Building2 size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {metrics.totalTenants}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            {metrics.activeTenants} ativas
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Pedidos Processados</span>
            <div className="rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <ShoppingBag size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {metrics.totalPlatformOrders}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Em toda a plataforma
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Consumidores Globais</span>
            <div className="rounded-xl bg-green-50 p-2 text-green-600 dark:bg-green-950/40 dark:text-green-400">
              <Users size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {metrics.totalPlatformCustomers}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Contas de clientes cadastrados
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-600 to-violet-600 p-5 shadow-md dark:border-indigo-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-indigo-100">Status do Servidor</span>
            <div className="rounded-xl bg-white/20 p-2 text-white">
              <BarChart3 size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-white flex items-center gap-2">
            Online <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
          </p>
          <span className="mt-1 block text-xs font-medium text-indigo-100">
            Node.js API • DB PostgreSQL
          </span>
        </div>
      </div>

      <Panel>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-2xl">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 size={18} className="text-indigo-500" /> Tenants Registrados
          </h3>
          <div className="relative w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, slug, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-white dark:bg-slate-950 uppercase text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4 font-bold tracking-wider">Loja (Tenant)</th>
                <th className="px-5 py-4 font-bold tracking-wider">Dono / E-mail</th>
                <th className="px-5 py-4 font-bold tracking-wider text-center">Pedidos</th>
                <th className="px-5 py-4 font-bold tracking-wider text-center">Clientes</th>
                <th className="px-5 py-4 font-bold tracking-wider text-center">Status</th>
                <th className="px-5 py-4 font-bold tracking-wider text-right">Ações Administrativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{t.name}</p>
                    <p className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                      /{t.slug} <a href={`http://${t.slug}.localhost:5173`} target="_blank" rel="noreferrer" title="Acessar subdomínio" className="text-indigo-500 hover:text-indigo-600"><ExternalLink size={10} /></a>
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{t.ownerName || '—'}</p>
                    <p className="text-xs text-slate-500">{t.ownerEmail || '—'}</p>
                  </td>
                  <td className="px-5 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                    {t.totalOrders}
                  </td>
                  <td className="px-5 py-4 text-center font-medium text-slate-600 dark:text-slate-400">
                    {t.totalCustomers}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {t.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                        <CheckCircle2 size={12} /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                        <XCircle size={12} /> Suspenso
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedTenant(t);
                          setIsStatusModalOpen(true);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${
                          t.isActive 
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50' 
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50'
                        }`}
                      >
                        {t.isActive ? (
                          <><Pause size={12} /> Suspender</>
                        ) : (
                          <><Play size={12} /> Ativar</>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTenants.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500 font-medium text-sm">
                    Nenhuma loja/tenant encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Confirmation Modal */}
      {isStatusModalOpen && selectedTenant && (
        <BaseModal title={selectedTenant.isActive ? 'Suspender Loja' : 'Ativar Loja'} onClose={() => setIsStatusModalOpen(false)}>
          <div className="p-4">
            <div className={`p-4 rounded-xl border mb-6 ${
              selectedTenant.isActive 
                ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-300'
            }`}>
              <p className="text-sm font-bold flex items-center gap-2">
                {selectedTenant.isActive ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                Você está prestes a {selectedTenant.isActive ? 'SUSPENDER' : 'ATIVAR'} a loja:
              </p>
              <p className="mt-2 text-xl font-black">{selectedTenant.name}</p>
              <p className="mt-1 text-xs">Slug: /{selectedTenant.slug}</p>
              
              <p className="mt-4 text-xs font-medium">
                {selectedTenant.isActive 
                  ? 'Isso bloqueará todos os logins de administradores e clientes desta loja, além de fechar a vitrine imediatamente.'
                  : 'Isso reativará o acesso ao painel admin da loja e reabrirá a vitrine (caso as configurações de horário permitam).'}
              </p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                disabled={isUpdatingStatus}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isUpdatingStatus}
                className={`px-5 py-2 font-bold text-white rounded-xl shadow-md transition flex items-center gap-2 ${
                  selectedTenant.isActive
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                {isUpdatingStatus ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  selectedTenant.isActive ? <Pause size={16} /> : <Play size={16} />
                )}
                Confirmar {selectedTenant.isActive ? 'Suspensão' : 'Ativação'}
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
