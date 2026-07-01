import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BaseModal } from '../ui/BaseModal.jsx';
import { Save, X } from 'lucide-react';

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'O nome é obrigatório'),
  slug: z.string().min(1, 'O slug é obrigatório'),
  description: z.string().optional(),
  icon: z.string().optional(),
  imageUrl: z.string().optional(),
  sortOrder: z.number().or(z.string().transform((val) => Number(val))),
  isActive: z.boolean().default(true),
  allowSizes: z.boolean().default(false),
  allowHalfAndHalf: z.boolean().default(false),
  halfAndHalfGroup: z.string().optional(),
});

export function CategoryModal({ isOpen, onClose, initialData, onSave, isSaving }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      icon: '',
      imageUrl: '',
      sortOrder: 0,
      isActive: true,
      allowSizes: false,
      allowHalfAndHalf: false,
      halfAndHalfGroup: '',
    },
  });

  // Atualiza o form quando entra em modo de edição
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
      } else {
        reset({
          name: '',
          slug: '',
          description: '',
          icon: '',
          imageUrl: '',
          sortOrder: 0,
          isActive: true,
          allowSizes: false,
          allowHalfAndHalf: false,
          halfAndHalfGroup: '',
        });
      }
    }
  }, [isOpen, initialData, reset]);

  // Autogerar slug baseado no nome
  const watchName = watch('name');
  useEffect(() => {
    if (!initialData?.id && watchName) {
      const slug = watchName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setValue('slug', slug, { shouldValidate: true });
    }
  }, [watchName, initialData, setValue]);

  const onSubmit = async (data) => {
    await onSave(data);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?.id ? 'Editar Categoria' : 'Nova Categoria'}
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
            placeholder="Ex: Pizzas"
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        {/* Slug */}
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Slug
          </label>
          <input
            {...register('slug')}
            type="text"
            className={`w-full rounded-lg border p-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
              errors.slug
                ? 'border-red-500 focus:border-red-500'
                : 'border-slate-300 focus:border-slate-500 dark:border-slate-700'
            }`}
          />
          {errors.slug && <p className="mt-1 text-xs text-red-500">{errors.slug.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Icone / emoji
          </label>
          <input
            {...register('icon')}
            type="text"
            maxLength={8}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="Ex: 🍕"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
            Descrição
          </label>
          <textarea
            {...register('description')}
            rows="3"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Ordem */}
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Ordem de Exibição
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
                <input type="checkbox" {...register('isActive')} className="peer sr-only" />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 dark:border-slate-700 after:bg-white dark:bg-slate-900 after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:border-slate-600 dark:bg-slate-700"></div>
                <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-100 dark:text-slate-300">
                  Ativo
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-white">
            Comportamento da categoria
          </h3>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <span>
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                  Permite tamanhos
                </span>
                <span className="block text-xs text-slate-500">
                  Exibe tamanhos no produto e exige tamanho no cardapio.
                </span>
              </span>
              <input type="checkbox" {...register('allowSizes')} className="h-5 w-5 accent-red-600" />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <span>
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                  Permite meia-meia
                </span>
                <span className="block text-xs text-slate-500">
                  Combina produtos do mesmo grupo e cobra o maior preco.
                </span>
              </span>
              <input type="checkbox" {...register('allowHalfAndHalf')} className="h-5 w-5 accent-red-600" />
            </label>

            <div>
              <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                Grupo meia-meia
              </label>
              <input
                {...register('halfAndHalfGroup')}
                type="text"
                className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Ex: pizza-doce"
              />
            </div>
          </div>
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
