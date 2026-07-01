import React, { useState } from 'react';
import { BaseModal } from '../../components/ui/BaseModal.jsx';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function NewSupplierModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      return setError('O nome do fornecedor é obrigatório.');
    }

    try {
      setLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';

      const res = await fetch(`${API_BASE_URL}/purchases/suppliers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Erro ao criar fornecedor.');
      }

      setFormData({ name: '', cnpj: '', email: '', phone: '' });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Novo Fornecedor">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Nome *
          </label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Pepsico"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            CNPJ
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.cnpj}
            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="contato@empresa.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Telefone
          </label>
          <input
            type="tel"
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Fornecedor'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
