import { useEffect, useState } from 'react';
import {
  Globe,
  RefreshCw,
  PlusCircle,
  XCircle,
  AlertTriangle,
  Send,
  ShieldAlert,
  Key,
  Database,
  Activity,
  Layers,
  Search,
  Edit3,
  Eye,
  Copy,
  ClipboardCheck,
  BarChart3,
  Settings,
  ShoppingBag,
  Link2,
  Wifi,
  ShieldCheck,
  Clock,
  Zap,
  Lock,
  Radio,
  BookOpen,
  Store,
  Play,
} from 'lucide-react';
import { Panel } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const healthStyle = {
  HEALTHY:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
  WARNING:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  CRITICAL:
    'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
  DISCONNECTED:
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  ONLINE:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
  OFFLINE:
    'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
  UNKNOWN:
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  VALID:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
  EXPIRED:
    'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
  PENDING:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  ERROR:
    'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
  INFO: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800',
};

const statusLabel = {
  HEALTHY: 'Saudável',
  WARNING: 'Atenção',
  CRITICAL: 'Crítico',
  DISCONNECTED: 'Desconectado',
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  UNKNOWN: 'Não configurado',
  VALID: 'Válido',
  EXPIRED: 'Expirado',
  PENDING: 'Pendente',
  ERROR: 'Erro',
  RECEIVED: 'Recebido',
  PROCESSED: 'Processado',
  ACKNOWLEDGED: 'ACK enviado',
  FAILED: 'Falhou',
};

function formatDateTime(value) {
  if (!value) return 'Sem registro';
  return new Date(value).toLocaleString();
}

function formatMinutes(value) {
  if (value === null || value === undefined) return 'sem sinal';
  if (value === 0) return 'agora';
  return `${value} min`;
}

function statusTone(value) {
  if (['HEALTHY', 'ONLINE', 'VALID', 'PROCESSED', 'ACKNOWLEDGED'].includes(value)) return 'HEALTHY';
  if (['WARNING', 'PENDING', 'RECEIVED'].includes(value)) return 'WARNING';
  if (['CRITICAL', 'OFFLINE', 'EXPIRED', 'ERROR', 'FAILED'].includes(value)) return 'CRITICAL';
  return 'UNKNOWN';
}

function StatusBadge({ value, tone = value }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${healthStyle[statusTone(tone)] || healthStyle.UNKNOWN}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel[value] || value || 'Não configurado'}
    </span>
  );
}

function HealthCard({
  title,
  value,
  detail,
  tone = 'UNKNOWN',
  icon: Icon = Activity,
  loading = false,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </p>
          {loading ? (
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="mt-2 break-words text-xl font-black text-slate-950 dark:text-slate-50">
              {value}
            </p>
          )}
          {detail && (
            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{detail}</p>
          )}
          <div className="mt-3">
            <StatusBadge value={tone || 'UNKNOWN'} />
          </div>
        </div>
        <div
          className={`rounded-lg border p-2 ${healthStyle[statusTone(tone)] || healthStyle.UNKNOWN}`}
        >
          <Icon size={20} className="shrink-0" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Database, title, description, action }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/60">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200">
        <Icon size={22} />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-50">{title}</h3>
      <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, right }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon size={20} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">{title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const { showSuccess, showError } = useToast();

  const [credentials, setCredentials] = useState([]);
  const [events, setEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [queue, setQueue] = useState({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [queueFilters, setQueueFilters] = useState({
    status: '',
    q: '',
    failedOnly: false,
    pendingOnly: false,
  });
  const [selectedPayload, setSelectedPayload] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Catalog State
  const [catalogPreview, setCatalogPreview] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Merchant State
  const [merchantStatus, setMerchantStatus] = useState(null);

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
    }
  }, [hasPermission]);

  async function loadData() {
    setIsLoading(true);
    setLoadError('');
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = {
        Authorization: `Bearer ${tokenData.token}`,
        'Content-Type': 'application/json',
      };

      const [credRes, evRes] = await Promise.all([
        fetch(`${API_BASE_URL}/integrations/credentials`, { headers }),
        fetch(`${API_BASE_URL}/integrations/events`, { headers }),
      ]);

      if (credRes.ok) {
        const credData = await credRes.json();
        setCredentials(Array.isArray(credData) ? credData : []);
      }

      if (evRes.ok) {
        const evData = await evRes.json();
        setEvents(Array.isArray(evData) ? evData : []);
      }

      await Promise.all([loadHealth(headers), loadIfoodQueue(headers)]);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setLoadError('Não foi possível carregar os dados da integração iFood. Tente novamente.');
      showError('Erro ao carregar dados do servidor.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadHealth(existingHeaders = null) {
    const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
    const headers = existingHeaders || {
      Authorization: `Bearer ${tokenData.token}`,
      'Content-Type': 'application/json',
    };
    const res = await fetch(`${API_BASE_URL}/integrations/ifood/health`, { headers });
    if (res.ok) {
      setHealth(await res.json());
    }
  }

  async function loadIfoodQueue(existingHeaders = null, nextPage = queue.page) {
    const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
    const headers = existingHeaders || {
      Authorization: `Bearer ${tokenData.token}`,
      'Content-Type': 'application/json',
    };
    const params = new URLSearchParams({
      page: String(nextPage || 1),
      pageSize: String(queue.pageSize || 20),
    });
    if (queueFilters.status) params.set('status', queueFilters.status);
    if (queueFilters.q) params.set('q', queueFilters.q);
    if (queueFilters.failedOnly) params.set('failedOnly', 'true');
    if (queueFilters.pendingOnly) params.set('pendingOnly', 'true');

    const res = await fetch(`${API_BASE_URL}/integrations/ifood/events?${params.toString()}`, {
      headers,
    });
    if (res.ok) {
      setQueue(await res.json());
    }
  }

  // --- Handlers ---
  async function handlePollNow(credentialId = null) {
    setIsPolling(true);
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const headers = {
        Authorization: `Bearer ${tokenData.token}`,
        'Content-Type': 'application/json',
      };
      const body = credentialId ? JSON.stringify({ credentialId }) : JSON.stringify({});
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/poll-now`, {
        method: 'POST',
        headers,
        body,
      });
      if (res.ok) {
        showSuccess('Sincronização iniciada com sucesso!');
        loadData();
      } else {
        showError('Falha na sincronização manual.');
      }
    } catch {
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
      const headers = {
        Authorization: `Bearer ${tokenData.token}`,
        'Content-Type': 'application/json',
      };
      const payload = { ...formData };
      const url = editingCred
        ? `${API_BASE_URL}/integrations/credentials/${editingCred.id}`
        : `${API_BASE_URL}/integrations/credentials`;
      const method = editingCred ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        showSuccess('Credencial salva!');
        setIsModalOpen(false);
        loadData();
      } else {
        showError('Erro ao salvar credencial.');
      }
    } catch {
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
        headers: { Authorization: `Bearer ${tokenData.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCatalogPreview(data);
        showSuccess('Preview do cardápio gerado com sucesso!');
      } else {
        showError('Erro ao gerar preview do cardápio.');
      }
    } catch {
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
    if (
      !window.confirm(
        'ATENÇÃO: Entendo que esta sincronização pode sobrescrever o catálogo atual do iFood. Deseja prosseguir?',
      )
    ) {
      return;
    }
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(`${API_BASE_URL}/integrations/ifood/catalog/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      if (res.ok) {
        showSuccess('Cardápio sincronizado com sucesso!');
        loadData();
      } else {
        showError('Falha ao sincronizar cardápio.');
      }
    } catch {
      showError('Erro de rede.');
    }
  }

  async function loadMerchantStatus(credentialId) {
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(
        `${API_BASE_URL}/integrations/ifood/merchant/status?credentialId=${credentialId}`,
        {
          headers: { Authorization: `Bearer ${tokenData.token}` },
        },
      );
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
        body: JSON.stringify({ credentialId, reason }),
      });
      if (res.ok) {
        showSuccess('Loja pausada no iFood.');
        loadMerchantStatus(credentialId);
      } else {
        showError('Erro ao pausar loja.');
      }
    } catch {
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
        body: JSON.stringify({ credentialId }),
      });
      if (res.ok) {
        showSuccess('Loja retomada no iFood.');
        loadMerchantStatus(credentialId);
      } else {
        showError('Erro ao retomar loja.');
      }
    } catch {
      showError('Erro de rede.');
    }
  }

  async function handleReprocessEvent(eventId, force = false) {
    try {
      const tokenData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
      const res = await fetch(
        `${API_BASE_URL}/integrations/ifood/events/${encodeURIComponent(eventId)}/reprocess`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ force }),
        },
      );

      if (res.status === 409 && !force) {
        if (window.confirm('Evento ja processado. Deseja forcar o reprocessamento idempotente?')) {
          await handleReprocessEvent(eventId, true);
        }
        return;
      }

      if (res.ok) {
        showSuccess('Evento enviado para reprocessamento.');
        await Promise.all([loadHealth(), loadIfoodQueue(null, queue.page)]);
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.message || 'Falha ao reprocessar evento.');
      }
    } catch {
      showError('Erro de comunicacao ao reprocessar evento.');
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

  const ifoodCred = credentials.find((c) => c.provider === 'IFOOD' && c.isActive);
  const hasActiveCredential = Boolean(ifoodCred);
  const canRunIfoodAction = hasActiveCredential && health?.tokenStatus !== 'EXPIRED';
  const tabs = [
    { id: 'OVERVIEW', label: 'Visão Geral', icon: BarChart3 },
    { id: 'QUEUE', label: 'Fila iFood', icon: Clock },
    { id: 'ORDERS', label: 'Pedidos', icon: ShoppingBag },
    { id: 'CATALOG', label: 'Cardápio', icon: BookOpen },
    { id: 'SYNC', label: 'Sync', icon: Send },
    { id: 'STATUS', label: 'Loja', icon: Store },
    { id: 'LOGS', label: 'Erros & Auditoria', icon: Database },
    { id: 'HOMOLOGATION', label: 'Homologação', icon: ClipboardCheck },
    { id: 'CREDENTIALS', label: 'Credenciais', icon: Key },
    { id: 'WEBHOOK', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
                <Globe size={24} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50">
                    Integração iFood
                  </h1>
                  <StatusBadge
                    value={health?.status || (isLoading ? 'PENDING' : 'UNKNOWN')}
                    tone={health?.status || 'UNKNOWN'}
                  />
                </div>
                <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                  Monitore pedidos, eventos, catálogo, presença e saúde da integração.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    Merchant: {health?.merchantId || ifoodCred?.merchantId || 'não configurado'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    Último evento: {formatMinutes(health?.minutesSinceLastEvent)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    Eventos hoje: {health?.eventsReceivedToday ?? 0}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <button
                type="button"
                disabled={!hasActiveCredential}
                onClick={() => hasActiveCredential && loadHealth()}
                title={
                  !hasActiveCredential
                    ? 'Conecte uma credencial iFood para testar a conexão.'
                    : 'Atualizar saúde da integração'
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <Wifi size={16} /> Testar conexão
              </button>
              <button
                type="button"
                disabled={!canRunIfoodAction || isPolling}
                onClick={() => handlePollNow(ifoodCred?.id)}
                title={
                  !canRunIfoodAction
                    ? 'Credencial ativa e token válido são necessários.'
                    : 'Executar polling agora'
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={16} className={isPolling ? 'animate-spin' : ''} /> Polling agora
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('QUEUE')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <Clock size={16} /> Ver fila
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HOMOLOGATION')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <ClipboardCheck size={16} /> Homologação
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <HealthCard
            loading={isLoading}
            title="Status Geral"
            value={statusLabel[health?.status] || 'Não configurado'}
            detail={health?.blockingIssues?.[0] || health?.warnings?.[0] || 'Operação monitorada'}
            tone={health?.status}
            icon={Activity}
          />
          <HealthCard
            loading={isLoading}
            title="Presença iFood"
            value={statusLabel[health?.storePresence] || 'Não configurado'}
            detail={`Último sinal: ${formatMinutes(health?.minutesSinceLastEvent)}`}
            tone={health?.storePresence}
            icon={Radio}
          />
          <HealthCard
            loading={isLoading}
            title="Token"
            value={statusLabel[health?.tokenStatus] || 'Pendente'}
            detail={
              health?.merchantId
                ? `Merchant: ${health.merchantId}`
                : 'Configurar ou testar credencial'
            }
            tone={health?.tokenStatus}
            icon={Lock}
          />
          <HealthCard
            loading={isLoading}
            title="Último Polling"
            value={formatMinutes(health?.minutesSinceLastPolling)}
            detail={formatDateTime(health?.lastPollingAt)}
            tone={health?.lastPollingAt ? 'HEALTHY' : 'UNKNOWN'}
            icon={RefreshCw}
          />
          <HealthCard
            loading={isLoading}
            title="Último Webhook"
            value={formatMinutes(health?.minutesSinceLastWebhook)}
            detail={formatDateTime(health?.lastWebhookAt)}
            tone={health?.lastWebhookAt ? 'HEALTHY' : 'UNKNOWN'}
            icon={Zap}
          />
          <HealthCard
            loading={isLoading}
            title="Pedidos Hoje"
            value={String(health?.ordersImportedToday ?? 0)}
            detail={`${health?.eventsReceivedToday ?? 0} eventos recebidos hoje`}
            tone={(health?.ordersImportedToday ?? 0) > 0 ? 'HEALTHY' : 'INFO'}
            icon={ShoppingBag}
          />
          <HealthCard
            loading={isLoading}
            title="Erros 24h"
            value={String(health?.errors24h ?? 0)}
            detail={health?.failedEvents24h ? 'Ação necessária na fila' : 'Nenhum erro recente'}
            tone={(health?.errors24h ?? 0) > 0 ? 'CRITICAL' : 'HEALTHY'}
            icon={AlertTriangle}
          />
          <HealthCard
            loading={isLoading}
            title="Última Sync Catálogo"
            value={formatDateTime(health?.lastCatalogSyncAt)}
            detail="Preview obrigatório antes de sincronizar"
            tone={health?.lastCatalogSyncAt ? 'HEALTHY' : 'UNKNOWN'}
            icon={BookOpen}
          />
        </div>

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </div>
        )}

        <div className="-mx-5 overflow-x-auto border-t border-slate-200 px-5 dark:border-slate-800">
          <div className="flex min-w-max gap-2 py-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    activeTab === tab.id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <SectionHeader
              icon={Activity}
              title="Resumo operacional"
              description="Leitura rápida da integração para saber se a loja pode operar com segurança."
              right={
                <button
                  onClick={loadData}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCw size={16} /> Atualizar
                </button>
              }
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                [
                  'Credencial ativa',
                  hasActiveCredential ? 'Configurada' : 'Pendente',
                  hasActiveCredential ? 'HEALTHY' : 'WARNING',
                ],
                [
                  'Token iFood',
                  statusLabel[health?.tokenStatus] || 'Pendente',
                  health?.tokenStatus || 'PENDING',
                ],
                [
                  'Presence',
                  statusLabel[health?.storePresence] || 'Não configurado',
                  health?.storePresence || 'UNKNOWN',
                ],
                [
                  'Eventos com falha',
                  `${health?.failedEvents24h ?? 0} nas últimas 24h`,
                  (health?.failedEvents24h ?? 0) > 0 ? 'CRITICAL' : 'HEALTHY',
                ],
              ].map(([label, value, tone]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">
                      {value}
                    </p>
                  </div>
                  <StatusBadge value={tone} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <SectionHeader
              icon={ShieldCheck}
              title="Próximas ações"
              description="Prioridade operacional para estabilizar a integração."
            />
            <div className="space-y-3">
              {[
                {
                  text: hasActiveCredential
                    ? 'Executar polling de conferência.'
                    : 'Cadastrar uma credencial iFood ativa.',
                  action: hasActiveCredential
                    ? () => handlePollNow(ifoodCred?.id)
                    : () => setActiveTab('CREDENTIALS'),
                },
                {
                  text: 'Validar a fila de eventos e falhas.',
                  action: () => setActiveTab('QUEUE'),
                },
                {
                  text: 'Conferir checklist de homologação.',
                  action: () => setActiveTab('HOMOLOGATION'),
                },
              ].map((item) => (
                <button
                  key={item.text}
                  onClick={item.action}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {item.text}
                  <Eye size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CREDENTIALS' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Key}
            title="Credenciais"
            description="Gerencie credenciais sem expor secret, token ou refresh token."
            right={
              adminRole !== 'INTEGRATION_MANAGER' && (
                <button
                  onClick={() => {
                    setEditingCred(null);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  <PlusCircle size={18} /> Nova credencial
                </button>
              )
            }
          />
          <div className="flex justify-between items-center">
            {adminRole !== 'INTEGRATION_MANAGER' && null}
          </div>
          {credentials.length === 0 ? (
            <EmptyState
              icon={Key}
              title="Conecte sua conta iFood para começar"
              description="Sem credencial ativa, a central mostra saúde pendente e bloqueia ações que dependem de token."
              action={
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  <PlusCircle size={16} /> Configurar credencial
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${cred.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}
                      >
                        {cred.provider === 'IFOOD' ? <Globe size={20} /> : <Layers size={20} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-50">
                          {cred.provider}
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Merchant: {cred.merchantId || 'não informado'}
                        </span>
                      </div>
                    </div>
                    <StatusBadge value={cred.isActive ? 'HEALTHY' : 'UNKNOWN'} />
                  </div>
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 mb-4">
                    <p>
                      <span className="font-bold">Client ID:</span>{' '}
                      {cred.clientId ? `${cred.clientId.slice(0, 6)}...` : 'não informado'}
                    </p>
                    <p>
                      <span className="font-bold">Secret:</span> ********
                    </p>
                    <p>
                      <span className="font-bold">Token:</span>{' '}
                      {cred.hasAccessToken ? 'gerado' : 'pendente'}
                    </p>
                    <p>
                      <span className="font-bold">Expira em:</span> {formatDateTime(cred.expiresAt)}
                    </p>
                  </div>
                  {adminRole !== 'INTEGRATION_MANAGER' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => loadHealth()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        <Wifi size={14} /> Testar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
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
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                      >
                        <Edit3 size={14} /> Editar
                      </button>
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
            <h3 className="font-bold flex items-center gap-2 mb-2">
              <Radio size={18} /> Polling Ativo
            </h3>
            <p className="text-sm">
              O sistema busca pedidos a cada 30 segundos automaticamente para todas as credenciais
              ativas. Ele funciona como redundância (fallback) do Webhook em Tempo Real.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => handlePollNow()} disabled={isPolling} className="btn-primary">
              {isPolling ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              {isPolling ? 'Sincronizando...' : 'Forçar Polling Agora'}
            </button>
            <span className="text-sm text-gray-500">
              Último disparo: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </Panel>
      )}

      {activeTab === 'WEBHOOK' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={Settings}
            title="Configurações da integração"
            description="URLs, fallback de polling e parâmetros operacionais para manter a presença iFood saudável."
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              <h3 className="font-black flex items-center gap-2 mb-2">
                <Zap size={18} /> Webhook em tempo real
              </h3>
              <p className="text-sm mb-4">
                Configure esta URL no portal do parceiro iFood para receber novos pedidos e
                atualizações sem depender apenas do polling.
              </p>
              <div className="bg-white p-3 rounded-lg border border-emerald-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900 dark:border-emerald-800">
                <code className="text-sm font-mono text-slate-800 break-all dark:text-slate-100">
                  https://{window.location.hostname}/api/public/webhooks/ifood
                </code>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `https://${window.location.hostname}/api/public/webhooks/ifood`,
                    )
                  }
                >
                  <Copy size={14} /> Copiar
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
              <h3 className="font-black flex items-center gap-2 mb-2">
                <Radio size={18} /> Polling de fallback
              </h3>
              <p className="text-sm mb-4">
                O polling mantém redundância operacional e ajuda a preservar a presença da loja
                quando eventos em tempo real atrasam.
              </p>
              <button
                onClick={() => handlePollNow(ifoodCred?.id)}
                disabled={!ifoodCred || isPolling}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={16} className={isPolling ? 'animate-spin' : ''} />
                {isPolling ? 'Sincronizando...' : 'Executar polling agora'}
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-slate-50">
                Garantias operacionais
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <ShieldCheck size={16} className="mt-0.5 text-emerald-600" /> Webhook e polling
                  usam idempotência para não duplicar pedido.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck size={16} className="mt-0.5 text-emerald-600" /> ACK só deve ocorrer
                  após processamento seguro.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck size={16} className="mt-0.5 text-emerald-600" /> Payload exibido na
                  interface é sanitizado.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-slate-50">Ambiente</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <p>
                  <b>Provider:</b> iFood
                </p>
                <p>
                  <b>Credencial ativa:</b> {ifoodCred ? 'sim' : 'não'}
                </p>
                <p>
                  <b>Token:</b> {statusLabel[health?.tokenStatus] || 'pendente'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'QUEUE' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={Clock}
            title="Fila iFood"
            description="Acompanhe eventos, pedidos, falhas e reprocessamentos com segurança."
            right={<StatusBadge value={`${queue.total} evento(s)`} tone="INFO" />}
          />
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                ['Todos', { status: '', failedOnly: false, pendingOnly: false }],
                ['Pendentes', { status: 'RECEIVED', failedOnly: false, pendingOnly: true }],
                ['Processados', { status: 'PROCESSED', failedOnly: false, pendingOnly: false }],
                ['Falharam', { status: 'FAILED', failedOnly: true, pendingOnly: false }],
                ['ACK enviado', { status: 'ACKNOWLEDGED', failedOnly: false, pendingOnly: false }],
              ].map(([label, patch]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setQueueFilters({ ...queueFilters, ...patch });
                    setTimeout(() => loadIfoodQueue(null, 1), 0);
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Buscar evento ou pedido
                </label>
                <input
                  className="input-field"
                  value={queueFilters.q}
                  onChange={(e) => setQueueFilters({ ...queueFilters, q: e.target.value })}
                  placeholder="eventId, externalOrderId, merchantId"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  className="input-field"
                  value={queueFilters.status}
                  onChange={(e) => setQueueFilters({ ...queueFilters, status: e.target.value })}
                >
                  <option value="">Todos</option>
                  <option value="RECEIVED">Recebido</option>
                  <option value="PROCESSED">Processado</option>
                  <option value="ACKNOWLEDGED">ACK enviado</option>
                  <option value="FAILED">Falha</option>
                </select>
              </div>
              <label className="flex items-end gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 pb-2">
                <input
                  type="checkbox"
                  checked={queueFilters.failedOnly}
                  onChange={(e) =>
                    setQueueFilters({
                      ...queueFilters,
                      failedOnly: e.target.checked,
                      pendingOnly: false,
                    })
                  }
                />
                Somente falhas
              </label>
              <div className="flex items-end">
                <button onClick={() => loadIfoodQueue(null, 1)} className="btn-secondary w-full">
                  <Search size={16} /> Filtrar
                </button>
              </div>
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase dark:bg-slate-800 dark:text-slate-300">
                    <th className="p-3 border-b">Data</th>
                    <th className="p-3 border-b">Tipo</th>
                    <th className="p-3 border-b">Pedido iFood</th>
                    <th className="p-3 border-b">Merchant</th>
                    <th className="p-3 border-b">Status</th>
                    <th className="p-3 border-b">Cliente/Total</th>
                    <th className="p-3 border-b">Último erro</th>
                    <th className="p-3 border-b text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 text-sm border-b align-top dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <td className="p-3 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-50">
                          {item.eventType || 'UNKNOWN'}
                        </div>
                        <div className="text-xs text-slate-500 break-all dark:text-slate-400">
                          {item.eventId}
                        </div>
                        <div className="text-xs text-slate-400">{item.source}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{item.externalOrderId || '-'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.orderStatus || 'Sem pedido local'}
                        </div>
                      </td>
                      <td className="p-3 break-all">{item.merchantId || '-'}</td>
                      <td className="p-3">
                        <StatusBadge value={item.status} />
                      </td>
                      <td className="p-3">
                        <div>{item.customerName || '-'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.total ? `R$ ${Number(item.total).toFixed(2)}` : '-'}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs">
                        <span className="line-clamp-2 text-xs text-red-700">
                          {item.lastError || '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setSelectedPayload(item)}
                          >
                            <Eye size={14} /> Detalhes
                          </button>
                          {item.lastError && (
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                              onClick={() => navigator.clipboard.writeText(item.lastError)}
                            >
                              <Copy size={14} /> Erro
                            </button>
                          )}
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                            onClick={() => handleReprocessEvent(item.eventId)}
                          >
                            Reprocessar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {queue.items.length === 0 && (
                    <tr>
                      <td colSpan="8" className="p-6">
                        <EmptyState
                          icon={Clock}
                          title="Nenhum evento recebido ainda"
                          description="Quando o polling ou webhook receberem eventos, eles aparecerão aqui com status, pedido e ação recomendada."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {queue.items.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="Nenhum evento recebido ainda"
                  description="A fila iFood está vazia para os filtros atuais."
                />
              ) : (
                queue.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-50">
                          {item.eventType || 'UNKNOWN'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Pedido: <b>{item.externalOrderId || '-'}</b>
                      </span>
                      <span>
                        Total: <b>{item.total ? `R$ ${Number(item.total).toFixed(2)}` : '-'}</b>
                      </span>
                      <span className="col-span-2 break-all">EventId: {item.eventId}</span>
                    </div>
                    {item.lastError && (
                      <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
                        {item.lastError}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-100"
                        onClick={() => setSelectedPayload(item)}
                      >
                        <Eye size={14} /> Detalhes
                      </button>
                      <button
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 px-2 py-2 text-xs font-bold text-white"
                        onClick={() => handleReprocessEvent(item.eventId)}
                      >
                        Reprocessar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span>
                {queue.total} evento(s) - pagina {queue.page} de {queue.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={queue.page <= 1}
                  className="btn-secondary text-xs disabled:opacity-50"
                  onClick={() => loadIfoodQueue(null, queue.page - 1)}
                >
                  Anterior
                </button>
                <button
                  disabled={queue.page >= queue.totalPages}
                  className="btn-secondary text-xs disabled:opacity-50"
                  onClick={() => loadIfoodQueue(null, queue.page + 1)}
                >
                  Proxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ORDERS' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={ShoppingBag}
            title="Pedidos iFood"
            description="Pedidos importados entram no fluxo normal do sistema com origem identificada."
            right={
              <StatusBadge
                value={`${health?.ordersImportedToday ?? 0} hoje`}
                tone={(health?.ordersImportedToday ?? 0) > 0 ? 'HEALTHY' : 'INFO'}
              />
            }
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              ['Novos', 0, 'INFO'],
              ['Em preparo', 0, 'WARNING'],
              ['Prontos/Despacho', 0, 'HEALTHY'],
              [
                'Falha de importação',
                health?.failedEvents24h ?? 0,
                (health?.failedEvents24h ?? 0) > 0 ? 'CRITICAL' : 'HEALTHY',
              ],
            ].map(([label, value, tone]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-50">
                  {value}
                </p>
                <div className="mt-3">
                  <StatusBadge value={tone} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <EmptyState
              icon={ShoppingBag}
              title="Nenhum pedido iFood listado nesta visão"
              description="Quando pedidos forem importados, mostre cliente, total, status local, status iFood, tempo parado e ações rápidas. Por enquanto a fila de eventos é a fonte operacional."
              action={
                <button
                  onClick={() => setActiveTab('QUEUE')}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  <Clock size={16} /> Abrir fila iFood
                </button>
              }
            />
          </div>
        </div>
      )}

      {activeTab === 'CATALOG' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={BookOpen}
            title="Cardápio e mapeamento"
            description="Prepare o vínculo entre produtos locais e itens iFood antes de qualquer sincronização."
          />
          {!ifoodCred ? (
            <EmptyState
              icon={Link2}
              title="Mapeamento depende de credencial"
              description="Conecte sua conta iFood para preparar categorias, produtos, adicionais e disponibilidade por canal."
              action={
                <button
                  onClick={() => setActiveTab('CREDENTIALS')}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  <Key size={16} /> Configurar credencial
                </button>
              }
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                {[
                  ['Produtos mapeados', 0, 'UNKNOWN'],
                  ['Pendentes', catalogPreview?.totalValidItems ?? 0, 'WARNING'],
                  ['Divergentes', 0, 'INFO'],
                  ['Sem imagem', 0, 'UNKNOWN'],
                  [
                    'Com erro',
                    catalogPreview?.totalInvalidItems ?? 0,
                    (catalogPreview?.totalInvalidItems ?? 0) > 0 ? 'CRITICAL' : 'HEALTHY',
                  ],
                ].map(([label, value, tone]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-black text-slate-950 dark:text-slate-50">
                      {value}
                    </p>
                    <div className="mt-2">
                      <StatusBadge value={tone} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handlePreviewCatalog}
                  disabled={isPreviewing}
                  className="btn-secondary"
                >
                  {isPreviewing ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Play size={18} />
                  )}{' '}
                  Preview (Homologação)
                </button>
                <button
                  onClick={() => setActiveTab('SYNC')}
                  className="btn-primary bg-orange-600 hover:bg-orange-700"
                >
                  <Send size={18} /> Abrir sincronização seletiva
                </button>
              </div>

              {catalogPreview && (
                <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 gap-3 bg-slate-50 p-4 border-b border-slate-200 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div>
                      <span className="block text-xs text-slate-500 uppercase">Categorias</span>
                      <span className="font-bold text-lg">{catalogPreview.totalCategories}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-emerald-600 uppercase">
                        Itens válidos
                      </span>
                      <span className="font-bold text-lg text-emerald-700">
                        {catalogPreview.totalValidItems}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-red-500 uppercase">Itens com erro</span>
                      <span className="font-bold text-lg text-red-600">
                        {catalogPreview.totalInvalidItems}
                      </span>
                    </div>
                  </div>
                  {catalogPreview.invalidItems.length > 0 && (
                    <div className="p-4 bg-red-50">
                      <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                        <AlertTriangle size={16} /> Produtos Ignorados
                      </h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {catalogPreview.invalidItems.map((inv, idx) => (
                          <li key={idx}>
                            - {inv.name}: {inv.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'SYNC' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={Send}
            title="Preview e sync seletivo"
            description="Sincronize com confirmação explícita. Catálogo completo exige cuidado para não sobrescrever estrutura."
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ['Sincronizar preços', 'Altera somente valores já mapeados.', 'INFO'],
              ['Sincronizar disponibilidade', 'Atualiza produtos ativos/pausados.', 'INFO'],
              ['Sincronizar fotos', 'Valida itens sem imagem antes do envio.', 'UNKNOWN'],
              ['Sincronizar categorias', 'Pode reorganizar grupos do iFood.', 'WARNING'],
              ['Produtos selecionados', 'Mais seguro para ajustes pontuais.', 'HEALTHY'],
              ['Catálogo completo', 'Ação crítica: exige preview e confirmação.', 'CRITICAL'],
            ].map(([title, description, tone]) => (
              <div
                key={title}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-slate-50">{title}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
                  </div>
                  <StatusBadge value={tone} />
                </div>
                <button
                  disabled={!ifoodCred}
                  onClick={
                    title === 'Catálogo completo'
                      ? () => handleSyncCatalog(ifoodCred?.id)
                      : handlePreviewCatalog
                  }
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <Play size={16} /> Gerar preview
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'STATUS' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={Store}
            title="Controle operacional da loja"
            description="Compare status local, presença e status iFood antes de pausar ou reabrir a loja."
          />
          {!ifoodCred ? (
            <EmptyState
              icon={Store}
              title="Status iFood indisponível"
              description="Configure uma credencial ativa para consultar status, pausar loja e reabrir operação no iFood."
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase text-slate-500">Status local</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-50">
                    Operação local ativa
                  </p>
                  <div className="mt-3">
                    <StatusBadge value="HEALTHY" />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase text-slate-500">Presença iFood</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-50">
                    {statusLabel[health?.storePresence] || 'Não configurado'}
                  </p>
                  <div className="mt-3">
                    <StatusBadge value={health?.storePresence || 'UNKNOWN'} />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase text-slate-500">Status iFood</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-50">
                    {merchantStatus?.status === 'AVAILABLE'
                      ? 'Aberta'
                      : merchantStatus
                        ? 'Fechada'
                        : 'Não consultado'}
                  </p>
                  <div className="mt-3">
                    <StatusBadge
                      value={
                        merchantStatus?.status === 'AVAILABLE'
                          ? 'ONLINE'
                          : merchantStatus
                            ? 'OFFLINE'
                            : 'UNKNOWN'
                      }
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => loadMerchantStatus(ifoodCred.id)}
                className="btn-secondary text-sm"
              >
                Atualizar status da loja
              </button>

              {merchantStatus && (
                <div className="bg-white p-6 border rounded-lg shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase">Status no iFood</h3>
                    <span
                      className={`text-2xl font-black ${merchantStatus.status === 'AVAILABLE' ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {merchantStatus.status === 'AVAILABLE' ? 'ABERTA' : 'FECHADA'}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Última checagem: {new Date(merchantStatus.lastUpdate).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {merchantStatus.status === 'AVAILABLE' ? (
                      <button
                        onClick={() => handleMerchantPause(ifoodCred.id)}
                        className="btn-secondary bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                      >
                        Pausar Loja
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMerchantResume(ifoodCred.id)}
                        className="btn-primary"
                      >
                        Retomar Loja
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={Database}
            title="Erros & Auditoria"
            description="Diagnóstico sanitizado para investigar eventos sem expor credenciais ou dados sensíveis."
          />
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              [
                'Erros hoje',
                health?.errors24h ?? 0,
                (health?.errors24h ?? 0) > 0 ? 'CRITICAL' : 'HEALTHY',
              ],
              [
                'Eventos com falha',
                health?.failedEvents24h ?? 0,
                (health?.failedEvents24h ?? 0) > 0 ? 'CRITICAL' : 'HEALTHY',
              ],
              ['Eventos hoje', health?.eventsReceivedToday ?? 0, 'INFO'],
              [
                'Último ACK',
                health?.lastAckAt ? 'Registrado' : 'Sem registro',
                health?.lastAckAt ? 'HEALTHY' : 'UNKNOWN',
              ],
            ].map(([label, value, tone]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-black text-slate-950 dark:text-slate-50">{value}</p>
                <div className="mt-2">
                  <StatusBadge value={tone} />
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase dark:bg-slate-800 dark:text-slate-300">
                  <th className="p-3 border-b">Data</th>
                  <th className="p-3 border-b">Provider</th>
                  <th className="p-3 border-b">Evento</th>
                  <th className="p-3 border-b">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50 text-sm border-b">
                    <td className="p-3">{new Date(ev.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-medium">{ev.provider}</td>
                    <td className="p-3">{ev.eventType || 'N/A'}</td>
                    <td className="p-3">
                      <StatusBadge value={ev.status} />
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-4">
                      <EmptyState
                        icon={Database}
                        title="Nenhum log registrado"
                        description="Quando a integração receber eventos, os registros de auditoria aparecerão aqui."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'HOMOLOGATION' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionHeader
            icon={ClipboardCheck}
            title="Homologação guiada"
            description="Checklist para deixar claro o que falta antes de operar iFood em produção."
          />
          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  Progresso estimado
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Baseado em credencial, token, polling, webhook, ACK e ausência de erros recentes.
                </p>
              </div>
              <span className="text-2xl font-black text-slate-950 dark:text-slate-50">
                {hasActiveCredential ? '35%' : '10%'}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-red-600"
                style={{ width: hasActiveCredential ? '35%' : '10%' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              [
                'Credencial configurada',
                hasActiveCredential ? 'HEALTHY' : 'WARNING',
                'Configure provider, merchantId, clientId e secret mascarado.',
              ],
              [
                'Token válido',
                health?.tokenStatus === 'VALID' ? 'HEALTHY' : 'WARNING',
                'Teste ou renove o token antes de operar.',
              ],
              [
                'Presence OK',
                health?.storePresence === 'ONLINE' ? 'HEALTHY' : 'WARNING',
                'Polling ou webhook precisa sinalizar presença recente.',
              ],
              [
                'Polling OK',
                health?.lastPollingAt ? 'HEALTHY' : 'WARNING',
                'Execute polling manual para validar a fila.',
              ],
              [
                'Webhook OK',
                health?.lastWebhookAt ? 'HEALTHY' : 'WARNING',
                'Configure a URL pública no portal iFood.',
              ],
              [
                'ACK funcionando',
                health?.lastAckAt ? 'HEALTHY' : 'WARNING',
                'ACK deve ocorrer somente depois de processar com segurança.',
              ],
              [
                'Evento duplicado tratado',
                'HEALTHY',
                'Reprocessamento usa eventId/externalOrderId para idempotência.',
              ],
              ['Logs sem secrets', 'HEALTHY', 'Payload exibido na UI é sanitizado.'],
            ].map(([title, tone, description]) => (
              <div
                key={title}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-slate-50">{title}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
                  </div>
                  <StatusBadge value={tone} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPayload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden dark:bg-slate-900">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-slate-50">
                  Dados técnicos do evento
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedPayload.eventId}
                </p>
              </div>
              <button
                aria-label="Fechar detalhes do evento"
                onClick={() => setSelectedPayload(null)}
                className="text-slate-400 hover:text-red-500"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase text-slate-500">Status</p>
                  <div className="mt-2">
                    <StatusBadge value={selectedPayload.status} />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase text-slate-500">Pedido externo</p>
                  <p className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-50">
                    {selectedPayload.externalOrderId || '-'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase text-slate-500">Origem</p>
                  <p className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-50">
                    {selectedPayload.source || 'UNKNOWN'}
                  </p>
                </div>
              </div>
              {selectedPayload.lastError && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-800">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">Erro sanitizado</span>
                    <button
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      onClick={() => navigator.clipboard.writeText(selectedPayload.lastError)}
                    >
                      <Copy size={14} /> Copiar
                    </button>
                  </div>
                  <p className="mt-1 break-words">{selectedPayload.lastError}</p>
                </div>
              )}
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Dados sanitizados do evento
              </p>
              <pre className="bg-gray-950 text-gray-50 text-xs rounded-lg p-4 overflow-auto">
                {JSON.stringify(selectedPayload.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova/Editar Credencial */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-800">
                {editingCred ? 'Editar Credencial' : 'Nova Credencial'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-red-500"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCredential} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  className="input-field"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                >
                  <option value="IFOOD">iFood</option>
                  <option value="99FOOD">99Food</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Merchant ID (ID da Loja)
                </label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={formData.merchantId}
                  onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                  placeholder="Ex: e89a-4c2f-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  required={!editingCred}
                  type="password"
                  className="input-field"
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                  placeholder={editingCred ? '******** (Deixe vazio para manter)' : ''}
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Ativa para sincronização
                </label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
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
