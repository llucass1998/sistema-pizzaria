import React, { useEffect, useMemo, useState } from 'react';
import { BaseModal } from '../../components/ui/BaseModal.jsx';
import { Plus, Trash2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const emptyFormData = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  eventDate: '',
  validUntil: '',
  notes: '',
};

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

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getInitialFormData(quote) {
  if (!quote) return emptyFormData;

  return {
    customerName: quote.customerName ?? '',
    customerEmail: quote.customerEmail ?? '',
    customerPhone: quote.customerPhone ?? '',
    eventDate: toDateInput(quote.eventDate),
    validUntil: toDateInput(quote.validUntil),
    notes: quote.notes ?? '',
  };
}

function getInitialItems(quote) {
  return getQuoteItems(quote).map((item) => ({
    id: item.id,
    name: item.name ?? '',
    quantity: Number(item.quantity ?? 1),
    unitPrice: Number(item.unitPrice ?? 0),
  }));
}

export function NewQuoteModal({ isOpen, onClose, onSuccess, quote = null }) {
  const isEditing = Boolean(quote?.id);
  const [formData, setFormData] = useState(emptyFormData);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setFormData(getInitialFormData(quote));
    setItems(getInitialItems(quote));
    setError('');
  }, [isOpen, quote]);

  const totalAmount = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
  }, [items]);

  const handleAddItem = () => {
    setItems((currentItems) => [
      ...currentItems,
      { name: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.customerName.trim()) {
      setError('Nome do cliente e obrigatorio.');
      return;
    }

    if (items.length === 0) {
      setError('Adicione pelo menos um item ao orcamento.');
      return;
    }

    for (const item of items) {
      if (!String(item.name ?? '').trim()) {
        setError('O nome do item e obrigatorio.');
        return;
      }
      if (Number(item.quantity) <= 0) {
        setError('A quantidade deve ser maior que zero.');
        return;
      }
      if (Number(item.unitPrice) < 0) {
        setError('O preco nao pode ser negativo.');
        return;
      }
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        totalAmount,
        items: items.map((item) => {
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.unitPrice || 0);
          return {
            id: item.id,
            name: String(item.name ?? '').trim(),
            quantity,
            unitPrice,
            totalPrice: quantity * unitPrice,
          };
        }),
      };

      if (!payload.eventDate) {
        if (isEditing) payload.eventDate = null;
        else delete payload.eventDate;
      }

      if (!payload.validUntil) {
        if (isEditing) payload.validUntil = null;
        else delete payload.validUntil;
      }

      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';
      const response = await fetch(
        isEditing ? `${API_BASE_URL}/quotes/${quote.id}` : `${API_BASE_URL}/quotes`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Erro ao salvar orcamento.');
      }

      if (!isEditing) {
        setFormData(emptyFormData);
        setItems([]);
      }

      await onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao salvar orcamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Orcamento' : 'Novo Orcamento'}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Nome do Cliente *
            </label>
            <input
              type="text"
              required
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.customerName}
              onChange={(event) => setFormData({ ...formData, customerName: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Telefone
            </label>
            <input
              type="tel"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.customerPhone}
              onChange={(event) => setFormData({ ...formData, customerPhone: event.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.customerEmail}
              onChange={(event) => setFormData({ ...formData, customerEmail: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Observacoes
            </label>
            <input
              type="text"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.notes}
              onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
              placeholder="Detalhes adicionais..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Data do Evento
            </label>
            <input
              type="date"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.eventDate}
              onChange={(event) => setFormData({ ...formData, eventDate: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Validade do Orcamento
            </label>
            <input
              type="date"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.validUntil}
              onChange={(event) => setFormData({ ...formData, validUntil: event.target.value })}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Itens Orcados</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-black text-orange-700 transition hover:bg-orange-100 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50"
            >
              <Plus size={16} /> Adicionar Item
            </button>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {items.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Nenhum item adicionado.
              </p>
            )}
            {items.map((item, index) => (
              <div
                key={item.id ?? index}
                className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_6rem_8rem_2.5rem]"
              >
                <input
                  type="text"
                  placeholder="Nome do item"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={item.name}
                  onChange={(event) => handleItemChange(index, 'name', event.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qtd"
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={item.quantity}
                  onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="R$ Unit."
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  value={item.unitPrice}
                  onChange={(event) => handleItemChange(index, 'unitPrice', event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="flex h-10 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                  aria-label="Remover item"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-right dark:bg-slate-950">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Total: </span>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-orange-600 px-5 text-sm font-black text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : isEditing ? 'Salvar Alteracoes' : 'Salvar Orcamento'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
