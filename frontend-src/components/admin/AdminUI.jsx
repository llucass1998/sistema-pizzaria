import { BarChart3, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

export function Alert({ children, tone = 'success' }) {
  const classes =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <span
      className={`inline-flex min-h-10 max-w-full items-center rounded-lg border px-3 text-sm font-bold ${classes}`}
    >
      <span className="break-words">{children}</span>
    </span>
  );
}

export function Panel({ children, className = '' }) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ title, description, Icon = BarChart3 }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-black text-slate-950 dark:text-slate-100">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, type = 'text', placeholder = '', className = '', readOnly = false }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
      />
    </label>
  );
}

export function TextArea({ label, value, onChange, placeholder = '', className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
      />
    </label>
  );
}

export function Toggle({ checked, onChange, label = 'Ativo' }) {
  return (
    <label className="flex h-11 items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 text-sm font-black text-slate-700 dark:text-slate-300 cursor-pointer">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-slate-950"
      />
    </label>
  );
}

export function ImageInput({ imageUrl, onImageUrlChange, onImageUpload }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={24} />
        )}
      </div>
      <div className="space-y-2">
        <Field label="URL ou imagem" value={imageUrl} onChange={onImageUrlChange} />
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm font-black text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:bg-slate-950">
          <ImagePlus size={16} />
          Enviar foto
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => onImageUpload(event.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}

const orderStatusOptions = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PREPARING', label: 'Preparando' },
  { value: 'READY', label: 'Pronto' },
  { value: 'OUT_FOR_DELIVERY', label: 'Em entrega' },
  { value: 'DELIVERED', label: 'Concluído' },
  { value: 'CANCELED', label: 'Cancelado' },
];

export function getStatusLabel(status) {
  return orderStatusOptions.find((item) => item.value === status)?.label ?? status;
}

export function StatusBadge({ status }) {
  const tone =
    {
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      PREPARING: 'bg-blue-50 text-blue-700 border-blue-200',
      READY: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      OUT_FOR_DELIVERY: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      CANCELED: 'bg-rose-50 text-rose-700 border-rose-200',
    }[status] ?? 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${tone}`}>
      {getStatusLabel(status)}
    </span>
  );
}

export function MetricCard({ label, value }) {
  return (
    <Panel className="p-5">
      <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-slate-950 dark:text-slate-100 sm:text-3xl">
        {value}
      </p>
    </Panel>
  );
}

export function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={onEdit}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        title="Editar"
      >
        <Pencil size={18} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-500"
        title="Apagar"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export function ListRow({ children, inactive = false }) {
  return (
    <div
      className={`group flex items-center justify-between gap-4 p-5 transition ${inactive ? 'bg-slate-50/50 grayscale dark:bg-slate-900/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
    >
      {children}
    </div>
  );
}

export function FormActions({ isEditing, onCancel }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-6">
      <button
        type="button"
        onClick={onCancel}
        className="h-11 rounded-lg px-6 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="h-11 rounded-lg bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {isEditing ? 'Salvar Alterações' : 'Cadastrar'}
      </button>
    </div>
  );
}

export const maxImageBytes = 4 * 1024 * 1024;
export async function buildImageDataUrl(file) {
  if (!file) return '';
  if (file.size > maxImageBytes) {
    throw new Error('Imagem muito grande. Use ate 4MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}
