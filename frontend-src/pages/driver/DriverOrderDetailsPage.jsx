import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import {
  confirmDelivery,
  getDriverOrder,
  reportDeliveryFailure,
  reportLocation,
  uploadProof,
} from './driverApi.js';

function money(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildAddress(order) {
  return [order?.street, order?.number, order?.neighborhood, order?.complement]
    .filter(Boolean)
    .join(', ');
}

function getPhoneHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : '';
}

function getWhatsAppHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

async function captureLocation() {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export default function DriverOrderDetailsPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [receivedBy, setReceivedBy] = useState('');
  const [note, setNote] = useState('');
  const [failureReason, setFailureReason] = useState('Cliente ausente');
  const [proofFile, setProofFile] = useState(null);
  const [proofUrl, setProofUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const address = useMemo(() => buildAddress(order), [order]);
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : '';
  const phoneHref = getPhoneHref(order?.customer?.phone);
  const whatsAppHref = getWhatsAppHref(order?.customer?.phone);

  async function loadOrder() {
    try {
      setError('');
      setIsLoading(true);
      const data = await getDriverOrder(orderId);
      setOrder(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar pedido.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  async function uploadSelectedProof() {
    if (!proofFile) return proofUrl || null;
    const event = await uploadProof(orderId, proofFile);
    const nextProofUrl = event?.metadata?.proofUrl;
    if (nextProofUrl) setProofUrl(nextProofUrl);
    return nextProofUrl || null;
  }

  async function handleSendLocation() {
    try {
      setError('');
      setSuccess('');
      setIsSubmitting(true);
      const location = await captureLocation();
      if (!location) {
        setError('Nao foi possivel obter a localizacao deste aparelho.');
        return;
      }
      await reportLocation(orderId, location);
      setSuccess('Localizacao registrada com sucesso.');
      await loadOrder();
    } catch (locationError) {
      setError(
        locationError instanceof Error ? locationError.message : 'Erro ao registrar localizacao.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelivery() {
    try {
      setError('');
      setSuccess('');
      setIsSubmitting(true);
      const location = await captureLocation();
      const nextProofUrl = await uploadSelectedProof();
      const updated = await confirmDelivery(orderId, {
        receivedBy,
        note,
        proofUrl: nextProofUrl,
        ...(location ? { location } : {}),
      });
      setOrder(updated);
      setSuccess('Entrega confirmada com sucesso.');
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Erro ao confirmar entrega.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeliveryFailure() {
    try {
      setError('');
      setSuccess('');
      setIsSubmitting(true);
      const location = await captureLocation();
      await reportDeliveryFailure(orderId, {
        reason: failureReason,
        note,
        ...(location ? { location } : {}),
      });
      setSuccess('Falha de entrega registrada para o despacho.');
      await loadOrder();
    } catch (failureError) {
      setError(failureError instanceof Error ? failureError.message : 'Erro ao registrar falha.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/70">
        <Loader2 size={24} className="mr-2 animate-spin" /> Carregando pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5 text-red-100">
        <p className="font-bold">{error || 'Pedido nao encontrado.'}</p>
        <Link
          to="/motoboy"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
        >
          <ArrowLeft size={16} /> Voltar
        </Link>
      </section>
    );
  }

  const isDelivered = order.status === 'DELIVERED';

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/motoboy')}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white"
      >
        <ArrowLeft size={17} /> Voltar
      </button>

      <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Pedido #{order.id.slice(0, 8)}
            </p>
            <h1 className="mt-1 text-2xl font-black">{order.customer?.name || 'Cliente'}</h1>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${isDelivered ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}
          >
            {isDelivered ? 'Entregue' : 'Em rota'}
          </span>
        </div>

        <div className="mt-5 space-y-3 text-sm font-bold text-slate-600">
          <p className="flex items-start gap-2">
            <MapPin size={18} className="mt-0.5 shrink-0 text-red-600" />{' '}
            {address || 'Endereço não informado'}
          </p>
          {order.customer?.phone ? (
            <p className="flex items-center gap-2">
              <Phone size={18} className="text-red-600" /> {order.customer.phone}
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 py-4 text-sm font-black text-white"
            >
              <Navigation size={18} /> Abrir rota
            </a>
          ) : null}
          {phoneHref ? (
            <a
              href={phoneHref}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 py-4 text-sm font-black text-white"
            >
              <Phone size={18} /> Ligar
            </a>
          ) : null}
          {whatsAppHref ? (
            <a
              href={whatsAppHref}
              target="_blank"
              rel="noreferrer"
              className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-4 text-sm font-black text-white"
            >
              <Send size={18} /> Chamar no WhatsApp
            </a>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-xl">
        <h2 className="text-lg font-black">Itens do pedido</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {(order.items || []).map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-black">
                  {item.quantity}x {item.displayName || item.product?.name || 'Item'}
                </p>
                {item.variantName ? (
                  <p className="font-bold text-slate-500">{item.variantName}</p>
                ) : null}
                {item.optionsSnapshot ? (
                  <p className="font-bold text-slate-500">{item.optionsSnapshot}</p>
                ) : null}
              </div>
              <span className="font-black">{money(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-lg font-black">
          <span>Total</span>
          <span>{money(order.total)}</span>
        </div>
        <p className="mt-1 text-sm font-bold text-slate-500">
          Pagamento: {order.paymentMethod || 'Não informado'} · {order.paymentStatus || 'PENDING'}
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          <AlertTriangle size={20} /> {error}
        </div>
      ) : null}
      {success ? (
        <div className="flex items-start gap-3 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
          <CheckCircle2 size={20} /> {success}
        </div>
      ) : null}

      {!isDelivered ? (
        <div className="space-y-3 rounded-3xl bg-white p-5 text-slate-950 shadow-xl">
          <h2 className="text-lg font-black">Finalizar atendimento</h2>
          <label className="block">
            <span className="text-sm font-black text-slate-700">Recebido por</span>
            <input
              value={receivedBy}
              onChange={(event) => setReceivedBy(event.target.value)}
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none focus:border-red-600"
              placeholder="Nome de quem recebeu"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-700">Observação</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-red-600"
              placeholder="Opcional"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-slate-700">Comprovante/foto opcional</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setProofFile(event.target.files?.[0] || null)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"
            />
          </label>
          <button
            type="button"
            onClick={handleConfirmDelivery}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-base font-black text-white disabled:opacity-60"
          >
            {isSubmitting ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              <CheckCircle2 size={20} />
            )}
            Confirmar entrega
          </button>
        </div>
      ) : null}

      {!isDelivered ? (
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-black">Problema na entrega</h2>
          <select
            value={failureReason}
            onChange={(event) => setFailureReason(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-black text-white outline-none"
          >
            <option>Cliente ausente</option>
            <option>Endereço não localizado</option>
            <option>Cliente recusou o pedido</option>
            <option>Problema no pagamento</option>
            <option>Outro motivo</option>
          </select>
          <button
            type="button"
            onClick={handleDeliveryFailure}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-4 text-base font-black text-red-100 disabled:opacity-60"
          >
            <XCircle size={20} /> Registrar falha
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSendLocation}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-black text-white disabled:opacity-60"
      >
        <Camera size={18} /> Registrar localização atual
      </button>
    </section>
  );
}
