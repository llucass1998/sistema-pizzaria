import React, { useState, useEffect } from 'react';
import { X, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const PAYMENT_METHODS = [
  { id: 'PIX', label: 'PIX Instantâneo' },
  { id: 'BOLETO', label: 'Boleto Bancário' },
  { id: 'TRANSFER', label: 'TED / DOC / Transferência' },
  { id: 'CREDIT_CARD', label: 'Cartão de Crédito' },
  { id: 'DEBIT_CARD', label: 'Cartão de Débito' },
  { id: 'CASH', label: 'Dinheiro (Especie)' },
  { id: 'OTHER', label: 'Outro Método' },
];

export function PayablePaymentModal({ isOpen, onClose, onSuccess, payable }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [notes, setNotes] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (payable && isOpen) {
      setAmount(Number(payable.remainingAmount ?? payable.amount).toFixed(2));
      setPaymentMethod('PIX');
      setNotes('');
      setPaidAt(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [payable, isOpen]);

  if (!isOpen || !payable) return null;

  const remaining = Number(payable.remainingAmount ?? payable.amount);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError('Informe um valor de pagamento maior que zero.');
      return;
    }
    if (val > remaining + 0.01) {
      setError(`O valor não pode ser maior que o saldo devedor (R$ ${remaining.toFixed(2)}).`);
      return;
    }

    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';

      const res = await fetch(`${API_BASE_URL}/admin/payables/${payable.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: val,
          paymentMethod,
          notes: notes.trim() || null,
          paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao registrar pagamento.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <DollarSign className="text-emerald-500" size={24} />
            <h3 className="text-xl font-bold">Registrar Pagamento / Baixa</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Despesa</p>
          <p className="font-bold text-slate-800 dark:text-slate-200">{payable.description}</p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Saldo Devedor:</span>
            <span className="font-black text-amber-600 dark:text-amber-400">R$ {remaining.toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Valor do Pagamento (R$) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining + 0.05}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              Pode ser parcial ou total. Se pagar tudo, a conta constará como Quitada.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Forma de Pagamento <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Data da Baixa
            </label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Comprovante / Notas
            </label>
            <input
              type="text"
              placeholder="Ex: Ref PIX 12345, Pago via Itau..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
