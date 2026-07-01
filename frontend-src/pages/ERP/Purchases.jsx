import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Box, Calendar, Truck, Receipt } from 'lucide-react';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');
import { PageContainer } from '../../components/ui/PageContainer.jsx';
import { NewSupplierModal } from './NewSupplierModal.jsx';
import { NewInvoiceModal } from './NewInvoiceModal.jsx';

export default function Purchases() {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';
      const headers = { 'Authorization': `Bearer ${token}` };

      const [invRes, supRes, ingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/purchases/inbound-invoices`, { headers }),
        fetch(`${API_BASE_URL}/purchases/suppliers`, { headers }),
        fetch(`${API_BASE_URL}/inventory/ingredients`, { headers })
      ]);
      if (invRes.ok) setInvoices(await invRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (ingRes.ok) setIngredients(await ingRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Compras & Fornecedores</h1>
            <p className="text-slate-500 dark:text-slate-400">Notas de entrada e reabastecimento de estoque</p>
          </div>
        </header>

        {loading ? (
          <p className="text-slate-600 dark:text-slate-400">Carregando dados...</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-200">
                  <Receipt size={24} className="text-orange-500" />
                  Notas de Entrada
                </h2>
                <button 
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="flex items-center gap-1 rounded-lg bg-orange-100 px-3 py-1.5 text-sm font-bold text-orange-700 transition hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/60"
                >
                  <Plus size={16} /> Nova NF
                </button>
              </div>
              <div className="space-y-4">
                {invoices.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400">Nenhuma nota registrada.</p>
                ) : (
                  invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">NF: {inv.number}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{inv.supplier.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900 dark:text-slate-100">R$ {Number(inv.totalAmount).toFixed(2)}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(inv.issueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-200">
                  <Truck size={24} className="text-orange-500" />
                  Fornecedores
                </h2>
                <button 
                  onClick={() => setIsSupplierModalOpen(true)}
                  className="flex items-center gap-1 rounded-lg bg-orange-100 px-3 py-1.5 text-sm font-bold text-orange-700 transition hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/60"
                >
                  <Plus size={16} /> Novo Fornecedor
                </button>
              </div>
              <div className="space-y-4">
                {suppliers.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400">Nenhum fornecedor registrado.</p>
                ) : (
                  suppliers.map((sup) => (
                    <div key={sup.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{sup.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">CNPJ: {sup.cnpj || 'N/A'}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <NewSupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSuccess={loadData}
      />

      <NewInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSuccess={loadData}
        suppliers={suppliers}
        ingredients={ingredients}
      />
    </PageContainer>
  );
}
