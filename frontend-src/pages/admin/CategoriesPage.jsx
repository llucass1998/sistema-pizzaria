import { useEffect, useState } from 'react';
import { Tags } from 'lucide-react';
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
        
        const response = await fetch(`${API_BASE_URL}/categorias?includeInactive=true`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
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
    return () => { isMounted = false; };
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

      const response = await fetch(`${API_BASE_URL}${isEditing ? `/categorias/${data.id}` : '/categorias'}`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Erro ao salvar categoria');
      const saved = await response.json();

      setCategories((current) =>
        isEditing
          ? current.map((category) => (category.id === saved.id ? normalizeCategory(saved) : category))
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

  async function deleteCategory(category) {
    if (!window.confirm(`Desativar a categoria ${category.name}?`)) return;
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);
      
      const response = await fetch(`${API_BASE_URL}/categorias/${category.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Erro ao apagar categoria');
      
      setCategories((current) =>
        current.map((item) => (item.id === category.id ? { ...item, isActive: false } : item)),
      );
      showSuccess('Categoria desativada.');
    } catch (catError) {
      showError(catError.message);
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
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Categorias
          </h2>
          <p className="text-sm text-slate-500">Organize os produtos em sessões</p>
        </div>
        <button
          type="button"
          onClick={() => { setCategoryForm(null); setIsCategoryModalOpen(true); }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Tags size={16} />
          Nova Categoria
        </button>
      </div>

      <Panel>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {sortedCategories.map((category) => (
            <ListRow key={category.id} inactive={!category.isActive}>
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {category.imageUrl ? (
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Tags size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-black text-slate-950 dark:text-white text-base">
                    {category.name}
                  </h4>
                  <p className="truncate text-sm font-bold text-slate-500 mt-0.5">
                    Ordem de exibição: {category.sortOrder}
                  </p>
                </div>
              </div>
              <RowActions onEdit={() => editCategory(category)} onDelete={() => deleteCategory(category)} />
            </ListRow>
          ))}
          {sortedCategories.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-bold">Nenhuma categoria cadastrada ainda.</div>
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
