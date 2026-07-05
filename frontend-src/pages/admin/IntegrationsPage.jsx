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
  Radio,
  BookOpen,
  Store,
  Play
} from 'lucide-react';
import { Panel, ListRow } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('CREDENTIALS'); // CREDENTIALS, POLLING, WEBHOOK, CATALOG, STATUS, LOGS
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  const [credentials, setCredentials] = useState([]);
  const [events, setEvents] = useState([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Catalog State
  const [catalogPreview, setCatalogPreview] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  // Merchant State
  const [merchantStatus, setMerchantStatus] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('ALL');

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
  const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER', 'INTEGRATION_MANAGER'];
  const hasPermission = adminRole === 'SUPER_ADMIN' || allowedRoles.includes(adminRole);

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
      console.error('Erro ao carregar dados:', err);
      showError('Erro ao carregar dados do servidor.');
    } finally {
      setIsLoading(false);
    }
  }

  // --- Handlers ---
  async function handlePollNow(credentialId = null) {
    setIsPolling(true);
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' };
      const body = credentialId ? JSON.stringify({ credentialId }) : JSON.stringify({});
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/poll-now`, { method: 'POST', headers, body });
      if (res.ok) {
        showSuccess('Sincronização iniciada com sucesso!');
        loadData();
      } else {
        showError('Falha na sincronização manual.');
      }
    } catch (err) {
      showError('Erro de comunicação.');
    } finally {
      setIsPolling(false);
    }
  }

  async function handleSaveCredential(e) {
    e.preventDefault();
    if (adminRole === 'INTEGRATION_MANAGER') {
      showError('Acesso Negado: Apenas ADMIN ou OWNER podem salvar credenciais.');
      return;
    }
    setIsSaving(true);
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' };
      const payload = { ...formData };
      const url = editingCred ? `${API_BASE_URL}/integrations/credentials/${editingCred.id}` : `${API_BASE_URL}/integrations/credentials`;
      const method = editingCred ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        showSuccess('Credencial salva!');
        setIsModalOpen(false);
        loadData();
      } else {
        showError('Erro ao salvar credencial.');
      }
    } catch (err) {
      showError('Erro de rede.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePreviewCatalog() {
    setIsPreviewing(true);
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/catalog/preview`, {
        headers: { Authorization: `Bearer ${tokenData.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCatalogPreview(data);
        showSuccess('Preview do cardápio gerado com sucesso!');
      } else {
        showError('Erro ao gerar preview do cardápio.');
      }
    } catch (err) {
      showError('Erro de comunicação.');
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSyncCatalog(credentialId) {
    if (!hasPermission) {
      showError('Sem permissão para sincronizar o cardápio real no iFood.');
      return;
    }
    if (!window.confirm('ATENÇÃO: Entendo que esta sincronização pode sobrescrever o catálogo atual do iFood. Deseja prosseguir?')) {
      return;
    }
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/catalog/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId })
      });
      if (res.ok) {
        showSuccess('Cardápio sincronizado com sucesso!');
        loadData();
      } else {
        showError('Falha ao sincronizar cardápio.');
      }
    } catch (err) {
      showError('Erro de rede.');
    }
  }

  async function loadMerchantStatus(credentialId) {
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/merchant/status?credentialId=${credentialId}`, {
        headers: { Authorization: `Bearer ${tokenData.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMerchantStatus(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMerchantPause(credentialId) {
    const reason = window.prompt('Qual o motivo da pausa? (Ex: Alta demanda, manutenção)');
    if (!reason) return;
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/merchant/pause`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId, reason })
      });
      if (res.ok) {
        showSuccess('Loja pausada no iFood.');
        loadMerchantStatus(credentialId);
      } else {
        showError('Erro ao pausar loja.');
      }
    } catch (err) {
      showError('Erro de rede.');
    }
  }

  async function handleMerchantResume(credentialId) {
    if (!window.confirm('Tem certeza que deseja reabrir a loja no iFood?')) return;
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/merchant/resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId })
      });
      if (res.ok) {
        showSuccess('Loja retomada no iFood.');
        loadMerchantStatus(credentialId);
      } else {
        showError('Erro ao retomar loja.');
      }
    } catch (err) {
      showError('Erro de rede.');
    }
  }

  if (!hasPermission) {
    return (
      <div className="p-8">
        <Panel>
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
            <ShieldAlert size={48} className="text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-800">Acesso Negado</h2>
            <p>Seu perfil não tem permissão para visualizar integrações.</p>
          </div>
        </Panel>
      </div>
    );
  }

  const ifoodCred = credentials.find(c => c.provider === 'IFOOD' && c.isActive);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Globe className="text-blue-600" /> Integrações e iFood
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie a conexão e sincronização com plataformas externas.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
        {[
          { id: 'CREDENTIALS', label: 'Credenciais', icon: Key },
          { id: 'POLLING', label: 'Polling', icon: RefreshCw },
          { id: 'WEBHOOK', label: 'Webhook', icon: Zap },
          { id: 'CATALOG', label: 'Cardápio', icon: BookOpen },
          { id: 'STATUS', label: 'Status da Loja', icon: Store },
          { id: 'LOGS', label: 'Logs & Auditoria', icon: Database },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'CREDENTIALS' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold text-gray-800">Credenciais Ativas</h2>
             {adminRole !== 'INTEGRATION_MANAGER' && (
               <button onClick={() => { setEditingCred(null); setIsModalOpen(true); }} className="btn-primary">
                 <PlusCircle size={18} /> Nova Credencial
               </button>
             )}
          </div>
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-100">
              Nenhuma credencial configurada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {credentials.map(cred => (
                <div key={cred.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${cred.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cred.provider === 'IFOOD' ? <Globe size={20} /> : <Layers size={20} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{cred.provider}</h3>
                        <span className="text-xs text-gray-500">ID: {cred.merchantId || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <p><span className="font-medium text-gray-800">Client ID:</span> {cred.clientId}</p>
                    <p><span className="font-medium text-gray-800">Secret:</span> ********</p>
                    <p><span className="font-medium text-gray-800">Status Token:</span> {cred.hasAccessToken ? 'OK' : 'Pendente'}</p>
                  </div>
                  {adminRole !== 'INTEGRATION_MANAGER' && (
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setEditingCred(cred);
                        setFormData({
                          provider: cred.provider,
                          merchantId: cred.merchantId || '',
                          clientId: cred.clientId,
                          clientSecret: '********',
                          isActive: cred.isActive,
                          metadata: cred.metadata ? JSON.stringify(cred.metadata) : '',
                        });
                        setIsModalOpen(true);
                      }} className="btn-secondary w-full text-xs py-1.5"><Edit3 size={14} /> Editar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'POLLING' && (
        <Panel title="Fallback & Polling Manual">
          <div className="p-6 bg-blue-50 text-blue-800 rounded-lg border border-blue-100 mb-6">
            <h3 className="font-bold flex items-center gap-2 mb-2"><Radio size={18} /> Polling Ativo</h3>
            <p className="text-sm">O sistema busca pedidos a cada 30 segundos automaticamente para todas as credenciais ativas. Ele funciona como redundância (fallback) do Webhook em Tempo Real.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => handlePollNow()}
              disabled={isPolling}
              className="btn-primary"
            >
              {isPolling ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              {isPolling ? 'Sincronizando...' : 'Forçar Polling Agora'}
            </button>
            <span className="text-sm text-gray-500">Último disparo: {new Date().toLocaleTimeString()}</span>
          </div>
        </Panel>
      )}

      {activeTab === 'WEBHOOK' && (
        <Panel title="Webhook (Eventos em Tempo Real)">
          <div className="p-6 bg-green-50 text-green-800 rounded-lg border border-green-100 mb-6">
            <h3 className="font-bold flex items-center gap-2 mb-2"><Zap size={18} /> Recepção em Tempo Real</h3>
            <p className="text-sm mb-4">Configure a URL pública abaixo no portal do parceiro do iFood para receber novos pedidos e atualizações de status instantaneamente sem depender do polling.</p>
            <div className="bg-white p-3 rounded border border-green-200 flex items-center justify-between">
               <code className="text-sm font-mono text-gray-800">
                 https://{window.location.hostname}/api/public/webhooks/ifood
               </code>
               <button className="btn-secondary text-xs" onClick={() => navigator.clipboard.writeText(`https://${window.location.hostname}/api/public/webhooks/ifood`)}>Copiar</button>
            </div>
          </div>
          <div className="text-sm text-gray-600">
             <p>A rota pública possui idempotência: ela nunca duplicará um pedido que já tenha sido importado, seja por webhook anterior ou pelo worker de polling.</p>
          </div>
        </Panel>
      )}

      {activeTab === 'CATALOG' && (
        <Panel title="Sincronização de Cardápio (Catálogo)">
           {!ifoodCred ? (
             <div className="text-gray-500">Configure uma credencial do iFood primeiro.</div>
           ) : (
             <div className="space-y-6">
               <div className="flex gap-4">
                 <button onClick={handlePreviewCatalog} disabled={isPreviewing} className="btn-secondary">
                   {isPreviewing ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />} Preview (Homologação)
                 </button>
                 <button onClick={() => handleSyncCatalog(ifoodCred.id)} className="btn-primary bg-orange-600 hover:bg-orange-700">
                   <Send size={18} /> Sincronizar Cardápio no iFood
                 </button>
               </div>

               {catalogPreview && (
                 <div className="mt-6 border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-4 border-b flex gap-6">
                       <div><span className="block text-xs text-gray-500 uppercase">Total Categorias</span><span className="font-bold text-lg">{catalogPreview.totalCategories}</span></div>
                       <div><span className="block text-xs text-green-600 uppercase">Itens Válidos</span><span className="font-bold text-lg text-green-700">{catalogPreview.totalValidItems}</span></div>
                       <div><span className="block text-xs text-red-500 uppercase">Itens com Erro</span><span className="font-bold text-lg text-red-600">{catalogPreview.totalInvalidItems}</span></div>
                    </div>
                    {catalogPreview.invalidItems.length > 0 && (
                      <div className="p-4 bg-red-50">
                        <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Produtos Ignorados</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          {catalogPreview.invalidItems.map((inv, idx) => (
                            <li key={idx}>- {inv.name}: {inv.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                 </div>
               )}
             </div>
           )}
        </Panel>
      )}

      {activeTab === 'STATUS' && (
        <Panel title="Controle de Loja (Merchant Status)">
           {!ifoodCred ? (
             <div className="text-gray-500">Configure uma credencial do iFood primeiro.</div>
           ) : (
             <div className="space-y-6">
               <div className="flex items-center gap-4">
                 <button onClick={() => loadMerchantStatus(ifoodCred.id)} className="btn-secondary text-sm">Checar Status Atual</button>
               </div>
               
               {merchantStatus && (
                 <div className="bg-white p-6 border rounded-lg shadow-sm flex items-center justify-between">
                   <div>
                     <h3 className="text-sm font-bold text-gray-500 uppercase">Status no iFood</h3>
                     <span className={`text-2xl font-black ${merchantStatus.status === 'AVAILABLE' ? 'text-green-600' : 'text-red-600'}`}>
                        {merchantStatus.status === 'AVAILABLE' ? 'ABERTA' : 'FECHADA'}
                     </span>
                     <p className="text-xs text-gray-400 mt-1">Última checagem: {new Date(merchantStatus.lastUpdate).toLocaleString()}</p>
                   </div>
                   <div className="flex gap-3">
                     {merchantStatus.status === 'AVAILABLE' ? (
                       <button onClick={() => handleMerchantPause(ifoodCred.id)} className="btn-secondary bg-red-50 hover:bg-red-100 text-red-700 border-red-200">
                         Pausar Loja
                       </button>
                     ) : (
                       <button onClick={() => handleMerchantResume(ifoodCred.id)} className="btn-primary">
                         Retomar Loja
                       </button>
                     )}
                   </div>
                 </div>
               )}
             </div>
           )}
        </Panel>
      )}

      {activeTab === 'LOGS' && (
        <Panel title="Logs de Auditoria (Últimos 100 eventos)">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                   <th className="p-3 border-b">Data</th>
                   <th className="p-3 border-b">Provider</th>
                   <th className="p-3 border-b">Evento</th>
                   <th className="p-3 border-b">Status</th>
                 </tr>
               </thead>
               <tbody>
                 {events.map(ev => (
                   <tr key={ev.id} className="hover:bg-gray-50 text-sm border-b">
                     <td className="p-3">{new Date(ev.createdAt).toLocaleString()}</td>
                     <td className="p-3 font-medium">{ev.provider}</td>
                     <td className="p-3">{ev.eventType || 'N/A'}</td>
                     <td className="p-3">
                       <span className={`px-2 py-1 rounded text-xs ${
                         ev.status === 'PROCESSED' || ev.status === 'ACKNOWLEDGED' ? 'bg-green-100 text-green-700' :
                         ev.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                       }`}>
                         {ev.status}
                       </span>
                     </td>
                   </tr>
                 ))}
                 {events.length === 0 && (
                   <tr><td colSpan="4" className="text-center p-4 text-gray-500">Nenhum evento registrado.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </Panel>
      )}

      {/* Modal Nova/Editar Credencial */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-800">{editingCred ? 'Editar Credencial' : 'Nova Credencial'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCredential} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select className="input-field" value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })}>
                  <option value="IFOOD">iFood</option>
                  <option value="99FOOD">99Food</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID (ID da Loja)</label>
                <input required type="text" className="input-field" value={formData.merchantId} onChange={e => setFormData({ ...formData, merchantId: e.target.value })} placeholder="Ex: e89a-4c2f-..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input required type="text" className="input-field" value={formData.clientId} onChange={e => setFormData({ ...formData, clientId: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                <input required={!editingCred} type="password" className="input-field" value={formData.clientSecret} onChange={e => setFormData({ ...formData, clientSecret: e.target.value })} placeholder={editingCred ? "******** (Deixe vazio para manter)" : ""} />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Ativa para sincronização</label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={isSaving} className="btn-primary">
                  {isSaving ? 'Salvando...' : 'Salvar Credencial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
