import { useEffect, useState, useMemo } from 'react';
import { ListPlus, Layers3, Plus, Eye, EyeOff, Package, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Panel, ListRow, RowActions } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { OptionModal } from '../../components/admin/OptionModal.jsx';
import { formatCurrency } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

function normalizeOption(option) {
  return {
    ...option,
    price: Number(option.price ?? 0),
    sortOrder: Number(option.sortOrder ?? 0),
    isAvailable: option.isAvailable ?? true,
    stockImpactType: option.stockImpactType ?? 'NO_STOCK_IMPACT',
    ingredientId: option.ingredientId ?? '',
    ingredientQuantity: option.ingredientQuantity ?? '',
    replacementIngredientId: option.replacementIngredientId ?? '',
  };
}

export function OptionsPage() {
  const [activeTab, setActiveTab] = useState('addons'); // 'addons' or 'crusts'
  const [addons, setAddons] = useState([]);
  const [crusts, setCrusts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        if (!adminDataStr) return;
        const { token } = JSON.parse(adminDataStr);
        const headers = { Authorization: `Bearer ${token}` };

        const [addonsRes, crustsRes, ingRes] = await Promise.all([
          fetch(`${API_BASE_URL}/adicionais`, { headers }),
          fetch(`${API_BASE_URL}/bordas`, { headers }),
          fetch(`${API_BASE_URL}/inventory/ingredients`, { headers }),
        ]);

        if (addonsRes.ok && crustsRes.ok && isMounted) {
          const adds = await addonsRes.json();
          const crus = await crustsRes.json();
          setAddons((adds ?? []).map(normalizeOption));
          setCrusts((crus ?? []).map(normalizeOption));
        }

        if (ingRes.ok && isMounted) {
          const ingData = await ingRes.json();
          setIngredients(Array.isArray(ingData) ? ingData : []);
        }
      } catch (err) {
        console.error('Erro ao carregar', err);
        showError('Falha ao carregar os dados.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const ingredientsMap = useMemo(() => {
    const map = {};
    for (const ing of ingredients) {
      map[ing.id] = `${ing.name} (${ing.unit || 'un'})`;
    }
    return map;
  }, [ingredients]);

  async function saveOption(data) {
    try {
      setIsSaving(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);

      const payload = {
        ...data,
        sortOrder: Number(data.sortOrder ?? 0),
      };

      const isEditing = Boolean(data.id);
      const endpoint = activeTab === 'addons' ? '/adicionais' : '/bordas';

      const response = await fetch(
        `${API_BASE_URL}${isEditing ? `${endpoint}/${data.id}` : endpoint}`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error('Erro ao salvar item');
      const saved = await response.json();

      const setList = activeTab === 'addons' ? setAddons : setCrusts;

      setList((current) =>
        isEditing
          ? current.map((item) => (item.id === saved.id ? normalizeOption(saved) : item))
          : [...current, normalizeOption(saved)],
      );

      setForm(null);
      setIsModalOpen(false);
      showSuccess('Opção salva com sucesso.');
    } catch (optError) {
      showError(optError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function editOption(item) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price: item.price ?? 0,
      sortOrder: item.sortOrder ?? 0,
      isAvailable: item.isAvailable ?? true,
      stockImpactType: item.stockImpactType ?? 'NO_STOCK_IMPACT',
      ingredientId: item.ingredientId ?? '',
      ingredientQuantity: item.ingredientQuantity ?? '',
      replacementIngredientId: item.replacementIngredientId ?? '',
    });
    setIsModalOpen(true);
  }

  async function toggleAvailability(item) {
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);
      const updatedStatus = !item.isAvailable;
      const endpoint = activeTab === 'addons' ? '/adicionais' : '/bordas';

      const response = await fetch(`${API_BASE_URL}${endpoint}/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...item, isAvailable: updatedStatus }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar disponibilidade');
      const saved = await response.json();

      const setList = activeTab === 'addons' ? setAddons : setCrusts;
      setList((current) =>
        current.map((opt) => (opt.id === item.id ? normalizeOption(saved) : opt)),
      );
      showSuccess(`Item ${updatedStatus ? 'disponibilizado' : 'ocultado'} com sucesso.`);
    } catch (err) {
      showError(err.message);
    }
  }

  async function deleteOption(item) {
    if (!window.confirm(`Desativar o item ${item.name}?`)) return;
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);

      const endpoint = activeTab === 'addons' ? '/adicionais' : '/bordas';

      const response = await fetch(`${API_BASE_URL}${endpoint}/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erro ao apagar item');

      const setList = activeTab === 'addons' ? setAddons : setCrusts;

      setList((current) =>
        current.map((opt) => (opt.id === item.id ? { ...opt, isAvailable: false } : opt)),
      );
      showSuccess('Item desativado.');
    } catch (optError) {
      showError(optError.message);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  const items = activeTab === 'addons' ? addons : crusts;
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  
  const totalStockImpactCount = useMemo(() => {
    return [...addons, ...crusts].filter(i => i.stockImpactType && i.stockImpactType !== 'NO_STOCK_IMPACT').length;
  }, [addons, crusts]);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="text-red-600" />
            Opções, Bordas & Adicionais
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Personalize os extras do cardápio e vincule a baixa automática de ingredientes no estoque.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(null);
            setIsModalOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 shadow-md"
        >
          <Plus size={16} />
          {activeTab === 'addons' ? 'Novo Adicional' : 'Nova Borda'}
        </button>
      </div>

      {/* Mini KPIs de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-red-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Adicionais</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">{addons.length}</span>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-amber-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bordas Recheadas</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">{crusts.length}</span>
        </Panel>

        <Panel className="p-4 flex flex-col justify-center border-l-4 border-l-blue-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vínculos de Estoque Ativos</span>
          <div className="flex items-center gap-2 mt-1">
            <Package size={18} className="text-blue-500" />
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalStockImpactCount}</span>
            <span className="text-xs text-slate-500 font-bold">opções autobaixa</span>
          </div>
        </Panel>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('addons')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'addons'
              ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ListPlus size={18} />
          Adicionais Extras ({addons.length})
        </button>
        <button
          onClick={() => setActiveTab('crusts')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'crusts'
              ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Layers3 size={18} />
          Bordas Recheadas ({crusts.length})
        </button>
      </div>

      <Panel>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {sortedItems.map((item) => (
            <ListRow key={item.id} inactive={!item.isAvailable}>
              <div className="flex min-w-0 items-center gap-4 flex-1">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                  {activeTab === 'addons' ? (
                    <ListPlus size={24} className="text-slate-400" />
                  ) : (
                    <Layers3 size={24} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="truncate font-black text-slate-950 dark:text-white text-base">
                      {item.name}
                    </h4>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.price)}
                    </span>
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                      Ordem: {item.sortOrder}
                    </span>
                  </div>
                  
                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {item.description}
                    </p>
                  )}

                  {/* Impacto no Estoque Badge */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {(item.stockImpactType === 'CONSUME' || item.stockImpactType === 'ADD_INGREDIENT') && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        <Package size={12} className="text-blue-600" />
                        Adiciona/Baixa: {item.ingredientQuantity || 1}x {ingredientsMap[item.ingredientId] || item.ingredientId || 'Ingrediente selecionado'}
                      </span>
                    )}
                    {item.stockImpactType === 'REMOVE_INGREDIENT' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                        <Package size={12} className="text-amber-600" />
                        Remove insumo base: {ingredientsMap[item.ingredientId] || item.ingredientId || 'Ingrediente padrão'}
                      </span>
                    )}
                    {(item.stockImpactType === 'REPLACE' || item.stockImpactType === 'REPLACE_INGREDIENT') && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                        <RefreshCw size={12} className="text-purple-600" />
                        Substitui {ingredientsMap[item.ingredientId] || 'insumo base'} por: {ingredientsMap[item.replacementIngredientId] || item.replacementIngredientId || 'Novo insumo'}
                      </span>
                    )}
                    {(item.stockImpactType === 'NO_STOCK_IMPACT' || !item.stockImpactType) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        ⚪ Sem baixa automática no estoque
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleAvailability(item)}
                  className={`p-2 rounded-lg border transition flex items-center gap-1.5 text-xs font-bold ${
                    item.isAvailable
                      ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-400'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                  title={item.isAvailable ? 'Clique para Ocultar' : 'Clique para Disponibilizar'}
                >
                  {item.isAvailable ? <Eye size={16} /> : <EyeOff size={16} />}
                  <span className="hidden sm:inline">{item.isAvailable ? 'Disponível' : 'Oculto'}</span>
                </button>

                <RowActions onEdit={() => editOption(item)} onDelete={() => toggleAvailability(item)} />
              </div>
            </ListRow>
          ))}
          {sortedItems.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-bold">
              Nenhum item cadastrado nesta aba.
            </div>
          )}
        </div>
      </Panel>

      <OptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setForm(null);
        }}
        initialData={form}
        title={activeTab === 'addons' ? 'Adicional Extra' : 'Borda Recheada'}
        onSave={saveOption}
        isSaving={isSaving}
      />
    </div>
  );
}
