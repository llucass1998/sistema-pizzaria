import { formatCurrency } from '../../data/menuData.js';

const FULFILLMENT_LABELS = {
  DELIVERY: 'ENTREGA',
  PICKUP: 'RETIRADA (BALCÃO)',
  DINE_IN: 'CONSUMO NO LOCAL',
};

const PAYMENT_LABELS = {
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  PIX: 'PIX',
};

const STATUS_LABELS = {
  PENDING: 'Aguardando',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Escapa texto para evitar injeção no DOM */
function safe(value, fallback = '-') {
  if (!value || String(value).trim() === '') return fallback;
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function PrintReceipt({ order, storeName }) {
  if (!order) return null;

  const isDelivery = order.fulfillmentType === 'DELIVERY';
  const resolvedStoreName = storeName || 'Pizzaria';
  const orderCode = String(order.id).slice(0, 8).toUpperCase();
  const fulfillmentLabel =
    FULFILLMENT_LABELS[order.fulfillmentType] || order.fulfillmentType || 'PEDIDO';
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '-';
  const statusLabel = STATUS_LABELS[order.status] || order.status || '-';

  return (
    <div className="hidden print:block w-full text-black bg-white font-mono text-sm leading-tight max-w-[80mm] mx-auto p-4">
      {/* Cabeçalho */}
      <div className="text-center mb-3 pb-2 border-b-2 border-dashed border-black">
        <h1 className="text-xl font-black uppercase mb-1">{resolvedStoreName}</h1>
        <p className="font-bold text-lg">Comanda #{orderCode}</p>
        <p className="text-xs">{formatDateTime(order.createdAt)}</p>
      </div>

      {/* Tipo de Pedido */}
      <div className="text-center mb-3">
        <span className="text-lg font-black uppercase border-2 border-black px-2 py-0.5">
          {fulfillmentLabel}
        </span>
      </div>

      {/* Cliente */}
      <div className="mb-3 pb-2 border-b-2 border-dashed border-black">
        <p className="font-bold uppercase">
          Cliente: {safe(order.customer?.name, 'Não informado')}
        </p>
        {order.customer?.phone && <p className="text-xs">Tel: {safe(order.customer.phone)}</p>}
        {isDelivery && (
          <div className="mt-1 text-xs uppercase">
            <p className="font-bold">Endereço de Entrega:</p>
            {order.street && (
              <p>
                {safe(order.street)}
                {order.number ? `, ${safe(order.number)}` : ''}
              </p>
            )}
            {order.complement && <p>{safe(order.complement)}</p>}
            {order.neighborhood && <p>{safe(order.neighborhood)}</p>}
            {order.city && <p>{safe(order.city)}</p>}
          </div>
        )}
      </div>

      {/* Itens */}
      <div className="mb-3 pb-2 border-b-2 border-dashed border-black">
        <p className="font-bold uppercase text-center mb-1">--- Itens do Pedido ---</p>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-black">
              <th className="py-0.5 w-8">Qtd</th>
              <th className="py-0.5">Item</th>
              <th className="py-0.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, idx) => {
              const itemName = safe(item.displayName || item.product?.name || 'Item');
              return (
                <tr key={item.id || idx} className="border-b border-black/20 align-top">
                  <td className="py-1 font-bold">{item.quantity}x</td>
                  <td className="py-1">
                    <span className="font-bold uppercase">{itemName}</span>
                    {item.customizations && (
                      <div className="text-[10px] italic mt-0.5 ml-1 uppercase">
                        - {safe(item.customizations)}
                      </div>
                    )}
                    {/* Adicionais/opções inline */}
                    {Array.isArray(item.options) && item.options.length > 0 && (
                      <div className="text-[10px] mt-0.5 ml-1">
                        {item.options.map((opt, oi) => (
                          <span key={oi} className="block">
                            + {safe(opt.name || opt)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-1 text-right">{formatCurrency(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Observações */}
      {order.notes && (
        <div className="mb-3 pb-2 border-b-2 border-dashed border-black uppercase">
          <p className="font-bold">⚠️ Observações:</p>
          <p className="text-base font-black">{safe(order.notes)}</p>
        </div>
      )}

      {/* Totais */}
      <div className="mb-3 text-sm">
        <div className="flex justify-between mb-0.5">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal ?? 0)}</span>
        </div>
        {Number(order.deliveryFee ?? 0) > 0 && (
          <div className="flex justify-between mb-0.5">
            <span>Taxa de Entrega:</span>
            <span>{formatCurrency(order.deliveryFee)}</span>
          </div>
        )}
        {Number(order.serviceFee ?? 0) > 0 && (
          <div className="flex justify-between mb-0.5">
            <span>Taxa de Serviço:</span>
            <span>{formatCurrency(order.serviceFee)}</span>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex justify-between mb-0.5">
            <span>Desconto:</span>
            <span>- {formatCurrency(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between mt-1 pt-1 border-t border-black text-base font-black">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
        <div className="flex justify-between text-xs mt-0.5">
          <span>Pagamento:</span>
          <span className="font-bold">{paymentLabel}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Status:</span>
          <span className="font-bold uppercase">{statusLabel}</span>
        </div>
      </div>

      {/* Rodapé */}
      <div className="text-center text-xs mt-4 pt-2 border-t border-dashed border-black">
        <p className="font-bold">OBRIGADO PELA PREFERÊNCIA!</p>
        <p className="mt-0.5">{resolvedStoreName}</p>
        <p className="mt-1 italic">--- Fim da Comanda ---</p>
      </div>
    </div>
  );
}
