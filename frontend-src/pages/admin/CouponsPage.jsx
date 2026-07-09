import { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Panel, ListRow, RowActions } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { CouponModal } from '../../components/admin/CouponModal.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponForm, setCouponForm] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        if (!adminDataStr) return;
        const { token } = JSON.parse(adminDataStr);

        const response = await fetch(`${API_BASE_URL}/admin/coupons`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok && isMounted) {
          const data = await response.json();
          setCoupons(data ?? []);
        }
      } catch (err) {
        console.error('Erro ao carregar cupons:', err);
        showError('Falha ao carregar cupons.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  async function saveCoupon(data) {
    try {
      setIsSaving(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);

      const isEditing = Boolean(data.id);

      const payload = {
        ...data,
        value: Number(data.value),
        minOrderValue: data.minOrderValue ? Number(data.minOrderValue) : null,
        usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
      };

      const response = await fetch(
        `${API_BASE_URL}${isEditing ? `/admin/coupons/${data.id}` : '/admin/coupons'}`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error('Erro ao salvar cupom');
      const saved = await response.json();

      setCoupons((current) =>
        isEditing
          ? current.map((coupon) => (coupon.id === saved.id ? saved : coupon))
          : [saved, ...current],
      );

      setCouponForm(null);
      setIsCouponModalOpen(false);
      showSuccess('Cupom salvo com sucesso.');
    } catch (err) {
      showError(err.message || 'Erro ao salvar cupom.');
    } finally {
      setIsSaving(false);
    }
  }

  function editCoupon(coupon) {
    setCouponForm({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderValue: coupon.minOrderValue ?? 0,
      usageLimit: coupon.usageLimit ?? 0,
      expirationDate: coupon.expirationDate ? coupon.expirationDate.split('T')[0] : '',
      isActive: coupon.isActive ?? true,
    });
    setIsCouponModalOpen(true);
  }

  async function deleteCoupon(coupon) {
    if (!window.confirm(`Desativar o cupom ${coupon.code}?`)) return;
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      const { token } = JSON.parse(adminDataStr);

      const response = await fetch(`${API_BASE_URL}/admin/coupons/${coupon.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erro ao apagar cupom');

      setCoupons((current) =>
        current.map((item) => (item.id === coupon.id ? { ...item, isActive: false } : item)),
      );
      showSuccess('Cupom desativado com sucesso.');
    } catch (err) {
      showError(err.message || 'Erro ao desativar cupom.');
    }
  }

  const getCouponLabel = (type, value) => {
    switch (type) {
      case 'PERCENTAGE':
        return `${value}% OFF`;
      case 'FIXED':
        return `R$ ${value.toFixed(2)} OFF`;
      case 'FREE_DELIVERY':
        return 'Frete Grátis';
      default:
        return `${value}`;
    }
  };

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
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Cupons de Desconto</h2>
          <p className="text-sm text-slate-500">Gerencie campanhas e códigos promocionais</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCouponForm(null);
            setIsCouponModalOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Ticket size={16} />
          Novo Cupom
        </button>
      </div>

      <Panel>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {coupons.map((coupon) => (
            <ListRow key={coupon.id} inactive={!coupon.isActive}>
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  <Ticket size={24} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-slate-950 dark:text-slate-50 uppercase dark:text-white">
                    {coupon.code}
                  </h4>
                  <p className="break-words text-sm font-bold text-slate-500">
                    {getCouponLabel(coupon.type, coupon.value)}
                    {coupon.minOrderValue ? ` · Mínimo: R$ ${coupon.minOrderValue.toFixed(2)}` : ''}
                    {coupon.expirationDate
                      ? ` · Validade: ${new Date(coupon.expirationDate).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
              </div>
              <RowActions onEdit={() => editCoupon(coupon)} onDelete={() => deleteCoupon(coupon)} />
            </ListRow>
          ))}
          {coupons.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-bold">
              Nenhum cupom ativo no momento. Crie campanhas para alavancar vendas!
            </div>
          )}
        </div>
      </Panel>

      <CouponModal
        isOpen={isCouponModalOpen}
        onClose={() => {
          setIsCouponModalOpen(false);
          setCouponForm(null);
        }}
        initialData={couponForm}
        onSave={saveCoupon}
        isSaving={isSaving}
      />
    </div>
  );
}
