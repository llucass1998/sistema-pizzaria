import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');
import { PageContainer } from '../../components/ui/PageContainer.jsx';
import { RecordPaymentModal } from './RecordPaymentModal.jsx';

function isInvoicePaid(status) {
  return ['PAID', 'COMPLETED'].includes(status);
}

export default function AccountsReceivable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';
      const res = await fetch(`${API_BASE_URL}/receivables/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setInvoices(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalPending = invoices
    .filter((inv) => !isInvoicePaid(inv.status))
    .reduce((sum, inv) => {
      const totalPaid = inv.payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
      return sum + Math.max(0, Number(inv.totalAmount) - totalPaid);
    }, 0);

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-8 flex items-center gap-4">
          <a
            href="#/admin"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </a>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Contas a Receber</h1>
            <p className="text-slate-500 dark:text-slate-400">Gestão de faturas e pagamentos pendentes</p>
          </div>
        </header>

        <div className="mb-8 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 opacity-80">
            <Wallet size={24} />
            <h2 className="text-lg font-bold">Total a Receber</h2>
          </div>
          <p className="mt-2 text-4xl font-black">R$ {totalPending.toFixed(2)}</p>
        </div>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-slate-800 dark:text-slate-200">Faturas Pendentes</h2>

          {loading ? (
            <p className="text-slate-600 dark:text-slate-400">Carregando...</p>
          ) : invoices.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">Nenhuma fatura encontrada.</p>
          ) : (
            <div className="space-y-4">
              {invoices.map((inv) => {
                const isCompleted = isInvoicePaid(inv.status);
                const totalPaid = inv.payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
                const totalAmount = Number(inv.totalAmount);
                const progress = totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0;
                
                return (
                  <div key={inv.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-200">
                        {inv.order?.customer?.name || 'Cliente Avulso'} - Pedido #{inv.orderId?.slice(0, 6)}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Vencimento: {new Date(inv.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-slate-900 dark:text-slate-100">R$ {totalAmount.toFixed(2)}</span>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">
                          <CheckCircle2 size={16} /> Pago
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                          <AlertCircle size={16} /> {['PARTIAL', 'PARTIALLY_PAID'].includes(inv.status) ? 'Parcial' : 'Pendente'}
                        </span>
                      )}
                      {!isCompleted && (
                        <button 
                          onClick={() => setSelectedInvoice(inv)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                          Baixar
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Barra de Progresso de Pagamento */}
                  <div className="mt-2 w-full">
                    <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>R$ {totalPaid.toFixed(2)} pago</span>
                      <span>R$ {(totalAmount - totalPaid).toFixed(2)} restante</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-orange-500'}`} 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <RecordPaymentModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onSuccess={loadData}
        invoice={selectedInvoice}
      />
    </PageContainer>
  );
}
