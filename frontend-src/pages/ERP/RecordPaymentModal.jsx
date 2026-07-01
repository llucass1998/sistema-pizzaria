import React, { useState } from 'react';
import { BaseModal } from '../../components/ui/BaseModal.jsx';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function RecordPaymentModal({ isOpen, onClose, onSuccess, invoice }) {
  const totalAmount = invoice ? Number(invoice.totalAmount || 0) : 0;
  const totalPaid = invoice?.payments?.reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0;
  const remaining = Math.max(0, totalAmount - totalPaid);

  const [formData, setFormData] = useState({
    amount: remaining > 0 ? remaining.toFixed(2) : '',
    method: 'PIX'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sincroniza o saldo devedor quando o modal abrir para uma nova fatura
  React.useEffect(() => {
    if (isOpen && invoice) {
      setFormData({
        amount: remaining > 0 ? remaining.toFixed(2) : '',
        method: 'PIX'
      });
      setError('');
    }
  }, [isOpen, invoice, remaining]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const paymentAmount = Number(formData.amount);
    
    if (paymentAmount <= 0) {
      return setError('O valor pago deve ser maior que zero.');
    }
    if (paymentAmount > remaining) {
      return setError(`O valor pago não pode exceder o saldo restante (R$ ${remaining.toFixed(2)}).`);
    }

    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';

      const res = await fetch(`${API_BASE_URL}/receivables/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: paymentAmount,
          method: formData.method
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Erro ao registrar pagamento.');
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
    <BaseModal isOpen={isOpen} onClose={onClose} title="Registrar Pagamento">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            Fatura: <strong className="text-slate-800 dark:text-slate-200">{invoice.order?.customer?.name || 'Cliente Avulso'} - Pedido #{invoice.orderId?.slice(0, 6)}</strong>
          </p>
          <div className="flex justify-between items-center mt-3">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Valor Total</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">R$ {totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Já Pago</p>
              <p className="font-bold text-green-600">R$ {totalPaid.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo Restante</p>
              <p className="font-bold text-orange-600">R$ {remaining.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Valor do Pagamento *
          </label>
          <input
            type="number"
            required
            step="0.01"
            max={remaining}
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Método de Pagamento *
          </label>
          <select
            required
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.method}
            onChange={(e) => setFormData({ ...formData, method: e.target.value })}
          >
            <option value="PIX">PIX</option>
            <option value="CARD">Cartão</option>
            <option value="CASH">Dinheiro</option>
          </select>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || remaining <= 0}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
