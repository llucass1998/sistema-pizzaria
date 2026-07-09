import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export default function MockPaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get('orderId');
  const externalId = searchParams.get('externalId');
  const amountParam = searchParams.get('amount');

  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!orderId || !externalId) {
      setErrorMessage('Link de pagamento inválido ou expirado.');
      setStatus('error');
    }
  }, [orderId, externalId]);

  const amount = parseFloat(amountParam || '0');

  const handleSimulatePayment = async (simulatedStatus) => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/webhooks/payments/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          externalId,
          orderId,
          status: simulatedStatus, // 'APPROVED' or 'REJECTED'
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao processar pagamento.');
      }

      setStatus('success');

      // Se sucesso, redireciona de volta para o acompanhamento do pedido
      setTimeout(() => {
        navigate(`/order/${orderId}?payment=success`);
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Erro de conexão.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-slate-900 dark:bg-black p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
            <CreditCard size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white">Ambiente de Teste</h1>
          <p className="text-slate-400 text-sm mt-1">Simulador de Pagamento</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === 'idle' && (
            <>
              <div className="mb-8 text-center">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                  Valor a pagar
                </p>
                <h2 className="text-4xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(amount)}
                </h2>
                <p className="text-xs text-slate-400 mt-2">Pedido #{orderId?.slice(0, 8)}</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleSimulatePayment('APPROVED')}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition"
                >
                  <CheckCircle size={20} />
                  Simular Pagamento (Aprovado)
                </button>

                <button
                  onClick={() => {
                    alert('Pagamento recusado simulado. O cliente precisaria tentar outro cartao.');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 font-bold py-4 px-6 rounded-xl transition"
                >
                  <XCircle size={20} />
                  Simular Falha (Recusado)
                </button>
              </div>
            </>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={48} className="text-slate-300 dark:text-slate-700 animate-spin mb-4" />
              <p className="text-slate-600 dark:text-slate-400 font-bold animate-pulse">
                Processando pagamento...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle size={64} className="text-emerald-500 mb-4" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                Pagamento Aprovado!
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                Você será redirecionado em instantes...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle size={64} className="text-rose-500 mb-4" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Erro</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">{errorMessage}</p>
              <button
                onClick={() => setStatus('idle')}
                className="bg-slate-900 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 text-center border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 font-medium">
            Isso é apenas um teste. Nenhuma cobrança real será feita.
          </p>
        </div>
      </div>
    </div>
  );
}
