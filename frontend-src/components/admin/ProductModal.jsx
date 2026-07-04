import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BaseModal } from '../ui/BaseModal.jsx';
import { Save, X, Plus, PackagePlus } from 'lucide-react';

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'O nome é obrigatório'),
  barcode: z.string().optional().nullable(),
  description: z.string().optional(),
  category: z.string().min(1, 'Selecione uma categoria'),
  price: z.number().or(z.string().transform((val) => Number(val))),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  kdsStation: z.string().optional().nullable(),
  prepTimeMinutes: z.number().or(z.string().transform((val) => val ? Number(val) : null)).optional().nullable(),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        code: z.string().min(1, 'Obrigatório'),
        name: z.string().min(1, 'Obrigatório'),
        price: z.number().or(z.string().transform((val) => Number(val))),
      }),
    )
    .default([]),
  optionGroups: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, 'Nome do grupo obrigatório'),
        description: z.string().optional(),
        isRequired: z.boolean().default(false),
        minChoices: z.number().or(z.string().transform(Number)).default(0),
        maxChoices: z.number().or(z.string().transform(Number)).default(1),
        options: z
          .array(
            z.object({
              id: z.string().optional(),
              name: z.string().min(1, 'Nome obrigatório'),
              price: z.number().or(z.string().transform(Number)).default(0),
              stockImpactType: z.string().default('NO_STOCK_IMPACT'),
              ingredientId: z.string().optional(),
              ingredientQuantity: z.number().or(z.string().transform(Number)).optional(),
              replacementIngredientId: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

const defaultVariants = [
  { code: 'P', name: 'Pequena', price: 0 },
  { code: 'M', name: 'Média', price: 0 },
  { code: 'G', name: 'Grande', price: 0 },
  { code: 'F', name: 'Família', price: 0 },
];

function OptionItemsField({ control, register, groupIndex, ingredients }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `optionGroups.${groupIndex}.options`,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Opções do Grupo
        </label>
        <button
          type="button"
          onClick={() => append({ name: '', price: 0, isAvailable: true })}
          className="text-xs font-bold text-red-600 hover:text-red-700"
        >
          + Adicionar Opção
        </button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs text-slate-500 italic">
          Nenhuma opção adicionada. O grupo não será exibido.
        </p>
      )}
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1">
              <input
                {...register(`optionGroups.${groupIndex}.options.${index}.name`)}
                placeholder="Nome (Ex: Borda Cheddar)"
                className="w-full rounded border px-2 py-1 text-sm dark:bg-slate-800 dark:text-white dark:border-slate-600"
              />
            </div>
            <div className="w-24">
              <input
                {...register(`optionGroups.${groupIndex}.options.${index}.price`)}
                type="number"
                step="0.01"
                placeholder="Preço (R$)"
                className="w-full rounded border px-2 py-1 text-sm dark:bg-slate-800 dark:text-white dark:border-slate-600"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              className="mt-1 flex-shrink-0 text-rose-500 hover:text-rose-700"
            >
              <X size={16} />
            </button>
            <div className="grid flex-[2] grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                {...register(`optionGroups.${groupIndex}.options.${index}.stockImpactType`)}
                className="rounded border px-2 py-1 text-xs dark:bg-slate-800 dark:text-white dark:border-slate-600"
              >
                <option value="NO_STOCK_IMPACT">Sem estoque</option>
                <option value="ADD_INGREDIENT">Adiciona</option>
                <option value="REMOVE_INGREDIENT">Remove</option>
                <option value="REPLACE_INGREDIENT">Substitui</option>
              </select>
              <select
                {...register(`optionGroups.${groupIndex}.options.${index}.ingredientId`)}
                className="rounded border px-2 py-1 text-xs dark:bg-slate-800 dark:text-white dark:border-slate-600"
              >
                <option value="">Ingrediente</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
              <input
                {...register(`optionGroups.${groupIndex}.options.${index}.ingredientQuantity`)}
                type="number"
                step="0.0001"
                placeholder="Qtd"
                className="rounded border px-2 py-1 text-xs dark:bg-slate-800 dark:text-white dark:border-slate-600"
              />
              <select
                {...register(`optionGroups.${groupIndex}.options.${index}.replacementIngredientId`)}
                className="rounded border px-2 py-1 text-xs dark:bg-slate-800 dark:text-white dark:border-slate-600"
              >
                <option value="">Substituto</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductModal({ isOpen, onClose, initialData, categories, onSave, isSaving }) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      barcode: '',
      description: '',
      category: categories?.[0]?.slug ?? 'pizzas',
      price: 0,
      imageUrl: '',
      isAvailable: true,
      kdsStation: '',
      prepTimeMinutes: '',
      variants: [],
      optionGroups: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'variants',
  });

  const {
    fields: groupFields,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({
    control,
    name: 'optionGroups',
  });

  // Observa a categoria selecionada para exibir os tamanhos (variantes)
  const selectedCategory = watch('category');
  const selectedCategoryConfig = categories?.find((category) => category.slug === selectedCategory);
  const allowsSizes = Boolean(
    selectedCategoryConfig?.allowSizes ||
      ['pizzas', 'pizzas-especiais', 'pizzas-tradicionais', 'pizzas-doces'].includes(
        selectedCategory,
      ),
  );

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [ingredients, setIngredients] = useState([]);

  // Efeito ao trocar categoria (injetar variants se permitir tamanhos)
  useEffect(() => {
    if (allowsSizes && fields.length === 0) {
      replace(defaultVariants);
    }
  }, [selectedCategory, allowsSizes, fields.length, replace]);

  // Limpa Object URL da preview
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!isOpen) return;
    const adminDataStr = window.localStorage.getItem('pizzaria-admin');
    if (!adminDataStr) return;
    const { token } = JSON.parse(adminDataStr);
    const apiBaseUrl = import.meta.env.PROD
      ? '/api'
      : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

    fetch(`${apiBaseUrl}/inventory/ingredients`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((items) => setIngredients(Array.isArray(items) ? items : []))
      .catch(() => setIngredients([]));
  }, [isOpen]);

  // Atualiza form quando abrir em edição
  useEffect(() => {
    if (isOpen) {
      setImageFile(null);
      setImagePreview(initialData?.imageUrl || '');
      if (initialData) {
        reset({
          ...initialData,
          variants: initialData.variants?.length
            ? initialData.variants
            : categories?.find((category) => category.slug === initialData.category)?.allowSizes ||
                initialData.category === 'pizzas' ||
                initialData.category === 'pizzas-especiais' ||
                initialData.category === 'pizzas-tradicionais' ||
                initialData.category === 'pizzas-doces'
              ? defaultVariants
              : [],
          optionGroups: initialData.optionGroups || [],
          kdsStation: initialData.kdsStation || '',
          prepTimeMinutes: initialData.prepTimeMinutes || '',
        });
      } else {
        reset({
          name: '',
          barcode: '',
          description: '',
          category: categories?.[0]?.slug ?? 'pizzas',
          price: 0,
          imageUrl: '',
          isAvailable: true,
          kdsStation: '',
          prepTimeMinutes: '',
          variants: [],
          optionGroups: [],
        });
      }
    }
  }, [isOpen, initialData, reset, categories]);

  const onSubmit = async (data) => {
    try {
      setIsUploading(true);
      let finalImageUrl = data.imageUrl || '';

      // Se a imagem foi removida pelo usuario
      if (!imagePreview) {
        finalImageUrl = '';
      }

      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        const { token } = JSON.parse(adminDataStr);

        const API_BASE_URL = import.meta.env.PROD
          ? '/api'
          : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

        const res = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || 'Falha ao fazer upload da imagem.');
        }

        const resData = await res.json();
        finalImageUrl = resData.imageUrl;
      }

      const payload = {
        ...data,
        imageUrl: finalImageUrl,
        variants: allowsSizes ? data.variants : [],
        optionGroups: data.optionGroups,
      };

      await onSave(payload);
    } catch (err) {
      alert(err.message || 'Erro ao salvar o produto');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?.id ? 'Editar Produto' : 'Novo Produto'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-1 pb-4">
        {/* Nome e Barcode */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Nome
            </label>
            <input
              {...register('name')}
              type="text"
              className={`w-full rounded-lg border p-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                errors.name
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-slate-300 focus:border-slate-500 dark:border-slate-700'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Código de Barras / SKU
            </label>
            <input
              {...register('barcode')}
              type="text"
              placeholder="EAN ou SKU"
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Categoria
          </label>
          <select
            {...register('category')}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Foto do Produto */}
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Foto do Produto
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <PackagePlus size={24} className="text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                      alert('A imagem deve ter no máximo 2MB.');
                      e.target.value = '';
                      return;
                    }
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 dark:file:bg-slate-200 dark:file:text-slate-900 dark:hover:file:bg-white"
              />
              {imagePreview && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                    }}
                    className="text-xs text-red-600 font-bold hover:underline"
                  >
                    Remover imagem
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preço Base */}
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Preço Base (R$)
          </label>
          <input
            {...register('price')}
            type="number"
            step="0.01"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Descrição (Ex: Ingredientes)
          </label>
          <textarea
            {...register('description')}
            rows="2"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-white">
            Configuração de Praça / KDS (Exceção à categoria)
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Praça Específica do Produto
              </label>
              <select
                {...register('kdsStation')}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Herdar da Categoria / Automática</option>
                <option value="GENERAL">Geral</option>
                <option value="OVEN">Forno (Pizzas, Assados)</option>
                <option value="ASSEMBLY">Montagem (Lanches, Salgados)</option>
                <option value="BEVERAGE">Bebidas (Bar, Copa)</option>
                <option value="DESSERT">Sobremesas (Confeitaria)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Tempo de Preparo Específico (min)
              </label>
              <input
                {...register('prepTimeMinutes')}
                type="number"
                min="0"
                placeholder="Ex: 15 (vazio = herdar)"
                className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Variantes para categorias com tamanhos */}
        {allowsSizes && (
          <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 p-4 dark:border-slate-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 dark:text-white">
                Tamanhos e Preços
              </p>
              <button
                type="button"
                onClick={() => append({ code: '', name: '', price: 0 })}
                className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[70px_1fr_100px_38px]"
              >
                <div>
                  <input
                    {...register(`variants.${index}.code`)}
                    placeholder="Sigla"
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 text-sm font-bold dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                  {errors.variants?.[index]?.code && (
                    <span className="text-[10px] text-red-500">Erro</span>
                  )}
                </div>
                <div>
                  <input
                    {...register(`variants.${index}.name`)}
                    placeholder="Nome"
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 text-sm font-bold dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                  {errors.variants?.[index]?.name && (
                    <span className="text-[10px] text-red-500">Erro</span>
                  )}
                </div>
                <div>
                  <input
                    {...register(`variants.${index}.price`)}
                    type="number"
                    step="0.01"
                    placeholder="Preço"
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 text-sm font-bold dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-900/20"
                  aria-label="Remover tamanho"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Grupos de Opções (Adicionais, Bordas, Meio a meio) */}
        <div className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4 dark:border-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100 dark:text-white">
              Grupos de Opções (Adicionais)
            </p>
            <button
              type="button"
              onClick={() =>
                appendGroup({
                  name: '',
                  isRequired: false,
                  minChoices: 0,
                  maxChoices: 1,
                  options: [],
                })
              }
              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
            >
              <Plus size={14} /> Novo Grupo
            </button>
          </div>

          {groupFields.map((groupField, groupIndex) => (
            <div
              key={groupField.id}
              className="relative rounded-lg border-2 border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => removeGroup(groupIndex)}
                className="absolute right-2 top-2 text-rose-500 hover:text-rose-700"
                title="Remover Grupo"
              >
                <X size={16} />
              </button>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nome do Grupo
                  </label>
                  <input
                    {...register(`optionGroups.${groupIndex}.name`)}
                    placeholder="Ex: Escolha a Borda"
                    className="w-full rounded border px-2 py-1 text-sm dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  />
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register(`optionGroups.${groupIndex}.isRequired`)}
                      className="accent-red-600"
                    />
                    Obrigatório
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-700 dark:text-slate-300">Máx</label>
                    <input
                      type="number"
                      {...register(`optionGroups.${groupIndex}.maxChoices`)}
                      className="w-12 rounded border px-1 text-xs text-center dark:bg-slate-800 dark:text-white dark:border-slate-600"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                <OptionItemsField
                  control={control}
                  register={register}
                  groupIndex={groupIndex}
                  ingredients={ingredients}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Ativo */}
        <div className="pt-2">
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" {...register('isAvailable')} className="peer sr-only" />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 dark:border-slate-700 after:bg-white dark:bg-slate-900 after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:border-slate-600 dark:bg-slate-700"></div>
            <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-100 dark:text-slate-300">
              Disponível para Venda
            </span>
          </label>
        </div>

        {/* Botoes */}
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 pt-5 dark:border-white/10 sm:flex-row">
          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 font-black text-white transition hover:bg-slate-800 disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isSaving || isUploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" />
            ) : (
              <>
                <Save size={18} /> Salvar Produto
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-black text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <X size={18} /> Cancelar
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
