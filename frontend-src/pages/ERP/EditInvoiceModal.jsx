import React, { useState, useEffect } from 'react';
import { BaseModal } from '../../components/ui/BaseModal.jsx';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function EditInvoiceModal({ isOpen, onClose, onSuccess, invoice }) {
  const [formData, setFormData] = useState({
    dueDate: '',
    totalAmount: '',
    status: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && invoice) {
      setFormData({
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
        totalAmount: invoice.totalAmount ? Number(invoice.totalAmount).toFixed(2) : '',
        status: invoice.status || 'PENDING',
      });
      setError('');
    }
  }, [isOpen, invoice]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';

      const res = await fetch(`${API_BASE_URL}/receivables/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          dueDate: formData.dueDate ? formData.dueDate : null,
          totalAmount: Number(formData.totalAmount),
          status: formData.status,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Erro ao atualizar fatura.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Editar Fatura">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-slate-500 dark:text-slate-400">
            Fatura: <strong className="text-slate-800 dark:text-slate-200">{invoice.order?.customer?.name || 'Cliente Avulso'} - Pedido #{invoice.orderId?.slice(0, 6)}</strong>
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Data de Vencimento
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Valor Total (R$) *
          </label>
          <input
            type="number"
            required
            step="0.01"
            min="0.01"
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.totalAmount}
            onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Status
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="PENDING">Pendente</option>
            <option value="PARTIALLY_PAID">Pago Parcial</option>
            <option value="PAID">Pago / Quitado</option>
            <option value="OVERDUE">Vencido / Atrasado</option>
            <option value="CANCELED">Cancelado</option>
          </select>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
