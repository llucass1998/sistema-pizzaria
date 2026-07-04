import React, { useState } from 'react';
import { BaseModal } from '../../components/ui/BaseModal.jsx';
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function ReversePaymentModal({ isOpen, onClose, onSuccess, invoice }) {
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState('');

  const payments = invoice?.payments || [];

  const handleReverse = async (paymentId) => {
    if (!window.confirm('Tem certeza que deseja estornar e excluir este pagamento?')) {
      return;
    }
    setError('');
    try {
      setLoadingId(paymentId);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';

      const res = await fetch(`${API_BASE_URL}/admin/receivables/invoices/${invoice.id}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Erro ao estornar pagamento.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!invoice) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Histórico de Pagamentos & Estornos">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-slate-500 dark:text-slate-400">
            Fatura: <strong className="text-slate-800 dark:text-slate-200">{invoice.order?.customer?.name || 'Cliente Avulso'} - Pedido #{invoice.orderId?.slice(0, 6)}</strong>
          </p>
          <p className="mt-1 font-bold text-slate-700 dark:text-slate-300">
            Total da Fatura: R$ {Number(invoice.totalAmount || 0).toFixed(2)}
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Pagamentos Registrados ({payments.length})
          </h3>
          {payments.length === 0 ? (
            <p className="text-sm italic text-slate-500 dark:text-slate-400">
              Nenhum pagamento registrado nesta fatura até o momento.
            </p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        R$ {Number(p.amount || 0).toFixed(2)}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {p.method}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Data: {new Date(p.paymentDate || p.createdAt || Date.now()).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReverse(p.id)}
                    disabled={loadingId === p.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/40"
                    title="Estornar Pagamento"
                  >
                    <Trash2 size={14} />
                    {loadingId === p.id ? 'Estornando...' : 'Estornar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
