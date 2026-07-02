import React, { useState, useEffect } from 'react';
import { BaseModal } from '../ui/BaseModal.jsx';
import { DollarSign } from 'lucide-react';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function OpenShiftModal({ isOpen, onOpen, adminData }) {
  const [registers, setRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch(`${API_BASE_URL}/admin/pos/shift/registers`, {
        headers: { 'Authorization': `Bearer ${adminData?.token}` }
      })
      .then(res => res.json())
      .then(data => {
        setRegisters(data);
        if (data.length > 0) setSelectedRegister(data[0].id);
      })
      .catch(() => setError('Erro ao buscar caixas.'));
    }
  }, [isOpen, adminData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/pos/shift/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminData?.token}`
        },
        body: JSON.stringify({ cashRegisterId: selectedRegister, openingCash })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao abrir caixa');
      onOpen(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 border-2 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
            <DollarSign size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Caixa Fechado</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Abra o caixa para iniciar as vendas</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Selecione o Caixa</label>
            <select
              required
              value={selectedRegister}
              onChange={(e) => setSelectedRegister(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-red-500"
            >
              <option value="">Selecione...</option>
              {registers.map(reg => (
                <option key={reg.id} value={reg.id}>{reg.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Troco Inicial (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              min="0"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !selectedRegister}
            className="w-full h-11 flex items-center justify-center bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Abrindo...' : 'Abrir Caixa'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function CloseShiftModal({ isOpen, onClose, currentShift, adminData, onClosed }) {
  const [closingCash, setClosingCash] = useState(0);
  const [summary, setSummary] = useState(currentShift?.summary || null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !currentShift?.id) return;
    let isMounted = true;

    async function loadSummary() {
      setIsLoadingSummary(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE_URL}/admin/pos/shift/${currentShift.id}/summary`, {
          headers: { Authorization: `Bearer ${adminData?.token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || 'Erro ao carregar resumo do caixa.');
        if (isMounted) {
          setSummary(data);
          setClosingCash(Number(data.expectedClosingCash ?? 0).toFixed(2));
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoadingSummary(false);
      }
    }

    loadSummary();
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentShift?.id, adminData?.token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/pos/shift/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminData?.token}`
        },
        body: JSON.stringify({ shiftId: currentShift.id, closingCash })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao fechar caixa');
      onClosed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Fechar Caixa">
      <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-200">
            {error}
          </div>
        )}
        {isLoadingSummary ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Carregando resumo do caixa...
          </div>
        ) : summary ? (
          <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Troco inicial</p>
                <p className="font-black text-slate-900 dark:text-white">
                  {formatMoney(summary.openingCash)}
                </p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Esperado gaveta</p>
                <p className="font-black text-emerald-700 dark:text-emerald-300">
                  {formatMoney(summary.expectedClosingCash)}
                </p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Sangrias</p>
                <p className="font-black text-rose-600">{formatMoney(summary.sangria)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Suprimentos</p>
                <p className="font-black text-sky-600">{formatMoney(summary.suprimento)}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="mb-2 text-xs font-black uppercase text-slate-400">Vendas por metodo</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(summary.salesByMethod || {}).map(([method, amount]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 font-bold dark:bg-slate-900"
                  >
                    <span>{method}</span>
                    <span>{formatMoney(amount)}</span>
                  </div>
                ))}
                {Object.keys(summary.salesByMethod || {}).length === 0 && (
                  <p className="col-span-2 text-sm font-bold text-slate-500">Sem vendas no caixa.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
            Valor contado em Gaveta (R$)
          </label>
          <input
            type="number"
            step="0.01"
            required
            min="0"
            value={closingCash}
            onChange={(e) => setClosingCash(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>
        <div className="pt-4 border-t dark:border-slate-700 flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-11 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            Confirmar Fechamento
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

export function CashTransactionModal({ isOpen, onClose, currentShift, adminData, onTransaction }) {
  const [type, setType] = useState('SANGRIA');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/pos/shift/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminData?.token}`
        },
        body: JSON.stringify({ shiftId: currentShift.id, type, amount, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro na transação');
      onTransaction(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Sangria / Suprimento">
      <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-200">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3">
          <label className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-all ${type === 'SANGRIA' ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" className="sr-only" checked={type === 'SANGRIA'} onChange={() => setType('SANGRIA')} />
            <span className="block font-black">Sangria</span>
            <span className="text-xs text-slate-500">Retirada do caixa</span>
          </label>
          <label className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-all ${type === 'SUPRIMENTO' ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" className="sr-only" checked={type === 'SUPRIMENTO'} onChange={() => setType('SUPRIMENTO')} />
            <span className="block font-black">Suprimento</span>
            <span className="text-xs text-slate-500">Reforço no caixa</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
            Valor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            required
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
            Motivo / Descrição
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            placeholder="Ex: Troco, Pagamento de fornecedor..."
          />
        </div>

        <div className="pt-4 border-t dark:border-slate-700 flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-11 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            Confirmar
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
