import { useEffect, useState } from 'react';
import { Tags, ArrowUp, ArrowDown, Eye, EyeOff, RefreshCw, Layers, PieChart } from 'lucide-react';
import { Panel, ListRow, RowActions } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { CategoryModal } from '../../components/admin/CategoryModal.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

function normalizeCategory(category) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? '',
    icon: category.icon ?? '',
    imageUrl: category.imageUrl ?? '',
    sortOrder: Number(category.sortOrder ?? 0),
    isActive: category.isActive ?? true,
    allowSizes: Boolean(category.allowSizes),
    allowHalfAndHalf: Boolean(category.allowHalfAndHalf),
    halfAndHalfGroup: category.halfAndHalfGroup ?? '',
  };
}

export function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const { showSuccess, showError } = useToast();

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        if (!adminDataStr) return;
        const { token } = JSON.parse(adminDataStr);

        const response = await fetch(`${API_BASE_URL}/admin/categorias`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok && isMounted) {
          const cats = await response.json();
          setCategories((cats ?? []).map(normalizeCategory));
        }
      } catch (err) {
        console.error('Erro ao carregar', err);
        showError('Falha ao carregar as categorias.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  async function saveCategory(data) {
    try {
      setIsSaving(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);

      const payload = {
        ...data,
        sortOrder: Number(data.sortOrder ?? 0),
      };

      const isEditing = Boolean(data.id);

      const response = await fetch(
        `${API_BASE_URL}${isEditing ? `/categorias/${data.id}` : '/categorias'}`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error('Erro ao salvar categoria');
      const saved = await response.json();

      setCategories((current) =>
        isEditing
          ? current.map((category) =>
              category.id === saved.id ? normalizeCategory(saved) : category,
            )
          : [...current, normalizeCategory(saved)],
      );

      setCategoryForm(null);
      setIsCategoryModalOpen(false);
      showSuccess('Categoria salva com sucesso.');
    } catch (catError) {
      showError(catError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function editCategory(category) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      icon: category.icon ?? '',
      imageUrl: category.imageUrl ?? '',
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
      allowSizes: Boolean(category.allowSizes),
      allowHalfAndHalf: Boolean(category.allowHalfAndHalf),
      halfAndHalfGroup: category.halfAndHalfGroup ?? '',
    });
    setIsCategoryModalOpen(true);
  }

  async function toggleCategoryStatus(category) {
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);
      const updatedStatus = !category.isActive;

      const response = await fetch(`${API_BASE_URL}/categorias/${category.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...category, isActive: updatedStatus }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar status da categoria');
      const saved = await response.json();

      setCategories((current) =>
        current.map((item) => (item.id === category.id ? normalizeCategory(saved) : item)),
      );
      showSuccess(`Categoria ${updatedStatus ? 'ativada' : 'inativada'} com sucesso.`);
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleReorder(index, direction) {
    if (isReordering) return;
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const currentCat = sorted[index];
    const targetCat = sorted[targetIndex];

    // Garantir ordens distintas se forem iguais
    let newCurrentOrder = targetCat.sortOrder;
    let newTargetOrder = currentCat.sortOrder;

    if (newCurrentOrder === newTargetOrder) {
      newCurrentOrder = direction === 'up' ? targetCat.sortOrder - 10 : targetCat.sortOrder + 10;
    }

    setIsReordering(true);
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const [res1, res2] = await Promise.all([
        fetch(`${API_BASE_URL}/categorias/${currentCat.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ ...currentCat, sortOrder: newCurrentOrder }),
        }),
        fetch(`${API_BASE_URL}/categorias/${targetCat.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ ...targetCat, sortOrder: newTargetOrder }),
        }),
      ]);

      if (!res1.ok || !res2.ok) throw new Error('Erro na reordenação no servidor');

      const updated1 = await res1.json();
      const updated2 = await res2.json();

      setCategories((current) =>
        current.map((cat) => {
          if (cat.id === updated1.id) return normalizeCategory(updated1);
          if (cat.id === updated2.id) return normalizeCategory(updated2);
          return cat;
        }),
      );
      showSuccess('Ordem atualizada!');
    } catch (err) {
      showError('Erro ao reordenar categorias.');
    } finally {
      setIsReordering(false);
    }
  }

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Tags className="text-red-600" />
            Categorias do Cardápio
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Organize as seções da sua loja, ajuste a ordem de exibição e ative tamanhos ou pizzas
            meio a meio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCategoryForm(null);
            setIsCategoryModalOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 shadow-md"
        >
          <Tags size={16} />
          Nova Categoria
        </button>
      </div>

      <Panel>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {sortedCategories.map((category, idx) => (
            <ListRow key={category.id} inactive={!category.isActive}>
              <div className="flex min-w-0 items-center gap-4 flex-1">
                {/* Botões de Mover Cima / Baixo */}
                <div className="flex flex-col gap-1 pr-2 border-r border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handleReorder(idx, 'up')}
                    disabled={idx === 0 || isReordering}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition"
                    title="Mover para cima"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => handleReorder(idx, 'down')}
                    disabled={idx === sortedCategories.length - 1 || isReordering}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition"
                    title="Mover para baixo"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>

                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                  {category.imageUrl ? (
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Tags size={22} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="truncate font-black text-slate-950 dark:text-white text-base">
                      {category.name}
                    </h4>
                    <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                      Ordem: {category.sortOrder}
                    </span>
                    {category.allowSizes && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 px-2 py-0.5 rounded">
                        <Layers size={12} /> Tamanhos
                      </span>
                    )}
                    {category.allowHalfAndHalf && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded">
                        <PieChart size={12} /> Meio a Meio
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {category.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleCategoryStatus(category)}
                  className={`p-2 rounded-lg border transition flex items-center gap-1.5 text-xs font-bold ${
                    category.isActive
                      ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-400'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                  title={category.isActive ? 'Clique para Inativar' : 'Clique para Ativar'}
                >
                  {category.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                  <span className="hidden sm:inline">
                    {category.isActive ? 'Visível' : 'Oculto'}
                  </span>
                </button>

                <RowActions
                  onEdit={() => editCategory(category)}
                  onDelete={() => toggleCategoryStatus(category)}
                />
              </div>
            </ListRow>
          ))}
          {sortedCategories.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-bold">
              Nenhuma categoria cadastrada ainda.
            </div>
          )}
        </div>
      </Panel>

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCategoryForm(null);
        }}
        initialData={categoryForm}
        onSave={saveCategory}
        isSaving={isSaving}
      />
    </div>
  );
}
