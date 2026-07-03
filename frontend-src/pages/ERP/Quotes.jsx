import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileClock,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { PageContainer } from '../../components/ui/PageContainer.jsx';
import { NewQuoteModal } from './NewQuoteModal.jsx';
import { BaseModal } from '../../components/ui/BaseModal.jsx';

const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const quoteStatusOptions = [
  {
    value: 'PENDING',
    label: 'PENDENTE',
    Icon: Clock,
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
  },
  {
    value: 'DRAFT',
    label: 'RASCUNHO',
    Icon: FileClock,
    className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
  },
  {
    value: 'SENT',
    label: 'ENVIADO',
    Icon: Send,
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300',
  },
  {
    value: 'APPROVED',
    label: 'APROVADO',
    Icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  {
    value: 'REJECTED',
    label: 'REJEITADO',
    Icon: XCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
  },
  {
    value: 'CANCELED',
    label: 'CANCELADO',
    Icon: XCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
  },
  {
    value: 'EXPIRED',
    label: 'EXPIRADO',
    Icon: AlertTriangle,
    className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300',
  },
  {
    value: 'CONVERTED',
    label: 'CONVERTIDO',
    Icon: CheckCircle2,
    className: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
];

function canonicalQuoteStatus(status) {
  return status === 'CANCELLED' ? 'CANCELED' : status || 'PENDING';
}

function getQuoteStatusConfig(status) {
  const normalizedStatus = canonicalQuoteStatus(status);
  return quoteStatusOptions.find((item) => item.value === normalizedStatus) ?? {
    value: normalizedStatus,
    label: normalizedStatus || 'SEM STATUS',
    Icon: AlertTriangle,
    className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
  };
}

function formatQuoteDate(value) {
  if (!value) return 'Nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nao informado';
  return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
  const amount = Number(value ?? 0);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function safeText(value, fallback = 'Nao informado') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getQuoteItems(quote) {
  if (!quote?.items) return [];
  if (Array.isArray(quote.items)) return quote.items;

  try {
    const parsed = JSON.parse(quote.items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getItemTotal(item) {
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.unitPrice ?? 0);
  const totalPrice = Number(item.totalPrice ?? quantity * unitPrice);
  return Number.isFinite(totalPrice) ? totalPrice : 0;
}

function getAdminToken() {
  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  return adminDataStr ? JSON.parse(adminDataStr).token : '';
}

function QuoteStatusSelect({ quote, updatingStatusId, onStatusChange, compact = false }) {
  const status = getQuoteStatusConfig(quote.status);
  const isUpdating = updatingStatusId === quote.id;

  return (
    <label className={`flex flex-col gap-1 ${compact ? 'w-full sm:w-40' : 'w-full sm:w-48'}`}>
      <span className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500">
        Status
      </span>
      <select
        aria-label={`Status do orcamento de ${safeText(quote.customerName, 'cliente')}`}
        value={canonicalQuoteStatus(quote.status)}
        onChange={(event) => onStatusChange(quote.id, event.target.value)}
        disabled={isUpdating}
        className={`h-10 w-full rounded-lg border px-3 text-center text-xs font-black uppercase outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-wait disabled:opacity-60 dark:focus:ring-orange-950 ${status.className}`}
      >
        {quoteStatusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ children, onClick, variant = 'neutral', disabled = false }) {
  const variants = {
    neutral:
      'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
    danger:
      'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/40',
    primary:
      'border-orange-600 bg-orange-600 text-white hover:bg-orange-700 dark:border-orange-500 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-700',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function QuoteDetailsModal({
  quote,
  onClose,
  updatingStatusId,
  onStatusChange,
  onEdit,
  onDelete,
  deletingQuoteId,
}) {
  if (!quote) return null;

  const items = getQuoteItems(quote);

  return (
    <BaseModal
      isOpen={Boolean(quote)}
      onClose={onClose}
      title="Detalhes do Orcamento"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        <section className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">
              Cliente
            </p>
            <h3 className="break-words text-xl font-black text-slate-900 dark:text-white">
              {safeText(quote.customerName)}
            </h3>
            <p className="mt-2 text-2xl font-black text-orange-600 dark:text-orange-400">
              {formatCurrency(quote.totalAmount)}
            </p>
          </div>

          <QuoteStatusSelect
            quote={quote}
            updatingStatusId={updatingStatusId}
            onStatusChange={onStatusChange}
          />
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">
              Data do evento
            </p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {formatQuoteDate(quote.eventDate)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">
              Validade
            </p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {formatQuoteDate(quote.validUntil)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">
              Email
            </p>
            <p className="break-words font-bold text-slate-800 dark:text-slate-200">
              {safeText(quote.customerEmail)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">
              Telefone
            </p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {safeText(quote.customerPhone)}
            </p>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="font-black text-slate-900 dark:text-white">Itens</h4>
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {items.length} item(ns)
            </span>
          </div>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Nenhum item informado.
              </p>
            ) : (
              items.map((item, index) => {
                const quantity = Number(item.quantity || 0);
                const unitPrice = Number(item.unitPrice || 0);
                return (
                  <div
                    key={`${item.name || 'item'}-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {safeText(item.name, `Item ${index + 1}`)}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {quantity || 0} x {formatCurrency(unitPrice)}
                      </p>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white">
                      {formatCurrency(getItemTotal(item))}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">
            Observacoes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {safeText(quote.notes, 'Sem observacoes')}
          </p>
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <ActionButton onClick={() => onEdit(quote)}>
            <Pencil size={16} />
            Editar
          </ActionButton>
          <ActionButton
            onClick={() => onDelete(quote)}
            variant="danger"
            disabled={deletingQuoteId === quote.id}
          >
            <Trash2 size={16} />
            Excluir
          </ActionButton>
          <ActionButton onClick={onClose}>
            Fechar
          </ActionButton>
        </footer>
      </div>
    </BaseModal>
  );
}

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [deletingQuoteId, setDeletingQuoteId] = useState(null);
  const [error, setError] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/quotes`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar orcamentos.');
      }

      const data = await response.json();
      setQuotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar orcamentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateQuoteInState(nextQuote) {
    if (!nextQuote?.id) return;

    setQuotes((currentQuotes) =>
      currentQuotes.map((quote) => (quote.id === nextQuote.id ? nextQuote : quote)),
    );
    setSelectedQuote((currentQuote) =>
      currentQuote?.id === nextQuote.id ? nextQuote : currentQuote,
    );
    setEditingQuote((currentQuote) =>
      currentQuote?.id === nextQuote.id ? nextQuote : currentQuote,
    );
  }

  async function handleStatusChange(id, newStatus) {
    const previousQuote = quotes.find((quote) => quote.id === id);
    if (!previousQuote || canonicalQuoteStatus(previousQuote.status) === newStatus) return;

    const optimisticQuote = { ...previousQuote, status: newStatus };

    try {
      setUpdatingStatusId(id);
      setError('');
      updateQuoteInState(optimisticQuote);

      const response = await fetch(`${API_BASE_URL}/quotes/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao atualizar status.');
      }

      updateQuoteInState(data);
    } catch (err) {
      updateQuoteInState(previousQuote);
      setError(err.message || 'Erro ao atualizar status.');
    } finally {
      setUpdatingStatusId(null);
    }
  }

  function handleCreateClick() {
    setEditingQuote(null);
    setIsFormModalOpen(true);
  }

  function handleEditClick(quote) {
    setSelectedQuote(null);
    setEditingQuote(quote);
    setIsFormModalOpen(true);
  }

  async function handleQuoteSaved(savedQuote) {
    if (savedQuote?.id) {
      const exists = quotes.some((quote) => quote.id === savedQuote.id);
      if (exists) {
        updateQuoteInState(savedQuote);
      } else {
        setQuotes((currentQuotes) => [savedQuote, ...currentQuotes]);
      }
    } else {
      await loadData();
    }
  }

  async function handleDeleteQuote(quote) {
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir este orcamento? Essa acao nao pode ser desfeita.',
    );

    if (!confirmed) return;

    try {
      setDeletingQuoteId(quote.id);
      setError('');
      const response = await fetch(`${API_BASE_URL}/quotes/${quote.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao excluir orcamento.');
      }

      setQuotes((currentQuotes) => currentQuotes.filter((item) => item.id !== quote.id));
      setSelectedQuote((currentQuote) => (currentQuote?.id === quote.id ? null : currentQuote));
      setEditingQuote((currentQuote) => (currentQuote?.id === quote.id ? null : currentQuote));
    } catch (err) {
      setError(err.message || 'Erro ao excluir orcamento.');
    } finally {
      setDeletingQuoteId(null);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <a
            href="#/admin"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </a>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">
              Orcamentos & Eventos
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Gestao de cotacoes para grandes pedidos
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-200">
              <FileText size={24} className="text-orange-500" />
              Cotacoes Recentes
            </h2>
            <button
              type="button"
              onClick={handleCreateClick}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 font-bold text-white transition hover:bg-orange-700"
            >
              <Plus size={18} /> Criar Orcamento
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Carregando...
            </p>
          ) : quotes.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 py-12 text-center text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <FileText size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
              <p className="font-bold">Nenhum orcamento encontrado.</p>
              <p className="text-sm">Crie seu primeiro orcamento de evento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <article
                  key={quote.id}
                  className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="break-words font-black text-slate-900 dark:text-slate-100">
                      {safeText(quote.customerName)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Data do Evento: {formatQuoteDate(quote.eventDate)}
                    </p>
                  </div>

                  <span className="text-lg font-black text-orange-600 dark:text-orange-400 lg:text-right">
                    {formatCurrency(quote.totalAmount)}
                  </span>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_repeat(3,minmax(0,auto))] sm:items-end">
                    <QuoteStatusSelect
                      quote={quote}
                      updatingStatusId={updatingStatusId}
                      onStatusChange={handleStatusChange}
                      compact
                    />
                    <ActionButton onClick={() => setSelectedQuote(quote)}>
                      <Eye size={16} />
                      Ver Detalhes
                    </ActionButton>
                    <ActionButton onClick={() => handleEditClick(quote)}>
                      <Pencil size={16} />
                      Editar
                    </ActionButton>
                    <ActionButton
                      onClick={() => handleDeleteQuote(quote)}
                      variant="danger"
                      disabled={deletingQuoteId === quote.id}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </ActionButton>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewQuoteModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingQuote(null);
        }}
        onSuccess={handleQuoteSaved}
        quote={editingQuote}
      />
      <QuoteDetailsModal
        quote={selectedQuote}
        onClose={() => setSelectedQuote(null)}
        updatingStatusId={updatingStatusId}
        onStatusChange={handleStatusChange}
        onEdit={handleEditClick}
        onDelete={handleDeleteQuote}
        deletingQuoteId={deletingQuoteId}
      />
    </PageContainer>
  );
}
