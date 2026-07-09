import { useEffect, useState } from 'react';
import { List, Plus, Save, Trash, Search } from 'lucide-react';
import { Panel } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrency } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function RecipesPage() {
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [recipeItems, setRecipeItems] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  async function loadInitialData() {
    try {
      setIsLoading(true);
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));

      const [prodRes, ingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/produtos`), // Produto é público
        fetch(`${API_BASE_URL}/admin/inventory/ingredients`, {
          headers: { Authorization: `Bearer ${adminData.token}` },
        }),
      ]);

      const prodData = await prodRes.json();
      const ingData = await ingRes.json();

      setProducts(Array.isArray(prodData) ? prodData : []);
      setIngredients(Array.isArray(ingData) ? ingData : []);
    } catch (err) {
      showError('Erro ao carregar produtos ou ingredientes');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadRecipe(productId) {
    if (!productId) {
      setRecipeItems([]);
      return;
    }

    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));
      const response = await fetch(`${API_BASE_URL}/admin/recipes/product/${productId}`, {
        headers: { Authorization: `Bearer ${adminData.token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRecipeItems(
          data.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          })),
        );
      } else {
        setRecipeItems([]);
      }
    } catch (err) {
      showError('Erro ao carregar ficha técnica');
    }
  }

  function handleProductSelect(e) {
    const pid = e.target.value;
    setSelectedProductId(pid);
    loadRecipe(pid);
  }

  function addRecipeItem() {
    if (ingredients.length === 0) return;
    setRecipeItems([...recipeItems, { ingredientId: ingredients[0].id, quantity: 1 }]);
  }

  function removeRecipeItem(index) {
    const updated = [...recipeItems];
    updated.splice(index, 1);
    setRecipeItems(updated);
  }

  function updateRecipeItem(index, field, value) {
    const updated = [...recipeItems];
    updated[index][field] = value;
    setRecipeItems(updated);
  }

  async function handleSaveRecipe() {
    if (!selectedProductId) return;

    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));

      const response = await fetch(`${API_BASE_URL}/admin/recipes/product/${selectedProductId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.token}`,
        },
        body: JSON.stringify({
          items: recipeItems.map((i) => ({ ...i, quantity: Number(i.quantity) })),
        }),
      });

      const result = await response.json();
      if (response.ok) {
        showSuccess('Ficha técnica salva com sucesso!');
      } else {
        throw new Error(result.message || 'Erro ao salvar ficha técnica');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const estimatedCost = recipeItems.reduce((sum, item) => {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing) return sum;
    return sum + Number(item.quantity) * Number(ing.cost);
  }, 0);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Carregando dados...</div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <List className="text-red-600" />
            Fichas Técnicas
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Vincule ingredientes aos produtos para calcular custo e baixar estoque.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Panel className="p-4">
            <h2 className="font-bold text-slate-900 dark:text-white mb-4">Selecione o Produto</h2>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <select
                size={10}
                className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white"
                value={selectedProductId}
                onChange={handleProductSelect}
              >
                <option value="" disabled>
                  -- Escolha um produto --
                </option>
                {products
                  .filter((p) => p.isAvailable !== false)
                  .map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      className="py-2 px-2 border-b border-slate-100 dark:border-slate-800"
                    >
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </Panel>
        </div>

        {/* Painel Direito: Montagem da Receita */}
        <div className="md:col-span-2">
          {selectedProduct ? (
            <Panel className="flex flex-col h-full min-h-[500px]">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-xl">
                <div>
                  <h2 className="font-black text-lg text-slate-900 dark:text-white">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-sm text-slate-500 font-bold">
                    Custo Estimado:{' '}
                    <span className="text-red-600">{formatCurrency(estimatedCost)}</span>
                  </p>
                </div>
                <button
                  onClick={addRecipeItem}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white hover:bg-slate-700 font-bold rounded-lg transition text-sm"
                >
                  <Plus size={16} /> Adicionar Insumo
                </button>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {recipeItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <List size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="font-bold">Nenhuma ficha técnica montada para este produto.</p>
                  </div>
                ) : (
                  recipeItems.map((item, index) => {
                    const ing = ingredients.find((i) => i.id === item.ingredientId);
                    const itemCost = ing ? Number(ing.cost) * Number(item.quantity) : 0;

                    return (
                      <div
                        key={index}
                        className="flex gap-3 items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">
                            Ingrediente
                          </label>
                          <select
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-sm font-bold text-slate-800 dark:text-white"
                            value={item.ingredientId}
                            onChange={(e) =>
                              updateRecipeItem(index, 'ingredientId', e.target.value)
                            }
                          >
                            {ingredients.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Qtd</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-sm font-bold text-center text-slate-800 dark:text-white"
                            value={item.quantity}
                            onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="w-24 text-right pt-4">
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                            {formatCurrency(itemCost)}
                          </span>
                        </div>
                        <div className="pt-4">
                          <button
                            onClick={() => removeRecipeItem(index)}
                            className="text-red-400 hover:text-red-600 p-1 bg-red-50 dark:bg-red-900/20 rounded"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={handleSaveRecipe}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white hover:bg-red-700 font-bold rounded-lg transition shadow-md shadow-red-500/20"
                >
                  <Save size={18} />
                  Salvar Ficha Técnica
                </button>
              </div>
            </Panel>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-10">
              <List size={48} className="mb-4 opacity-20" />
              <p className="font-bold text-lg">Selecione um produto</p>
              <p className="text-sm mt-1">Para visualizar ou montar sua ficha técnica.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
