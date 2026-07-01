import { useEffect, useState } from 'react';
import { Package, Plus, ArrowDown, ArrowUp, Edit, Trash, History } from 'lucide-react';
import { Panel, ListRow, RowActions } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrency } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function InventoryPage() {
  const [data, setData] = useState({ ingredients: [], summary: {} });
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();
  
  // Modals state
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  
  const [ingredientForm, setIngredientForm] = useState({
    name: '', unit: 'UN', cost: 0, minStock: 0, stock: 0
  });

  const [transactionForm, setTransactionForm] = useState({
    ingredientId: '', type: 'IN', quantity: 0, cost: 0, notes: ''
  });

  async function loadData() {
    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));
      const response = await fetch(`${API_BASE_URL}/inventory/summary`, {
        headers: {
          'Authorization': `Bearer ${adminData.token}`
        }
      });
      const result = await response.json();
      if (response.ok) {
        setData({ ingredients: result.ingredients || [], summary: result });
      } else {
        throw new Error(result.message || 'Erro ao carregar estoque');
      }
    } catch (err) {
      console.error('Erro ao carregar', err);
      showError('Falha ao carregar estoque.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveIngredient(e) {
    e.preventDefault();
    
    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));
      const url = editingIngredient 
        ? `${API_BASE_URL}/inventory/ingredients/${editingIngredient.id}`
        : `${API_BASE_URL}/inventory/ingredients`;
        
      const response = await fetch(url, {
        method: editingIngredient ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminData.token}`
        },
        body: JSON.stringify(ingredientForm)
      });
      
      const result = await response.json();
      if (response.ok) {
        setIsIngredientModalOpen(false);
        showSuccess('Ingrediente salvo com sucesso!');
        loadData();
      } else {
        throw new Error(result.message || 'Erro ao salvar ingrediente');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleSaveTransaction(e) {
    e.preventDefault();
    
    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));
      const response = await fetch(`${API_BASE_URL}/inventory/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminData.token}`
        },
        body: JSON.stringify(transactionForm)
      });
      
      const result = await response.json();
      if (response.ok) {
        setIsTransactionModalOpen(false);
        showSuccess('Transação registrada!');
        loadData();
      } else {
        throw new Error(result.message || 'Erro ao registrar transação');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  function openNewIngredient() {
    setEditingIngredient(null);
    setIngredientForm({ name: '', unit: 'UN', cost: 0, minStock: 0, stock: 0 });
    setIsIngredientModalOpen(true);
  }

  function openEditIngredient(ingredient) {
    setEditingIngredient(ingredient);
    setIngredientForm({
      name: ingredient.name,
      unit: ingredient.unit,
      cost: ingredient.cost,
      minStock: ingredient.minStock,
      stock: ingredient.stock
    });
    setIsIngredientModalOpen(true);
  }

  function openTransaction(type, ingredientId = '') {
    setTransactionForm({
      ingredientId,
      type,
      quantity: 0,
      cost: 0,
      notes: ''
    });
    setIsTransactionModalOpen(true);
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Carregando estoque...</div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="text-red-600" />
            Controle de Estoque
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Gerencie ingredientes e registre entradas/saídas.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => openTransaction('IN')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold rounded-lg transition"
          >
            <ArrowDown size={18} />
            Entrada
          </button>
          <button 
            onClick={() => openTransaction('OUT')}
            className="flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 font-bold rounded-lg transition"
          >
            <ArrowUp size={18} />
            Saída
          </button>
          <button 
            onClick={openNewIngredient}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 font-bold rounded-lg transition shadow-md shadow-red-500/20"
          >
            <Plus size={18} />
            Novo Insumo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Panel className="p-4 flex flex-col justify-center">
          <span className="text-sm font-bold text-slate-500">Valor em Estoque</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCurrency(data.summary?.totalStockValue || 0)}
          </span>
        </Panel>
        <Panel className="p-4 flex flex-col justify-center">
          <span className="text-sm font-bold text-slate-500">Insumos Críticos</span>
          <span className="text-2xl font-black text-rose-600 mt-1">
            {data.summary?.criticalCount || 0}
          </span>
        </Panel>
        <Panel className="p-4 flex flex-col justify-center">
          <span className="text-sm font-bold text-slate-500">Insumos Baixos</span>
          <span className="text-2xl font-black text-amber-500 mt-1">
            {data.summary?.lowCount || 0}
          </span>
        </Panel>
        <Panel className="p-4 flex flex-col justify-center">
          <span className="text-sm font-bold text-slate-500">Sugestão de Compra</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCurrency(data.summary?.purchaseSuggestion || 0)}
          </span>
        </Panel>
      </div>

      <Panel>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">Ingredientes Cadastrados</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.ingredients.map(ing => (
            <ListRow key={ing.id}>
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white truncate">{ing.name}</p>
                  <p className="text-xs text-slate-500">Custo: {formatCurrency(ing.cost)} / {ing.unit}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Saldo Atual</p>
                  <p className={`font-black ${ing.status === 'CRITICAL' || ing.status === 'OUT' ? 'text-rose-600' : ing.status === 'LOW' ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {ing.stock} {ing.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Estoque Mín.</p>
                  <p className="font-bold text-slate-900 dark:text-white">{ing.minStock} {ing.unit}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    ing.status === 'CRITICAL' || ing.status === 'OUT' ? 'bg-rose-100 text-rose-700' : 
                    ing.status === 'LOW' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {ing.status}
                  </span>
                </div>
              </div>
              <RowActions>
                <button 
                  onClick={() => openEditIngredient(ing)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Editar Insumo"
                >
                  <Edit size={18} />
                </button>
              </RowActions>
            </ListRow>
          ))}
          {data.ingredients.length === 0 && (
            <div className="p-8 text-center text-slate-500">Nenhum ingrediente cadastrado.</div>
          )}
        </div>
      </Panel>

      {/* Modal Ingrediente */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">
                {editingIngredient ? 'Editar Ingrediente' : 'Novo Ingrediente'}
              </h3>
              <button onClick={() => setIsIngredientModalOpen(false)} className="text-slate-400 hover:text-red-500">
                <Trash size={20} /> 
              </button>
            </div>
            <form onSubmit={handleSaveIngredient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Insumo</label>
                <input 
                  type="text" required
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                  value={ingredientForm.name} onChange={e => setIngredientForm({...ingredientForm, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                  <select 
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                    value={ingredientForm.unit} onChange={e => setIngredientForm({...ingredientForm, unit: e.target.value})}
                  >
                    <option value="UN">Unidade (UN)</option>
                    <option value="KG">Quilograma (KG)</option>
                    <option value="G">Grama (G)</option>
                    <option value="L">Litro (L)</option>
                    <option value="ML">Mililitro (ML)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Custo (R$)</label>
                  <input 
                    type="number" step="0.01" required min="0"
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                    value={ingredientForm.cost} onChange={e => setIngredientForm({...ingredientForm, cost: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Estoque Minimo</label>
                  <input 
                    type="number" step="0.001" required min="0"
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                    value={ingredientForm.minStock} onChange={e => setIngredientForm({...ingredientForm, minStock: e.target.value})}
                  />
                </div>
                {!editingIngredient && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Estoque Inicial</label>
                    <input 
                      type="number" step="0.001" required min="0"
                      className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                      value={ingredientForm.stock} onChange={e => setIngredientForm({...ingredientForm, stock: e.target.value})}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsIngredientModalOpen(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transacao */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">
                {transactionForm.type === 'IN' ? 'Registrar Entrada' : 'Registrar Saída'}
              </h3>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Ingrediente</label>
                <select 
                  required
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                  value={transactionForm.ingredientId} onChange={e => setTransactionForm({...transactionForm, ingredientId: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {data.ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name} (Saldo: {ing.stock} {ing.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Quantidade</label>
                  <input 
                    type="number" step="0.001" required min="0.001"
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                    value={transactionForm.quantity} onChange={e => setTransactionForm({...transactionForm, quantity: e.target.value})}
                  />
                </div>
                {transactionForm.type === 'IN' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Custo Total (R$)</label>
                    <input 
                      type="number" step="0.01" min="0"
                      className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                      value={transactionForm.cost} onChange={e => setTransactionForm({...transactionForm, cost: e.target.value})}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Observações</label>
                <input 
                  type="text" placeholder="Ex: Compra semanal, Desperdício..."
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-transparent dark:text-white"
                  value={transactionForm.notes} onChange={e => setTransactionForm({...transactionForm, notes: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
