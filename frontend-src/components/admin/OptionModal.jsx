import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BaseModal } from '../ui/BaseModal.jsx';
import { Save, X } from 'lucide-react';

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'O nome é obrigatório'),
  description: z.string().optional(),
  price: z.number().or(z.string().transform((val) => Number(val))),
  sortOrder: z.number().or(z.string().transform((val) => Number(val))),
  isAvailable: z.boolean().default(true),
  stockImpactType: z.string().default('NO_STOCK_IMPACT'),
  ingredientId: z.string().optional(),
  ingredientQuantity: z
    .number()
    .or(z.string().transform((val) => Number(val)))
    .optional(),
  replacementIngredientId: z.string().optional(),
});

export function OptionModal({ isOpen, onClose, initialData, title, onSave, isSaving }) {
  const [ingredients, setIngredients] = useState([]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      sortOrder: 0,
      isAvailable: true,
      stockImpactType: 'NO_STOCK_IMPACT',
      ingredientId: '',
      ingredientQuantity: '',
      replacementIngredientId: '',
    },
  });
  const impactType = watch('stockImpactType');

  // Atualiza form quando abrir em edição
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
      } else {
        reset({
          name: '',
          description: '',
          price: 0,
          sortOrder: 0,
          isAvailable: true,
          stockImpactType: 'NO_STOCK_IMPACT',
          ingredientId: '',
          ingredientQuantity: '',
          replacementIngredientId: '',
        });
      }
    }
  }, [isOpen, initialData, reset]);

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

  const onSubmit = async (data) => {
    await onSave(data);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?.id ? `Editar ${title ?? 'Item'}` : `Novo ${title ?? 'Item'}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Nome */}
        <div>
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

        {/* Preço */}
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Preço (R$)
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
            Descrição (Opcional)
          </label>
          <textarea
            {...register('description')}
            rows="2"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Ordem */}
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Ordem
            </label>
            <input
              {...register('sortOrder')}
              type="number"
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Ativo */}
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Status
            </label>
            <div className="flex h-[42px] items-center">
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" {...register('isAvailable')} className="peer sr-only" />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 dark:border-slate-700 after:bg-white dark:bg-slate-900 after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:border-slate-600 dark:bg-slate-700"></div>
                <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-100 dark:text-slate-300">
                  Disponível
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Impacto no Estoque
          </label>
          <select
            {...register('stockImpactType')}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="NO_STOCK_IMPACT">Sem impacto</option>
            <option value="ADD_INGREDIENT">Adicionar insumo</option>
            <option value="REMOVE_INGREDIENT">Remover insumo base</option>
            <option value="REPLACE_INGREDIENT">Substituir insumo</option>
          </select>

          {impactType !== 'NO_STOCK_IMPACT' && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Ingrediente</label>
                <select
                  {...register('ingredientId')}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Selecione</option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Quantidade</label>
                <input
                  {...register('ingredientQuantity')}
                  type="number"
                  step="0.0001"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              {impactType === 'REPLACE_INGREDIENT' && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    Ingrediente substituto
                  </label>
                  <select
                    {...register('replacementIngredientId')}
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Selecione</option>
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name} ({ingredient.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botoes */}
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 pt-5 dark:border-white/10 sm:flex-row">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 font-black text-white transition hover:bg-slate-800 disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isSaving ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" />
            ) : (
              <>
                <Save size={18} /> Salvar
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
