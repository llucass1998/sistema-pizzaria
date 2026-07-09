import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  LogOut,
  User,
  Edit2,
  Save,
  X,
  Package,
  ChevronRight,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '../data/menuData.js';
import { LoyaltyWidget } from '../components/LoyaltyWidget.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const ORDER_STATUS_LABELS = {
  PENDING: 'Pendente',
  PREPARING: 'Preparando',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Em entrega',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};

const ORDER_STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PREPARING: 'bg-blue-100 text-blue-800',
  READY: 'bg-indigo-100 text-indigo-800',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-red-100 text-red-800',
};

const FULFILLMENT_LABELS = {
  DELIVERY: 'Entrega',
  PICKUP: 'Retirada',
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function countItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
}

function safeText(value, fallback = 'Não informado') {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

export default function AccountPage({ apiBaseUrl, isLoggedIn, onLoginClick, onLogout, customer }) {
  const resolvedApiUrl = apiBaseUrl ?? API_BASE_URL;

  // Dados do perfil
  const [profile, setProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Edição de perfil
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    cpf: '',
    street: '',
    neighborhood: '',
    city: '',
    cep: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Histórico de pedidos
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const authHeaders = useCallback(() => {
    const token = customer?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [customer?.token]);

  const fetchProfile = useCallback(async () => {
    if (!customer?.token) return;
    setIsLoadingProfile(true);
    setProfileError('');
    try {
      const res = await fetch(`${resolvedApiUrl}/account/me`, { headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
        throw new Error('Não foi possível carregar seus dados.');
      }
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Erro ao carregar perfil.');
    } finally {
      setIsLoadingProfile(false);
    }
  }, [customer?.token, resolvedApiUrl, authHeaders]);

  const fetchOrders = useCallback(
    async (page = 1, status = '') => {
      if (!customer?.token) return;
      setIsLoadingOrders(true);
      setOrdersError('');
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: '5' });
        if (status) qs.set('status', status);
        const res = await fetch(`${resolvedApiUrl}/account/orders?${qs}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Não foi possível carregar seus pedidos.');
        const data = await res.json();
        setOrders(data.orders ?? []);
        setOrdersTotalPages(data.totalPages ?? 1);
        setOrdersTotal(data.total ?? 0);
        setOrdersPage(page);
      } catch (err) {
        setOrdersError(err instanceof Error ? err.message : 'Erro ao carregar pedidos.');
      } finally {
        setIsLoadingOrders(false);
      }
    },
    [customer?.token, resolvedApiUrl, authHeaders],
  );

  useEffect(() => {
    if (isLoggedIn && customer?.token) {
      fetchProfile();
      fetchOrders(1, statusFilter);
    }
  }, [isLoggedIn, customer?.token]);

  function startEditing() {
    const p = profile ?? customer;
    setEditForm({
      name: safeText(p?.name, ''),
      phone: safeText(p?.phone, ''),
      cpf: safeText(p?.cpf, ''),
      street: safeText(p?.street, ''),
      neighborhood: safeText(p?.neighborhood, ''),
      city: safeText(p?.city, ''),
      cep: safeText(p?.cep, ''),
    });
    setSaveError('');
    setIsEditing(true);
  }

  async function saveProfile() {
    if (!editForm.name?.trim()) {
      setSaveError('Nome é obrigatório.');
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${resolvedApiUrl}/account/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao salvar dados.');
      setProfile(data);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar dados.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleStatusFilter(s) {
    setStatusFilter(s);
    fetchOrders(1, s);
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <a
          href="#/"
          className="back-to-menu-button mb-6 inline-flex max-w-full items-center justify-center gap-2 rounded-lg bg-orange-50 px-4 py-2 font-bold text-orange-700 transition hover:bg-orange-100"
        >
          <ArrowLeft size={18} /> Voltar ao início
        </a>
        <section className="rounded-xl border-2 border-orange-200 bg-white dark:bg-slate-900 p-5 text-center shadow-sm sm:p-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white">
            <User size={36} />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            Minha Conta
          </h1>
          <p className="mb-6 text-slate-600 dark:text-slate-400">
            Entre para ver seus dados e seus pedidos.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              onClick={onLoginClick}
              className="rounded-xl bg-orange-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-orange-700 sm:px-8"
              type="button"
            >
              Fazer Login
            </button>
            <a
              href="#/rastreio"
              className="flex items-center justify-center rounded-xl border-2 border-orange-600 bg-white dark:bg-slate-900 px-6 py-3 font-bold text-orange-600 transition hover:bg-orange-50 sm:px-8"
            >
              Rastrear Pedido
            </a>
          </div>
        </section>
      </main>
    );
  }

  const displayProfile = profile ?? customer;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <a
        href="#/"
        className="back-to-menu-button mb-6 inline-flex max-w-full items-center justify-center gap-2 rounded-lg bg-orange-50 px-4 py-2 font-bold text-orange-700 transition hover:bg-orange-100"
      >
        <ArrowLeft size={18} /> Voltar ao início
      </a>

      {/* Cabeçalho do perfil */}
      <section className="mb-6 rounded-xl border-2 border-orange-200 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-8">
        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
          </div>
        ) : profileError ? (
          <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
            <AlertCircle size={20} />
            <p className="text-sm font-semibold">{profileError}</p>
            <button
              onClick={fetchProfile}
              className="ml-auto flex items-center gap-1 text-xs font-bold hover:underline"
            >
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white">
              <User size={40} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-3xl font-bold text-slate-900 dark:text-slate-100">
                {safeText(displayProfile?.name)}
              </h1>
              <p className="break-all text-slate-600 dark:text-slate-400">
                {safeText(displayProfile?.email)}
              </p>
            </div>
            <LoyaltyWidget loyaltyBalance={displayProfile?.loyaltyBalance ?? 0} mode="STAMPS" />
          </div>
        )}
      </section>

      {/* Dados Pessoais */}
      <section className="mb-6 rounded-xl border-2 border-orange-200 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-orange-600">Dados Pessoais</h2>
          {!isEditing && !isLoadingProfile && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-orange-600 hover:bg-orange-50 transition"
            >
              <Edit2 size={14} /> Editar
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {saveError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} />
                {saveError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { label: 'Nome', key: 'name', type: 'text' },
                { label: 'Telefone', key: 'phone', type: 'tel' },
                { label: 'CPF', key: 'cpf', type: 'text' },
                { label: 'Rua', key: 'street', type: 'text' },
                { label: 'Bairro', key: 'neighborhood', type: 'text' },
                { label: 'Cidade', key: 'city', type: 'text' },
                { label: 'CEP', key: 'cep', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
                  <input
                    type={type}
                    value={editForm[key] ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveProfile}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 transition"
              >
                <Save size={14} /> {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[
              { icon: User, label: 'Nome', value: safeText(displayProfile?.name) },
              { icon: Phone, label: 'Telefone', value: safeText(displayProfile?.phone) },
              { icon: Mail, label: 'Email', value: safeText(displayProfile?.email) },
              { icon: CreditCard, label: 'CPF', value: safeText(displayProfile?.cpf) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="break-all text-sm font-bold text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Endereço */}
      {!isEditing && (
        <section className="mb-6 rounded-xl border-2 border-orange-200 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-xl font-bold text-orange-600">Endereço</h2>
          {displayProfile?.street || displayProfile?.neighborhood ? (
            <div className="flex items-start gap-3 rounded-lg border border-orange-100 bg-orange-50 p-4">
              <MapPin size={18} className="mt-0.5 shrink-0 text-orange-600" />
              <div>
                {displayProfile?.street && (
                  <p className="font-semibold text-slate-900">{displayProfile.street}</p>
                )}
                {displayProfile?.neighborhood && (
                  <p className="text-slate-700">
                    {displayProfile.neighborhood}
                    {displayProfile?.city ? `, ${displayProfile.city}` : ''}
                  </p>
                )}
                {displayProfile?.cep && (
                  <p className="text-sm text-slate-500">CEP: {displayProfile.cep}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              Nenhum endereço salvo.{' '}
              <button onClick={startEditing} className="font-bold text-orange-600 hover:underline">
                Adicionar agora
              </button>
            </p>
          )}
        </section>
      )}

      {/* Meus Pedidos */}
      <section className="mb-6 rounded-xl border-2 border-orange-200 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-orange-600">
            Meus Pedidos
            {ordersTotal > 0 && (
              <span className="ml-2 text-sm font-semibold text-slate-500">
                ({ordersTotal} total)
              </span>
            )}
          </h2>
          <div className="flex flex-wrap gap-2">
            {['', 'PENDING', 'PREPARING', 'DELIVERED', 'CANCELED'].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${statusFilter === s ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-orange-100'}`}
              >
                {s === '' ? 'Todos' : (ORDER_STATUS_LABELS[s] ?? s)}
              </button>
            ))}
          </div>
        </div>

        {isLoadingOrders ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
          </div>
        ) : ordersError ? (
          <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
            <AlertCircle size={18} />
            <p className="text-sm">{ordersError}</p>
            <button
              onClick={() => fetchOrders(ordersPage, statusFilter)}
              className="ml-auto text-xs font-bold hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Package size={40} className="mb-3 opacity-50" />
            <p className="font-semibold">Você ainda não fez pedidos.</p>
            <a
              href="#/"
              className="mt-3 rounded-lg bg-orange-600 px-5 py-2 text-sm font-bold text-white hover:bg-orange-700 transition"
            >
              Ver cardápio
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;
              const statusColor =
                ORDER_STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-600';
              const itemCount = countItems(order.items);
              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 to-red-50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        #{String(order.id).slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <span className="text-xs text-slate-400">
                        {FULFILLMENT_LABELS[order.fulfillmentType] ?? order.fulfillmentType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(order.createdAt)} · {itemCount}{' '}
                      {itemCount === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <span className="text-base font-black text-orange-600">
                      {formatCurrency(Number(order.total))}
                    </span>
                    <a
                      href={`#/rastreio?id=${order.id}`}
                      className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:underline"
                    >
                      Ver pedido <ChevronRight size={12} />
                    </a>
                  </div>
                </div>
              );
            })}

            {/* Paginação */}
            {ordersTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  disabled={ordersPage <= 1 || isLoadingOrders}
                  onClick={() => fetchOrders(ordersPage - 1, statusFilter)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-slate-500">
                  {ordersPage} / {ordersTotalPages}
                </span>
                <button
                  disabled={ordersPage >= ordersTotalPages || isLoadingOrders}
                  onClick={() => fetchOrders(ordersPage + 1, statusFilter)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  Próximo →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <button
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 py-3 text-lg font-bold text-white transition hover:shadow-lg"
        type="button"
      >
        <LogOut size={20} />
        Sair da Conta
      </button>
    </main>
  );
}
