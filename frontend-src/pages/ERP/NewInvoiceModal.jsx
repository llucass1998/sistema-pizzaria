import React, { useState, useMemo } from 'react';
import { BaseModal } from '../../components/ui/BaseModal.jsx';
import { Plus, Trash2 } from 'lucide-react';
const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function NewInvoiceModal({ isOpen, onClose, onSuccess, suppliers, ingredients }) {
  const [formData, setFormData] = useState({
    supplierId: '',
    number: '',
    issueDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitCost || 0)), 0);
  }, [items]);

  const handleAddItem = () => {
    if (ingredients.length === 0) return;
    setItems([...items, { ingredientId: ingredients[0].id, quantity: 1, unitCost: 0 }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.supplierId) return setError('Selecione um fornecedor.');
    if (items.length === 0) return setError('Adicione pelo menos um item à nota.');
    
    // Validar itens
    for (const item of items) {
      if (item.quantity <= 0) return setError('A quantidade deve ser maior que zero.');
      if (item.unitCost < 0) return setError('O custo não pode ser negativo.');
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        totalAmount,
        items: items.map(i => ({
          ingredientId: i.ingredientId,
          quantity: Number(i.quantity || 0),
          unitCost: Number(i.unitCost || 0),
          totalCost: Number(i.quantity || 0) * Number(i.unitCost || 0)
        }))
      };

      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const token = adminDataStr ? JSON.parse(adminDataStr).token : '';

      const res = await fetch(`${API_BASE_URL}/purchases/inbound-invoices`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Erro ao registrar NF.');
      }

      setFormData({ supplierId: '', number: '', issueDate: new Date().toISOString().split('T')[0], notes: '' });
      setItems([]);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Registrar Nota Fiscal">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Fornecedor *
            </label>
            <select
              required
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Número da NF
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              placeholder="000.000.000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Data de Emissão
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={formData.issueDate}
              onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Valor Total (Automático)
            </label>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 font-bold">
              R$ {totalAmount.toFixed(2)}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Observações
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Lote, frete, etc..."
          />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Itens da Nota</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 text-sm font-bold text-orange-600 transition hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200"
            >
              <Plus size={16} /> Adicionar Item
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {items.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum item adicionado.</p>
            )}
            {items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex-1">
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    value={item.ingredientId}
                    onChange={(e) => handleItemChange(index, 'ingredientId', e.target.value)}
                  >
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-24">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Qtd"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-28">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="R$ Un."
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    value={item.unitCost}
                    onChange={(e) => handleItemChange(index, 'unitCost', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
            disabled={loading}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Registrar Nota'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
