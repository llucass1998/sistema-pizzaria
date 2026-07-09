import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '../../data/menuData.js';
import { DollarSign, Check, X, ArrowRight } from 'lucide-react';

export function POSQuickPayModal({ isOpen, onClose, cartTotal, onConfirmPay }) {
  const [receivedAmount, setReceivedAmount] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReceivedAmount(String(cartTotal.toFixed(2)));
    }
  }, [isOpen, cartTotal]);

  const suggestions = useMemo(() => {
    const list = new Set([cartTotal]);
    const notes = [10, 20, 50, 100, 200];
    notes.forEach((n) => {
      if (n >= cartTotal) list.add(n);
    });
    const ceil5 = Math.ceil(cartTotal / 5) * 5;
    if (ceil5 >= cartTotal) list.add(ceil5);
    const ceil10 = Math.ceil(cartTotal / 10) * 10;
    if (ceil10 >= cartTotal) list.add(ceil10);
    return Array.from(list).sort((a, b) => a - b);
  }, [cartTotal]);

  if (!isOpen) return null;

  const numReceived = parseFloat(receivedAmount.replace(',', '.')) || 0;
  const change = Math.max(0, numReceived - cartTotal);
  const isEnough = numReceived >= cartTotal - 0.01;

  const handleConfirm = (e) => {
    if (e) e.preventDefault();
    if (!isEnough) return;
    onConfirmPay({ receivedAmount: numReceived, changeAmount: change });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-green-600 text-white">
          <div className="flex items-center gap-2 font-black text-lg">
            <DollarSign className="w-6 h-6" />
            <span>Pagamento em Dinheiro - Troco</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-6">
          {/* Total da Venda */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
              Total do Pedido:
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(cartTotal)}
            </span>
          </div>

          {/* Sugestões Rápidas de Cédulas */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              Sugestões Rápidas (Cédulas)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {suggestions.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setReceivedAmount(String(val.toFixed(2)))}
                  className={`py-2.5 px-3 rounded-xl border font-bold text-sm transition ${
                    Math.abs(numReceived - val) < 0.01
                      ? 'bg-green-600 border-green-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-green-500'
                  }`}
                >
                  {val === cartTotal ? 'Exato' : formatCurrency(val)}
                </button>
              ))}
            </div>
          </div>

          {/* Valor Recebido e Troco */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Valor Recebido (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                autoFocus
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-transparent dark:text-white font-black text-lg focus:border-green-500 focus:outline-none"
              />
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-xl border border-green-200 dark:border-green-800/50 flex flex-col justify-center">
              <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">
                Troco a Devolver
              </span>
              <span className="text-xl font-black text-green-700 dark:text-green-300">
                {formatCurrency(change)}
              </span>
            </div>
          </div>

          {!isEnough && (
            <p className="text-xs font-bold text-red-500">
              * O valor recebido é menor que o total do pedido.
            </p>
          )}

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isEnough}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-black py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg hover:shadow-green-600/20 active:scale-[0.98]"
            >
              <span>Confirmar e Finalizar (F9)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
