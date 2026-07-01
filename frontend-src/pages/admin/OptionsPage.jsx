import { useEffect, useState } from 'react';
import { ListPlus, Layers3, Plus } from 'lucide-react';
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

        const [addonsRes, crustsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/adicionais`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/bordas`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (addonsRes.ok && crustsRes.ok && isMounted) {
          const adds = await addonsRes.json();
          const crus = await crustsRes.json();
          setAddons((adds ?? []).map(normalizeOption));
          setCrusts((crus ?? []).map(normalizeOption));
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
      showSuccess('Adicional salvo com sucesso.');
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
      showSuccess('Adicional desativado.');
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

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Opções (Bordas e Adicionais)
          </h2>
          <p className="text-sm text-slate-500">Configure os extras para seus produtos</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(null);
            setIsModalOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus size={16} />
          {activeTab === 'addons' ? 'Novo Adicional' : 'Nova Borda'}
        </button>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('addons')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'addons'
              ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ListPlus size={18} />
          Adicionais
        </button>
        <button
          onClick={() => setActiveTab('crusts')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'crusts'
              ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Layers3 size={18} />
          Bordas Recheadas
        </button>
      </div>

      <Panel>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {sortedItems.map((item) => (
            <ListRow key={item.id} inactive={!item.isAvailable}>
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  {activeTab === 'addons' ? (
                    <ListPlus size={20} className="text-slate-400" />
                  ) : (
                    <Layers3 size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-black text-slate-950 dark:text-white text-base">
                    {item.name}
                  </h4>
                  <p className="truncate text-sm font-bold text-slate-500 mt-0.5">
                    {formatCurrency(item.price)}
                    {item.description ? ` · ${item.description}` : ''}
                  </p>
                </div>
              </div>
              <RowActions onEdit={() => editOption(item)} onDelete={() => deleteOption(item)} />
            </ListRow>
          ))}
          {sortedItems.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-bold">
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
        title={activeTab === 'addons' ? 'Adicional' : 'Borda'}
        onSave={saveOption}
        isSaving={isSaving}
      />
    </div>
  );
}
