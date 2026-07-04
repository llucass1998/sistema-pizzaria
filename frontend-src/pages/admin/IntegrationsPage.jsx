import { useEffect, useState, useMemo } from 'react';
import {
  Globe,
  RefreshCw,
  PlusCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  ShieldAlert,
  Key,
  Database,
  Activity,
  Layers,
  Search,
  Trash2,
  Edit3,
  ExternalLink,
  Clock,
  Zap,
  Lock,
  Radio
} from 'lucide-react';
import { Panel, ListRow } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('CREDENTIALS'); // CREDENTIALS, EVENTS, POLLING
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  // State
  const [credentials, setCredentials] = useState([]);
  const [events, setEvents] = useState([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  const [formData, setFormData] = useState({
    provider: 'IFOOD',
    merchantId: '',
    clientId: '',
    clientSecret: '',
    isActive: true,
    metadata: '',
  });

  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminRole = adminDataStr ? JSON.parse(adminDataStr).role : '';
  const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER'];
  const hasPermission = allowedRoles.includes(adminRole);

  useEffect(() => {
    if (hasPermission) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [hasPermission]);

  async function loadData() {
    setIsLoading(true);
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' };

      const [credRes, evRes] = await Promise.all([
        fetch(`${API_BASE_URL}/integrations/credentials`, { headers }),
        fetch(`${API_BASE_URL}/integrations/events`, { headers })
      ]);

      if (credRes.ok) {
        const credData = await credRes.json();
        setCredentials(Array.isArray(credData) ? credData : []);
      }

      if (evRes.ok) {
        const evData = await evRes.json();
        setEvents(Array.isArray(evData) ? evData : []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de integração:', err);
      showError('Erro ao carregar dados do servidor.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePollNow(credentialId = null) {
    setIsPolling(true);
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' };
      const body = credentialId ? JSON.stringify({ credentialId }) : JSON.stringify({});

      const res = await fetch(`${API_BASE_URL}/integrations/ifood/poll-now`, {
        method: 'POST',
        headers,
        body
      });

      if (res.ok) {
        const data = await res.json();
        showSuccess(`Sincronização iniciada com sucesso! (${data.credentials ? `${data.credentials} lojas` : 'Loja atualizada'})`);
        loadData();
      } else {
        const errText = await res.text();
        showError(`Falha na sincronização: ${errText || 'Verifique as credenciais.'}`);
      }
    } catch (err) {
      console.error('Erro no polling manual:', err);
      showError('Erro de comunicação ao forçar sincronização.');
    } finally {
      setIsPolling(false);
    }
  }

  async function handleSaveCredential(e) {
    e.preventDefault();
    if (!formData.clientId || (!editingCred && !formData.clientSecret)) {
      showError('Preencha o Client ID e Client Secret.');
      return;
    }

    setIsSaving(true);
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' };

      let metadataObj = undefined;
      if (formData.metadata && formData.metadata.trim() !== '') {
        try {
          metadataObj = JSON.parse(formData.metadata);
        } catch {
          showError('Formato JSON inválido no campo Metadata.');
          setIsSaving(false);
          return;
        }
      }

      const payload = {
        provider: formData.provider,
        merchantId: formData.merchantId || null,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        isActive: formData.isActive,
        metadata: metadataObj
      };

      const url = editingCred
        ? `${API_BASE_URL}/integrations/credentials/${editingCred.id}`
        : `${API_BASE_URL}/integrations/credentials`;
      
      const method = editingCred ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showSuccess(editingCred ? 'Credencial atualizada com sucesso!' : 'Credencial criada com sucesso!');
        setIsModalOpen(false);
        loadData();
      } else {
        const errData = await res.json().catch(() => ({ message: 'Erro ao salvar credencial.' }));
        showError(errData.message || 'Falha ao salvar credencial.');
      }
    } catch (err) {
      console.error('Erro ao salvar credencial:', err);
      showError('Erro de rede ao processar solicitação.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCredential(id) {
    if (!window.confirm('Tem certeza que deseja desativar/remover esta credencial? A sincronização de pedidos será interrompida.')) {
      return;
    }

    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = { Authorization: `Bearer ${tokenData.token}` };

      const res = await fetch(`${API_BASE_URL}/integrations/credentials/${id}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok || res.status === 204) {
        showSuccess('Credencial desativada.');
        loadData();
      } else {
        showError('Erro ao desativar credencial.');
      }
    } catch (err) {
      console.error('Erro ao excluir credencial:', err);
      showError('Erro de comunicação ao remover.');
    }
  }

  function openNewModal() {
    setEditingCred(null);
    setFormData({
      provider: 'IFOOD',
      merchantId: '',
      clientId: '',
      clientSecret: '',
      isActive: true,
      metadata: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(cred) {
    setEditingCred(cred);
    setFormData({
      provider: cred.provider || 'IFOOD',
      merchantId: cred.merchantId || '',
      clientId: cred.clientId || '',
      clientSecret: '********', // manter inalterado se não mexer
      isActive: cred.isActive !== false,
      metadata: cred.metadata ? JSON.stringify(cred.metadata, null, 2) : '',
    });
    setIsModalOpen(true);
  }

  // KPIs
  const activeCount = useMemo(() => credentials.filter(c => c.isActive).length, [credentials]);
  const ifoodConnected = useMemo(() => credentials.some(c => c.provider === 'IFOOD' && c.isActive && c.hasAccessToken), [credentials]);
  const lastSyncTime = useMemo(() => {
    const syncs = credentials.map(c => c.lastSyncAt).filter(Boolean);
    if (syncs.length === 0) return null;
    return new Date(Math.max(...syncs.map(s => new Date(s).getTime()))).toLocaleString('pt-BR');
  }, [credentials]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (providerFilter !== 'ALL' && ev.provider !== providerFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (ev.eventType && ev.eventType.toLowerCase().includes(q)) ||
        (ev.referenceId && ev.referenceId.toLowerCase().includes(q)) ||
        (ev.payload && JSON.stringify(ev.payload).toLowerCase().includes(q))
      );
    });
  }, [events, providerFilter, searchQuery]);

  if (!hasPermission) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Acesso Restrito</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Seu perfil ({adminRole || 'Sem Perfil'}) não tem permissão para gerenciar integrações com plataformas de Delivery (iFood / 99Food).
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="text-red-600" />
            Gestão de Integrações (iFood / Delivery)
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Gerenciamento de credenciais externas, polling automático de pedidos em tempo real e log de eventos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePollNow()}
            disabled={isPolling || activeCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm transition shadow-sm"
          >
            <RefreshCw size={16} className={isPolling ? 'animate-spin' : ''} />
            {isPolling ? 'Sincronizando...' : 'Sincronizar Pedidos Agora'}
          </button>
          <button
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition shadow-sm"
          >
            <PlusCircle size={16} />
            Nova Credencial
          </button>
        </div>
      </div>

      {/* Linha de KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-red-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">iFood Polling</span>
          <div className="flex items-center gap-2 mt-1">
            <Radio size={18} className={ifoodConnected ? 'text-green-500 animate-pulse' : 'text-slate-400'} />
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {ifoodConnected ? 'Conectado (Ativo)' : activeCount > 0 ? 'Aguardando Auth' : 'Desconectado'}
            </span>
          </div>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-blue-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lojas Configuradas</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {activeCount}
            </span>
            <span className="text-xs text-slate-500 font-bold">de {credentials.length} totais</span>
          </div>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-purple-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eventos no Log</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {events.length}
            </span>
            <span className="text-xs text-slate-500 font-bold">recebidos</span>
          </div>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-emerald-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Último Polling</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1.5">
            <Clock size={14} />
            {lastSyncTime || 'Nenhuma sincronização'}
          </span>
        </Panel>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('CREDENTIALS')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'CREDENTIALS'
              ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Key size={16} />
          Credenciais & Lojas ({credentials.length})
        </button>

        <button
          onClick={() => setActiveTab('EVENTS')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'EVENTS'
              ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Activity size={16} />
          Log de Eventos ({events.length})
        </button>

        <button
          onClick={() => setActiveTab('POLLING')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'POLLING'
              ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Zap size={16} />
          Diagnóstico & Polling
        </button>
      </div>

      {/* TAB 1: CREDENTIALS */}
      {activeTab === 'CREDENTIALS' && (
        <div className="space-y-4">
          {credentials.length === 0 ? (
            <Panel className="p-12 text-center">
              <Globe className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nenhuma Credencial Configuradada</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
                Conecte sua loja ao iFood ou 99Food inserindo o Client ID e Client Secret fornecidos pelo portal do parceiro.
              </p>
              <button
                onClick={openNewModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition"
              >
                <PlusCircle size={16} />
                Adicionar Credencial iFood
              </button>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {credentials.map((cred) => (
                <Panel key={cred.id} className="p-5 hover:border-slate-300 dark:hover:border-slate-700 transition">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-2xl ${cred.provider === 'IFOOD' ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400'}`}>
                        <Globe size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-black text-lg text-slate-900 dark:text-white">
                            {cred.provider === 'IFOOD' ? 'iFood Delivery' : '99Food Delivery'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            cred.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {cred.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                          {cred.hasAccessToken ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" title="OAuth Token Gerado">
                              <CheckCircle size={12} className="text-blue-600" /> Token OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" title="Necessita autenticar">
                              <AlertTriangle size={12} className="text-amber-600" /> Sem Token OAuth
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span><b>Merchant ID:</b> {cred.merchantId || 'Padrão da conta'}</span>
                          <span><b>Client ID:</b> {cred.clientId ? `${cred.clientId.slice(0, 8)}...${cred.clientId.slice(-4)}` : 'N/A'}</span>
                          {cred.lastSyncAt && (
                            <span><b>Último Polling:</b> {new Date(cred.lastSyncAt).toLocaleString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handlePollNow(cred.id)}
                        disabled={isPolling || !cred.isActive}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                        title="Forçar verificação de pedidos para esta loja"
                      >
                        <RefreshCw size={14} className={isPolling ? 'animate-spin' : ''} />
                        Sincronizar
                      </button>
                      <button
                        onClick={() => openEditModal(cred)}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300 transition"
                        title="Editar Credenciais"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCredential(cred.id)}
                        className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/40 dark:hover:bg-red-950/20 dark:text-red-400 transition"
                        title="Desativar Credencial"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EVENTS LOG */}
      {activeTab === 'EVENTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código do evento, referência..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="ALL">Todos os Providers</option>
                <option value="IFOOD">Apenas iFood</option>
                <option value="99FOOD">Apenas 99Food</option>
              </select>
            </div>
          </div>

          <Panel className="overflow-hidden">
            {filteredEvents.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum evento de integração registrado no momento.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Quando novos pedidos chegam do iFood, eles aparecem aqui em tempo real.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-4">Data / Hora</th>
                      <th className="p-4">Provider</th>
                      <th className="p-4">Tipo de Evento</th>
                      <th className="p-4">Referência / Pedido</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                    {filteredEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition">
                        <td className="p-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            ev.provider === 'IFOOD' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                          }`}>
                            {ev.provider}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {ev.eventType || 'PLC / SYNC'}
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {ev.referenceId || ev.orderId || 'N/A'}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                            <CheckCircle size={14} /> Processado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* TAB 3: POLLING DIAGNOSTICS */}
      {activeTab === 'POLLING' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel className="p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="text-amber-500" />
              Funcionamento do Polling iFood
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Diferente de sistemas que exigem aberturas de portas ou VPNs complexas, o nosso ERP utiliza o modelo oficial de <b>Long Polling 30s</b> recomendado pela engenharia do iFood.
            </p>
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                <div><b>Autenticação OAuth2:</b> O sistema solicita um token de acesso de curta duração aos servidores do iFood automaticamente.</div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                <div><b>Coleta de Eventos (Polling):</b> A cada 30 segundos, o worker checa se há novos pedidos, cancelamentos ou atualizações de status.</div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-500 font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                <div><b>Confirmação Acknowledging:</b> Após processar e criar o pedido no KDS/Cozinha, o sistema envia o sinal de confirmação ao iFood para evitar duplicidade.</div>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => handlePollNow()}
                disabled={isPolling || activeCount === 0}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition flex items-center justify-center gap-2 shadow-md"
              >
                <RefreshCw size={18} className={isPolling ? 'animate-spin' : ''} />
                {isPolling ? 'Verificando Fila de Pedidos...' : 'Executar Sincronização e Limpeza de Fila Agora'}
              </button>
            </div>
          </Panel>

          <Panel className="p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="text-emerald-500" />
              Segurança e Webhooks
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Todas as credenciais sensíveis (Client Secret e Tokens OAuth2) são armazenadas de forma criptografada e isoladas por <b>Tenant (Multitenant)</b> no banco PostgreSQL.
            </p>
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10 text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle size={16} className="text-emerald-600" />
                Ambiente 100% Compatível com Produção
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Caso prefira utilizar Webhooks ao invés de Polling, o endpoint do proxy no Caddy/Nginx já está preparado para receber notificações externas em <code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded">/api/webhooks/ifood</code>.
              </p>
            </div>
          </Panel>
        </div>
      )}

      {/* MODAL NOVA / EDITAR CREDENCIAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="text-red-600" />
                {editingCred ? 'Editar Credencial de Delivery' : 'Nova Credencial de Delivery'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCredential} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Plataforma / Provider</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-red-500"
                >
                  <option value="IFOOD">iFood</option>
                  <option value="99FOOD">99Food</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Merchant ID (ID da Loja no Portal)</label>
                <input
                  type="text"
                  value={formData.merchantId}
                  onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                  placeholder="Ex: 12345678-abcd-1234..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-red-500 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Opcional. Permite gerenciar múltiplas lojas da mesma marca.</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Client ID *</label>
                <input
                  type="text"
                  required
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  placeholder="Ex: 8a9f0e1d-2c3b-4a5e..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Client Secret *</label>
                <input
                  type="password"
                  required={!editingCred}
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                  placeholder={editingCred ? '******** (Manter inalterado)' : 'Cole o Client Secret aqui'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-red-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Sincronização Ativa (Executar Polling automático)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-300 font-bold text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition flex items-center gap-2"
                >
                  {isSaving && <RefreshCw size={14} className="animate-spin" />}
                  {editingCred ? 'Salvar Alterações' : 'Conectar Loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default IntegrationsPage;
