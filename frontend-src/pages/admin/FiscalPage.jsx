import { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  ShieldCheck,
  Receipt,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  PlusCircle,
  Eye,
  Send,
  ShieldAlert,
  Download,
  Key,
  Globe,
  Lock,
  FileCode
} from 'lucide-react';
import { Panel, ListRow, RowActions } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrencySafe } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function FiscalPage() {
  const [activeTab, setActiveTab] = useState('DOCUMENTS'); // DOCUMENTS, SETTINGS, EMIT_MANUAL
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  // Data State
  const [documents, setDocuments] = useState([]);
  const [settings, setSettings] = useState({
    environment: 'HOMOLOGACAO',
    certificateUrl: '',
    certificatePassword: '',
    tokenSefaz: '',
  });
  const [recentOrders, setRecentOrders] = useState([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Detail Modal
  const [selectedDoc, setSelectedDoc] = useState(null);

  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminRole = adminDataStr ? JSON.parse(adminDataStr).role : '';
  const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER'];
  const hasPermission = allowedRoles.includes(adminRole);

  useEffect(() => {
    if (hasPermission) {
      loadAllData();
    }
  }, [hasPermission]);

  async function loadAllData() {
    try {
      setIsLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Configurações Fiscais
      const settingsRes = await fetch(`${API_BASE_URL}/admin/fiscal/settings`, { headers });
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings({
          environment: settingsData.environment || 'HOMOLOGACAO',
          certificateUrl: settingsData.certificateUrl || '',
          certificatePassword: settingsData.certificatePassword || '',
          tokenSefaz: settingsData.tokenSefaz || '',
        });
      }

      // 2. Histórico de Documentos Fiscais
      const docsRes = await fetch(`${API_BASE_URL}/admin/fiscal/documents`, { headers });
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(Array.isArray(docsData) ? docsData : []);
      }

      // 3. Pedidos recentes para emissão avulsa
      const ordersRes = await fetch(`${API_BASE_URL}/admin/orders?limit=30`, { headers });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(Array.isArray(ordersData.orders || ordersData) ? (ordersData.orders || ordersData) : []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados fiscais:', err);
      showError('Falha ao carregar informações de emissão fiscal.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);

      const response = await fetch(`${API_BASE_URL}/admin/fiscal/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          environment: settings.environment,
          tokenSefaz: settings.tokenSefaz.trim() || null,
          certificateUrl: settings.certificateUrl.trim() || null,
          certificatePassword: settings.certificatePassword.trim() || null,
        }),
      });

      if (response.ok) {
        showSuccess('Configurações fiscais salvas com sucesso!');
        loadAllData();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Erro ao atualizar configurações fiscais.');
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleIssueNfce(orderIdToIssue) {
    if (!orderIdToIssue) {
      showError('Selecione um pedido para emitir a NFC-e.');
      return;
    }

    try {
      setIsIssuing(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);

      const response = await fetch(`${API_BASE_URL}/admin/fiscal/orders/${orderIdToIssue}/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        showSuccess(result.message || 'NFC-e demonstrativa emitida com sucesso!');
        setSelectedOrderId('');
        loadAllData();
      } else {
        throw new Error(result.message || 'Falha ao emitir documento fiscal para este pedido.');
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setIsIssuing(false);
    }
  }

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((doc) => {
      const orderIdMatch = doc.orderId?.toLowerCase().includes(q);
      const keyMatch = doc.accessKey?.toLowerCase().includes(q);
      const customerNameMatch = doc.order?.customer?.name?.toLowerCase().includes(q);
      const customerPhoneMatch = doc.order?.customer?.phone?.toLowerCase().includes(q);
      return orderIdMatch || keyMatch || customerNameMatch || customerPhoneMatch;
    });
  }, [documents, searchQuery]);

  // Cálculos executivos do topo (KPIs)
  const totalIssuedCount = documents.length;
  const totalIssuedValue = useMemo(() => {
    return documents.reduce((acc, doc) => acc + (Number(doc.orderTotal) || 0), 0);
  }, [documents]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DEMO_ISSUED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
            <ShieldCheck size={12} className="text-blue-600" /> Emitido (Demo)
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300">
            <CheckCircle size={12} className="text-green-600" /> Autorizada SEFAZ
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
            <RefreshCw size={12} className="animate-spin text-amber-600" /> Em Processamento
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
            <XCircle size={12} className="text-red-600" /> Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  if (!hasPermission) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Acesso Restrito</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Seu perfil ({adminRole || 'Sem Perfil'}) não tem permissão para gerenciar a emissão fiscal e NFC-e.
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
            <Receipt className="text-red-600" />
            Emissão Fiscal & NFC-e (`/fiscal`)
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Consulta de documentos emitidos ao consumidor, emissão avulsa e configurações de integração SEFAZ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            title="Atualizar dados"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Linha de KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-blue-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total NFC-e Emitidas</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalIssuedCount}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">Documentos</span>
          </div>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-emerald-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Volume Fiscal Total</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrencySafe(totalIssuedValue)}
          </span>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-amber-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ambiente SEFAZ</span>
          <div className="mt-1">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase ${
                settings.environment === 'PRODUCAO'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              <Globe size={12} />
              {settings.environment}
            </span>
          </div>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-purple-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status do Provedor</span>
          <span className="text-sm font-black text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
            <ShieldCheck size={16} /> Operante (Modo Demonstração)
          </span>
        </Panel>
      </div>

      {/* Navegação por Abas */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'DOCUMENTS'
              ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <FileText size={16} className={activeTab === 'DOCUMENTS' ? 'text-red-400' : ''} />
          Histórico de NFC-e ({documents.length})
        </button>

        <button
          onClick={() => setActiveTab('EMIT_MANUAL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'EMIT_MANUAL'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <PlusCircle size={16} className={activeTab === 'EMIT_MANUAL' ? 'text-white' : 'text-red-500'} />
          Emissão Avulsa / Demonstrativa
        </button>

        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'SETTINGS'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Settings size={16} className={activeTab === 'SETTINGS' ? 'text-white' : 'text-blue-500'} />
          Configurações SEFAZ / Certificado
        </button>
      </div>

      {/* --- ABA 1: HISTÓRICO DE DOCUMENTOS (DOCUMENTS) --- */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Barra de Busca */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por ID do Pedido, Cliente, Chave de Acesso ou Telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            <div className="text-xs text-slate-500 self-center">
              Exibindo <span className="font-bold text-slate-900 dark:text-white">{filteredDocuments.length}</span> de {documents.length} documentos emitidos.
            </div>
          </div>

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5 font-black">Pedido / Data</th>
                    <th className="px-6 py-3.5 font-black">Cliente</th>
                    <th className="px-6 py-3.5 font-black text-right">Valor Total</th>
                    <th className="px-6 py-3.5 font-black">Chave / Identificador SEFAZ</th>
                    <th className="px-6 py-3.5 font-black text-center">Ambiente</th>
                    <th className="px-6 py-3.5 font-black text-center">Status</th>
                    <th className="px-6 py-3.5 font-black text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-6 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-white">
                          Pedido #{doc.orderId?.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(doc.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {doc.order?.customer?.name || 'Cliente Balcão / Anônimo'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {doc.order?.customer?.phone || 'Sem Telefone'}
                        </p>
                      </td>
                      <td className="px-6 py-3.5 text-right font-black text-slate-900 dark:text-white text-base">
                        {formatCurrencySafe(doc.orderTotal)}
                      </td>
                      <td className="px-6 py-3.5">
                        {doc.accessKey ? (
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                            {doc.accessKey}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Demonstrativo — Sem Chave SEFAZ
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {doc.environment}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">{getStatusBadge(doc.status)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedDoc(doc)}
                            title="Ver Detalhes do Documento"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleIssueNfce(doc.orderId)}
                            title="Reemitir / Atualizar Documento Fiscal"
                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/40 rounded-lg transition"
                          >
                            <RefreshCw size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDocuments.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-12 text-center text-slate-500 font-medium">
                        {searchQuery
                          ? 'Nenhum documento fiscal corresponde à sua busca.'
                          : 'Nenhum documento fiscal emitido até o momento.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* --- ABA 2: EMISSÃO AVULSA / DEMONSTRATIVA (EMIT_MANUAL) --- */}
      {activeTab === 'EMIT_MANUAL' && (
        <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-600 text-white shrink-0">
                <Printer size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-900 dark:text-red-300">
                  Emissão Avulsa de NFC-e Demonstrativa
                </h3>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  Selecione um pedido recente ou informe seu ID para gerar ou reemitir o cupom fiscal (NFC-e).
                </p>
              </div>
            </div>
          </div>

          <Panel className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Selecione um Pedido Recente para Emissão
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                  >
                    <option value="">Selecione um pedido da lista...</option>
                    {recentOrders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        Pedido #{ord.id.slice(0, 8).toUpperCase()} — {ord.customer?.name || 'Balcão'} ({formatCurrencySafe(ord.total)}) — {new Date(ord.createdAt).toLocaleTimeString('pt-BR')}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleIssueNfce(selectedOrderId)}
                    disabled={!selectedOrderId || isIssuing}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isIssuing ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Emitindo...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Emitir NFC-e
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
                  Últimos 5 Pedidos Concluídos / Em Processamento
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {recentOrders.slice(0, 6).map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                        selectedOrderId === ord.id
                          ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 ring-2 ring-red-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-black text-xs text-slate-900 dark:text-white">
                          #{ord.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {ord.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                          {ord.customer?.name || 'Cliente Balcão'}
                        </p>
                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {formatCurrencySafe(ord.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* --- ABA 3: CONFIGURAÇÕES E SEFAZ (SETTINGS) --- */}
      {activeTab === 'SETTINGS' && (
        <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300 text-sm">
            <AlertTriangle size={20} className="text-amber-600 shrink-0" />
            <p>
              <strong>Modo Seguro Homologação:</strong> No provedor atual do sistema (`MOCK`), as notas são demonstrativas para homologação e auditoria de saldos sem gerar obrigatoriedades tributárias na SEFAZ.
            </p>
          </div>

          <Panel className="p-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Settings size={20} className="text-blue-500" />
              Parâmetros do Provedor Fiscal
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ambiente de Emissão
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, environment: 'HOMOLOGACAO' })}
                    className={`p-3 rounded-xl border text-left font-bold transition flex items-center gap-2 ${
                      settings.environment === 'HOMOLOGACAO'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Globe size={18} className="text-amber-500" />
                    <div>
                      <p className="text-sm">Homologação (Testes)</p>
                      <p className="text-[10px] font-normal text-slate-500">Sem valor fiscal</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, environment: 'PRODUCAO' })}
                    className={`p-3 rounded-xl border text-left font-bold transition flex items-center gap-2 ${
                      settings.environment === 'PRODUCAO'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldCheck size={18} className="text-emerald-500" />
                    <div>
                      <p className="text-sm">Produção (SEFAZ Real)</p>
                      <p className="text-[10px] font-normal text-slate-500">Validade jurídica direta</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Token CSC / Identificador SEFAZ
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Código de Segurança do Contribuinte (CSC) fornecido pela SEFAZ"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={settings.tokenSefaz}
                    onChange={(e) => setSettings({ ...settings, tokenSefaz: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Caminho ou URL do Certificado Digital A1 (.pfx)
                  </label>
                  <div className="relative">
                    <FileCode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ex: /certificados/empresa_a1.pfx"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={settings.certificateUrl}
                      onChange={(e) => setSettings({ ...settings, certificateUrl: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Senha do Certificado Digital
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={settings.certificatePassword}
                      onChange={(e) =>
                        setSettings({ ...settings, certificatePassword: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Salving...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Salvar Configurações Fiscais
                    </>
                  )}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      {/* --- MODAL DETALHES DA NFC-E --- */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 text-sm">
            <div className="px-6 py-4 bg-slate-900 text-white dark:bg-slate-800 flex items-center justify-between">
              <h3 className="font-black text-base flex items-center gap-2">
                <Receipt size={18} className="text-red-500" />
                Detalhes do Documento Fiscal
              </h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400">Pedido Vinculado</span>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    #{selectedDoc.orderId?.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-500">
                    Emitido em: {new Date(selectedDoc.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase text-slate-400">Valor Total</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrencySafe(selectedDoc.orderTotal)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-slate-500">Ambiente:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedDoc.environment}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Status SEFAZ:</span>
                  <span>{getStatusBadge(selectedDoc.status)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-slate-500">Chave de Acesso:</span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                    {selectedDoc.accessKey || 'Não gerada (Demonstrativo)'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-400">Retorno do Provedor / SEFAZ</span>
                <p className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {selectedDoc.message || 'Operação realizada com sucesso.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="px-5 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleIssueNfce(selectedDoc.orderId);
                    setSelectedDoc(null);
                  }}
                  className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-500/20 transition flex items-center gap-1.5"
                >
                  <RefreshCw size={16} /> Reemitir NFC-e
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
