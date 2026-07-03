import { useEffect, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { formatCurrency } from '../../data/menuData.js';
import { Panel, ListRow, RowActions } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { ProductModal } from '../../components/admin/ProductModal.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

function normalizeProduct(product) {
  return {
    ...product,
    price: Number(product.price ?? 0),
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price ?? 0),
          sortOrder: Number(variant.sortOrder ?? 0),
          isAvailable: variant.isAvailable ?? true,
        }))
      : [],
    optionGroups: Array.isArray(product.optionGroups) ? product.optionGroups : [],
    calculatedAvailability: product.calculatedAvailability ?? null,
  };
}

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

export function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        if (!adminDataStr) return;
        const { token } = JSON.parse(adminDataStr);

        const [prodRes, catRes] = await Promise.all([
          fetch(`${API_BASE_URL}/produtos`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/categorias?includeInactive=true`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (prodRes.ok && catRes.ok && isMounted) {
          const prods = await prodRes.json();
          const cats = await catRes.json();
          setProducts((prods ?? []).map(normalizeProduct));
          setCategories((cats ?? []).map(normalizeCategory));
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

  async function saveProduct(data) {
    try {
      setIsSaving(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);
      const isEditing = Boolean(data.id);

      const response = await fetch(
        `${API_BASE_URL}${isEditing ? `/produtos/${data.id}` : '/produtos'}`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) throw new Error('Erro ao salvar produto');
      const saved = await response.json();

      setProducts((current) =>
        isEditing
          ? current.map((product) => (product.id === saved.id ? normalizeProduct(saved) : product))
          : [normalizeProduct(saved), ...current],
      );

      setProductForm(null);
      setIsProductModalOpen(false);
      showSuccess('Produto salvo com sucesso.');
    } catch (productError) {
      showError(productError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function editProduct(product) {
    setProductForm({
      id: product.id,
      name: product.name,
      barcode: product.barcode ?? '',
      category: product.category ?? 'pizzas',
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      price: product.price ?? 0,
      isAvailable: product.isAvailable ?? true,
      variants:
        product.variants?.length > 0
          ? product.variants.map((variant) => ({
              id: variant.id,
              code: variant.code,
              name: variant.name,
              price: variant.price ?? 0,
            }))
          : [],
      optionGroups: product.optionGroups ?? [],
    });
    setIsProductModalOpen(true);
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Desativar o produto ${product.name}?`)) return;
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);

      const response = await fetch(`${API_BASE_URL}/produtos/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erro ao apagar produto');

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, isAvailable: false } : item)),
      );
      showSuccess('Produto desativado.');
    } catch (productError) {
      showError(productError.message);
    }
  }

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeCategories = sortedCategories.filter((category) => category.isActive !== false);

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
            Produtos Cadastrados
          </h2>
          <p className="text-sm text-slate-500">Gerencie os itens do seu cardápio</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setProductForm(null);
            setIsProductModalOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <PackagePlus size={16} />
          Novo Produto
        </button>
      </div>

      <Panel>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {products.map((product) => (
            <ListRow key={product.id} inactive={!product.isAvailable}>
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <PackagePlus size={24} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-black text-slate-950 dark:text-white text-base">
                    {product.name}
                  </h4>
                  <p className="truncate text-sm font-bold text-slate-500 mt-0.5">
                    {product.categoryName || product.category} ·{' '}
                    <span className="text-slate-700 dark:text-slate-300">
                      {formatCurrency(product.variants?.[0]?.price ?? product.price)}
                    </span>
                  </p>
                  {product.calculatedAvailability ? (
                    <p
                      className={`mt-1 text-xs font-bold ${
                        product.calculatedAvailability.available
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {product.calculatedAvailability.available
                        ? product.calculatedAvailability.diagnostics?.some(
                            (item) => item.code === 'NO_RECIPE',
                          )
                          ? 'Vendavel sem ficha tecnica'
                          : 'Disponivel por estoque'
                        : (product.calculatedAvailability.reasons?.[0] ??
                          'Indisponivel por estoque')}
                    </p>
                  ) : null}
                </div>
              </div>
              <RowActions
                onEdit={() => editProduct(product)}
                onDelete={() => deleteProduct(product)}
              />
            </ListRow>
          ))}
          {products.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-bold">
              Nenhum produto cadastrado ainda.
            </div>
          )}
        </div>
      </Panel>

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductForm(null);
        }}
        initialData={productForm}
        categories={activeCategories}
        onSave={saveProduct}
        isSaving={isSaving}
      />
    </div>
  );
}
