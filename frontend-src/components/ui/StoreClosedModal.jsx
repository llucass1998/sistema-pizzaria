import React from 'react';
import { BaseModal } from './BaseModal.jsx';
import { Store, Clock } from 'lucide-react';

export function StoreClosedModal({ isOpen, onClose, storeHours }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Loja Fechada">
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-400">
          <Store size={48} />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-800 dark:text-slate-200">Ops, estamos fechados agora!</h3>
        <p className="mb-6 text-slate-600 dark:text-slate-400">
          Não é possível adicionar itens ao carrinho no momento.
        </p>

        <div className="mb-6 flex max-w-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-950 px-4 py-3 text-orange-800 sm:flex-row">
          <Clock size={20} className="shrink-0 text-red-600" />
          <span className="font-bold">Horário: {storeHours || '18:00 - 23:30'}</span>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-red-600 py-3 font-bold text-white transition-colors hover:bg-red-700"
        >
          Entendido
        </button>
      </div>
    </BaseModal>
  );
}
