import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BaseModal } from '../ui/BaseModal.jsx';
import { Save, X } from 'lucide-react';

const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(3, 'O código deve ter pelo menos 3 caracteres'),
  type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_DELIVERY']),
  value: z
    .number()
    .or(z.string().transform((val) => Number(val)))
    .refine((val) => val > 0, 'O valor deve ser maior que zero'),
  minOrderValue: z
    .number()
    .or(z.string().transform((val) => Number(val)))
    .nullable()
    .optional(),
  expirationDate: z.string().nullable().optional(),
  maxUses: z
    .number()
    .or(z.string().transform((val) => Number(val)))
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});

export function CouponModal({ isOpen, onClose, initialData, onSave, isSaving }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: '',
      type: 'PERCENTAGE',
      value: 0,
      minOrderValue: null,
      expirationDate: '',
      maxUses: null,
      isActive: true,
    },
  });

  const watchType = watch('type');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          ...initialData,
          expirationDate: initialData.expirationDate
            ? initialData.expirationDate.split('T')[0]
            : '',
        });
      } else {
        reset({
          code: '',
          type: 'PERCENTAGE',
          value: 0,
          minOrderValue: null,
          expirationDate: '',
          maxUses: null,
          isActive: true,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (data) => {
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      // Could set custom error here, but Zod should handle it if we added refine. For now let's just alert.
      alert('Cupom percentual não pode ser maior que 100%.');
      return;
    }
    await onSave(data);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?.id ? 'Editar Cupom' : 'Novo Cupom'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Code & Type */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Código
            </label>
            <input
              {...register('code')}
              type="text"
              placeholder="PROMO20"
              className={`w-full uppercase rounded-lg border p-2 text-sm focus:outline-none dark:bg-slate-800 dark:text-white ${
                errors.code
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-slate-300 focus:border-slate-500 dark:border-slate-700'
              }`}
            />
            {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Tipo de Desconto
            </label>
            <select
              {...register('type')}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="PERCENTAGE">Porcentagem (%)</option>
              <option value="FIXED">Valor Fixo (R$)</option>
              <option value="FREE_DELIVERY">Frete Grátis</option>
            </select>
          </div>
        </div>

        {/* Valor e Pedido Mínimo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Valor do Desconto
            </label>
            <input
              {...register('value')}
              type="number"
              step="0.01"
              disabled={watchType === 'FREE_DELIVERY'}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
            />
            {errors.value && <p className="mt-1 text-xs text-red-500">{errors.value.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Pedido Mínimo (Opcional)
            </label>
            <input
              {...register('minOrderValue')}
              type="number"
              step="0.01"
              placeholder="Ex: 50.00"
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Validade e Uso Máximo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Validade (Opcional)
            </label>
            <input
              {...register('expirationDate')}
              type="date"
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Limite de Usos (Opcional)
            </label>
            <input
              {...register('maxUses')}
              type="number"
              placeholder="Ex: 100"
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
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
                Cupom Ativo
              </span>
            </label>
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
                <Save size={18} /> Salvar Cupom
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
