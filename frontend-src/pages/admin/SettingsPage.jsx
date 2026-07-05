import { useEffect, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Star,
  Upload,
  Store,
} from 'lucide-react';
import { Field, Panel, PanelHeader } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import pizzariaLogo from '../../assets/rio-pizzas-logo.png';
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_NAVBAR_COLOR,
  applyVisualIdentity,
  getContrastTextColor,
  isValidHexColor,
  normalizeHexColor,
} from '../../utils/visualIdentity.js';
import { DeliverySettings } from './DeliverySettings.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const visualAccept = 'image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon';

const quickColors = [
  { label: 'Vermelho da logo', value: '#970F0F' },
  { label: 'Vermelho forte', value: '#DC2626' },
  { label: 'Vinho', value: '#7F1D1D' },
  { label: 'Verde escuro', value: '#166534' },
  { label: 'Azul escuro', value: '#1E3A8A' },
  { label: 'Preto elegante', value: '#111827' },
  { label: 'Laranja', value: '#EA580C' },
];

function getAdminToken() {
  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  if (!adminDataStr) {
    throw new Error('Sessao administrativa expirada. Entre novamente.');
  }

  const { token } = JSON.parse(adminDataStr);
  if (!token) {
    throw new Error('Sessao administrativa expirada. Entre novamente.');
  }

  return token;
}

function mapSettingsToForm(data = {}) {
  return {
    storeName: data.storeName ?? '',
    hours: data.hours ?? '',
    address: data.address ?? '',
    phone: data.phone ?? '',
    whatsappNumber: data.whatsappNumber ?? '',
    pixKey: data.pixKey ?? '',
    pixMerchantName: data.pixMerchantName ?? '',
    pixCity: data.pixCity ?? '',
    deliveryFeeMode: data.deliveryFeeMode ?? 'FIXED',
    deliveryFee: data.deliveryFee ?? 0,
    serviceFee: data.serviceFee ?? 0,
    loyaltyType: data.loyaltyType ?? 'CASHBACK',
    featuredProductId: data.featuredProductId ?? '',
    logoUrl: data.logoUrl ?? '',
    faviconUrl: data.faviconUrl ?? '',
    appleTouchIconUrl: data.appleTouchIconUrl ?? '',
    openGraphImageUrl: data.openGraphImageUrl ?? '',
    navbarColor: data.navbarColor ?? DEFAULT_NAVBAR_COLOR,
    brandColor: data.brandColor ?? DEFAULT_BRAND_COLOR,
    isOpen: data.isOpen ?? true,
    isMaintenance: data.isMaintenance ?? false,
    maintenanceMessage: data.maintenanceMessage ?? '',
    notifyNewOrderWhatsApp: data.notifyNewOrderWhatsApp ?? false,
    notifyLowStockWhatsApp: data.notifyLowStockWhatsApp ?? false,
    notifyDeliveryDoneWhatsApp: data.notifyDeliveryDoneWhatsApp ?? false,
    notificationWhatsAppNumber: data.notificationWhatsAppNumber ?? '',
  };
}

function getColorError(value, label) {
  if (!String(value ?? '').trim()) {
    return '';
  }

  return isValidHexColor(value) ? '' : `${label} invalida. Use #RGB ou #RRGGBB.`;
}

function VisualAssetField({ label, hint, value, onChange, onUpload, isUploading }) {
  const inputId = `asset-${label.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-slate-100">{label}</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
      </div>

      <Field label="URL da imagem" value={value} onChange={onChange} placeholder="/uploads/..." />

      <label
        htmlFor={inputId}
        className="mt-3 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isUploading ? 'Enviando...' : 'Enviar imagem'}
        <input
          id={inputId}
          type="file"
          accept={visualAccept}
          className="sr-only"
          disabled={isUploading}
          onChange={(event) => {
            onUpload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

export function SettingsPage() {
  const [form, setForm] = useState(null);
  const [activeTab, setActiveTab] = useState('LOJA');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const { showSuccess, showError } = useToast();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [settingsRes, productsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/configuracoes`),
          fetch(`${API_BASE_URL}/pizzas`),
        ]);

        if (settingsRes.ok && isMounted) {
          const data = await settingsRes.json();
          setForm(mapSettingsToForm(data));
        }

        if (productsRes.ok && isMounted) {
          const pData = await productsRes.json();
          setProducts(pData.filter((p) => p.isAvailable !== false));
        }
      } catch (err) {
        console.error('Erro ao carregar configuracoes', err);
        showError('Falha ao carregar configuracoes da loja.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const navbarColorError = useMemo(
    () => getColorError(form?.navbarColor, 'Cor da navbar'),
    [form?.navbarColor],
  );
  const brandColorError = useMemo(
    () => getColorError(form?.brandColor, 'Cor principal da marca'),
    [form?.brandColor],
  );
  const previewNavbarColor = normalizeHexColor(form?.navbarColor, DEFAULT_NAVBAR_COLOR);
  const previewTextColor = getContrastTextColor(previewNavbarColor);
  const canSave = !isSaving && !navbarColorError && !brandColorError;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function uploadVisualAsset(field, purpose, file) {
    if (!file) return;

    try {
      setUploadingField(field);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/upload/identity/${purpose}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel enviar a imagem.');
      }

      updateField(field, data.imageUrl);
      showSuccess('Imagem enviada com sucesso.');
    } catch (err) {
      showError(err.message || 'Erro ao enviar imagem.');
    } finally {
      setUploadingField('');
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (navbarColorError || brandColorError) {
      showError(navbarColorError || brandColorError);
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        ...form,
        deliveryFee: Number(form.deliveryFee ?? 0),
        serviceFee: Number(form.serviceFee ?? 0),
        featuredProductId: form.featuredProductId || null,
        navbarColor: normalizeHexColor(form.navbarColor, DEFAULT_NAVBAR_COLOR),
        brandColor: normalizeHexColor(form.brandColor, DEFAULT_BRAND_COLOR),
      };

      const response = await fetch(`${API_BASE_URL}/configuracoes/loja`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const validationMessage = Array.isArray(responseData.errors)
          ? responseData.errors[0]?.message
          : '';
        throw new Error(
          responseData.error ||
            validationMessage ||
            responseData.message ||
            'Nao foi possivel salvar as configuracoes. Verifique os dados e tente novamente.',
        );
      }

      setForm(mapSettingsToForm(responseData));
      applyVisualIdentity(responseData);
      showSuccess('Configuracoes atualizadas com sucesso.');
    } catch (err) {
      showError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center p-6 md:p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Configurações da Loja
        </h2>
        <p className="text-sm text-slate-500">Gerencie todos os aspectos do seu sistema.</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button type="button" onClick={() => setActiveTab('LOJA')} className={`px-4 py-2 font-bold rounded-lg whitespace-nowrap ${activeTab === 'LOJA' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Loja</button>
        <button type="button" onClick={() => setActiveTab('VISUAL')} className={`px-4 py-2 font-bold rounded-lg whitespace-nowrap ${activeTab === 'VISUAL' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Visual</button>
        <button type="button" onClick={() => setActiveTab('ENTREGA')} className={`px-4 py-2 font-bold rounded-lg whitespace-nowrap ${activeTab === 'ENTREGA' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Entrega e Taxas</button>
        <button type="button" onClick={() => setActiveTab('FIDELIDADE')} className={`px-4 py-2 font-bold rounded-lg whitespace-nowrap ${activeTab === 'FIDELIDADE' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Fidelidade</button>
        <button type="button" onClick={() => setActiveTab('NOTIFICACOES')} className={`px-4 py-2 font-bold rounded-lg whitespace-nowrap ${activeTab === 'NOTIFICACOES' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Notificações (WhatsApp)</button>
      </div>

      <Panel>
        <form onSubmit={saveSettings} className="p-5">
          <div className={activeTab === 'LOJA' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200">
                  <Store className="h-4 w-4 text-emerald-600" />
                  Status da Loja
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Controle manualmente se a loja está aceitando pedidos ou não.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updateField('isOpen', true)}
                className={`relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  form.isOpen
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:border-emerald-500/50 dark:bg-emerald-500/10'
                    : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900/50'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${form.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                  <span className="text-xl">🟢</span>
                </div>
                <div>
                  <h4 className={`font-black ${form.isOpen ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>Aberta para pedidos</h4>
                  <p className={`text-sm ${form.isOpen ? 'text-emerald-700 dark:text-emerald-500/80' : 'text-slate-500'}`}>Clientes podem ver o cardápio e fazer pedidos normalmente.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateField('isOpen', false)}
                className={`relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  !form.isOpen
                    ? 'border-red-500 bg-red-50 ring-1 ring-red-500 dark:border-red-500/50 dark:bg-red-500/10'
                    : 'border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-red-900/50'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${!form.isOpen ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                  <span className="text-xl">🔴</span>
                </div>
                <div>
                  <h4 className={`font-black ${!form.isOpen ? 'text-red-900 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>Fechada no momento</h4>
                  <p className={`text-sm ${!form.isOpen ? 'text-red-700 dark:text-red-500/80' : 'text-slate-500'}`}>Clientes podem ver o cardápio, mas finalização é bloqueada.</p>
                </div>
              </button>
            </div>
            </div>
          </div>
          
          <div className={activeTab === 'VISUAL' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200">
                  <Palette className="h-4 w-4 text-red-600" />
                  Identidade Visual
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Logo, icones e cor da navbar usados no site publico.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateField('navbarColor', DEFAULT_NAVBAR_COLOR);
                  updateField('brandColor', DEFAULT_BRAND_COLOR);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar padrao
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <VisualAssetField
                label="Logo principal"
                hint="Usada no header e destaque da home."
                value={form.logoUrl}
                onChange={(value) => updateField('logoUrl', value)}
                onUpload={(file) => uploadVisualAsset('logoUrl', 'logo', file)}
                isUploading={uploadingField === 'logoUrl'}
              />
              <VisualAssetField
                label="Favicon"
                hint="Icone da aba do navegador."
                value={form.faviconUrl}
                onChange={(value) => updateField('faviconUrl', value)}
                onUpload={(file) => uploadVisualAsset('faviconUrl', 'favicon', file)}
                isUploading={uploadingField === 'faviconUrl'}
              />
              <VisualAssetField
                label="Apple Touch Icon"
                hint="Icone usado ao salvar no celular."
                value={form.appleTouchIconUrl}
                onChange={(value) => updateField('appleTouchIconUrl', value)}
                onUpload={(file) => uploadVisualAsset('appleTouchIconUrl', 'appleTouchIcon', file)}
                isUploading={uploadingField === 'appleTouchIconUrl'}
              />
              <VisualAssetField
                label="Imagem Open Graph"
                hint="Imagem para compartilhamento em redes sociais."
                value={form.openGraphImageUrl}
                onChange={(value) => updateField('openGraphImageUrl', value)}
                onUpload={(file) => uploadVisualAsset('openGraphImageUrl', 'openGraph', file)}
                isUploading={uploadingField === 'openGraphImageUrl'}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
              <div className="space-y-4">
                <div>
                  <span className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                    Cor da Navbar
                  </span>
                  <div className="grid gap-3 sm:grid-cols-[52px_minmax(0,1fr)]">
                    <input
                      type="color"
                      value={previewNavbarColor}
                      onChange={(event) => updateField('navbarColor', event.target.value.toUpperCase())}
                      className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950"
                      aria-label="Selecionar cor da navbar"
                    />
                    <input
                      type="text"
                      value={form.navbarColor}
                      onChange={(event) => updateField('navbarColor', event.target.value)}
                      placeholder={DEFAULT_NAVBAR_COLOR}
                      className={`h-11 w-full rounded-lg border bg-white px-3 text-sm font-bold uppercase text-slate-900 outline-none transition focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
                        navbarColorError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100 dark:border-red-900 dark:focus:ring-red-950'
                          : 'border-slate-200 focus:border-slate-400 focus:ring-slate-100 dark:border-slate-800 dark:focus:border-slate-600 dark:focus:ring-slate-900'
                      }`}
                    />
                  </div>
                  {navbarColorError ? (
                    <p className="mt-2 text-xs font-bold text-red-600">{navbarColorError}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      title={color.label}
                      aria-label={`Usar ${color.label}`}
                      onClick={() => updateField('navbarColor', color.value)}
                      className="h-9 w-9 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-950 dark:ring-slate-700"
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </div>

                <div>
                  <span className="mb-2 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                    Cor principal da marca
                  </span>
                  <div className="grid gap-3 sm:grid-cols-[52px_minmax(0,1fr)]">
                    <input
                      type="color"
                      value={normalizeHexColor(form.brandColor, DEFAULT_BRAND_COLOR)}
                      onChange={(event) => updateField('brandColor', event.target.value.toUpperCase())}
                      className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950"
                      aria-label="Selecionar cor principal da marca"
                    />
                    <input
                      type="text"
                      value={form.brandColor}
                      onChange={(event) => updateField('brandColor', event.target.value)}
                      placeholder={DEFAULT_BRAND_COLOR}
                      className={`h-11 w-full rounded-lg border bg-white px-3 text-sm font-bold uppercase text-slate-900 outline-none transition focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
                        brandColorError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100 dark:border-red-900 dark:focus:ring-red-950'
                          : 'border-slate-200 focus:border-slate-400 focus:ring-slate-100 dark:border-slate-800 dark:focus:border-slate-600 dark:focus:ring-slate-900'
                      }`}
                    />
                  </div>
                  {brandColorError ? (
                    <p className="mt-2 text-xs font-bold text-red-600">{brandColorError}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <span className="mb-3 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                  Preview da navbar
                </span>
                <div
                  className="flex min-h-16 items-center justify-between gap-3 rounded-lg px-3 py-3 shadow-sm"
                  style={{ backgroundColor: previewNavbarColor, color: previewTextColor }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src={form.logoUrl || pizzariaLogo}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full bg-white/15 object-contain"
                    />
                    <span className="truncate text-sm font-black uppercase">
                      {form.storeName || 'Rio de Janeiro Pizzas'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="h-9 w-9 rounded-full bg-white/15" />
                    <span className="h-9 w-9 rounded-full bg-white/15" />
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
          
          <div className={activeTab === 'LOJA' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <Star className="h-4 w-4 text-amber-500" />
              Mais pedido da noite
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Escolha qual produto aparece em destaque na pagina inicial.
            </p>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={form.featuredProductId}
              onChange={(event) => updateField('featuredProductId', event.target.value)}
            >
              <option value="">-- Nenhum destaque --</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (R$ {Number(product.price).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Nome da loja"
            value={form.storeName}
            onChange={(value) => updateField('storeName', value)}
          />
          <Field
            label="Horario"
            value={form.hours}
            onChange={(value) => updateField('hours', value)}
          />
          <Field
            label="Endereco"
            value={form.address}
            onChange={(value) => updateField('address', value)}
            className="md:col-span-2"
          />
          <Field label="Telefone" value={form.phone} onChange={(value) => updateField('phone', value)} />
          <Field
            label="WhatsApp"
            value={form.whatsappNumber}
            onChange={(value) => updateField('whatsappNumber', value)}
          />
          <Field label="Chave PIX" value={form.pixKey} onChange={(value) => updateField('pixKey', value)} />
          <Field
            label="Nome PIX"
            value={form.pixMerchantName}
            onChange={(value) => updateField('pixMerchantName', value)}
          />
          <Field label="Cidade PIX" value={form.pixCity} onChange={(value) => updateField('pixCity', value)} />
          </div>

          <div className={activeTab === 'ENTREGA' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
            <Field
              label="Taxa de entrega (R$)"
            value={form.deliveryFee}
            onChange={(value) => updateField('deliveryFee', value)}
            type="number"
          />
          <Field
            label="Taxa de servico (R$)"
            value={form.serviceFee}
            onChange={(value) => updateField('serviceFee', value)}
            type="number"
            />
          </div>

          <div className={activeTab === 'LOJA' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">
              <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">
              Modo Manutenção
            </h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Status da Loja</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Bloqueia o site público com uma tela de manutenção (não afeta o PDV e ADM).
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={form.isMaintenance}
                  onChange={(e) => updateField('isMaintenance', e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-red-800"></div>
                <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-300">
                  {form.isMaintenance ? 'Manutenção Ativada' : 'Loja Online'}
                </span>
              </label>
            </div>
            
            {form.isMaintenance && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Field
                  label="Mensagem Personalizada"
                  value={form.maintenanceMessage}
                  onChange={(value) => updateField('maintenanceMessage', value)}
                  placeholder="Voltamos em breve! Estamos realizando melhorias na loja."
                />
              </div>
            )}
            </div>
          </div>

          <div className={activeTab === 'FIDELIDADE' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">
              <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">
              Programa de Fidelidade (CRM)
            </h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Mecanica ativa</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Escolha entre Cashback em % ou Sistema de Selos.
                </p>
              </div>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:w-auto"
                value={form.loyaltyType || 'CASHBACK'}
                onChange={(event) => updateField('loyaltyType', event.target.value)}
              >
                <option value="CASHBACK">Cashback (Retorno em Saldo)</option>
                <option value="POINTS">Selos (Fatia de Pizza)</option>
              </select>
            </div>
          </div>
          </div>

          <div className={activeTab === 'NOTIFICACOES' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:col-span-2">
              <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                Notificações via WhatsApp
              </h3>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Configure alertas automáticos para você (loja) ou clientes.</p>
              
              <Field
                label="Número WhatsApp p/ Alertas (Admin)"
                value={form.notificationWhatsAppNumber}
                onChange={(value) => updateField('notificationWhatsAppNumber', value)}
                placeholder="Ex: 5511999999999"
                className="mb-4"
              />

              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={form.notifyNewOrderWhatsApp} onChange={e => updateField('notifyNewOrderWhatsApp', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Receber alerta de novo pedido no painel</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={form.notifyLowStockWhatsApp} onChange={e => updateField('notifyLowStockWhatsApp', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Receber alerta de estoque crítico (Insumos)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={form.notifyDeliveryDoneWhatsApp} onChange={e => updateField('notifyDeliveryDoneWhatsApp', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notificar cliente quando o pedido for entregue (WIP)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t mt-6 border-slate-200 dark:border-slate-800 md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:w-auto"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Salvando...' : 'Salvar configuracoes'}
            </button>
          </div>
        </form>
      </Panel>

      <div className={activeTab === 'ENTREGA' ? 'mt-6 block' : 'hidden'}>
        <DeliverySettings
        deliveryFeeMode={form.deliveryFeeMode || 'FIXED'}
        onModeChange={(mode) => {
          updateField('deliveryFeeMode', mode);
          // Auto-save the mode if possible, but the user has to click save anyway
          // Wait, they have to click 'Salvar configuracoes' above to save. 
          // So just updating the field is enough.
        }}
      />
      </div>
    </div>
  );
}
