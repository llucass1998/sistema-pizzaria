import { formatCurrency } from '../../data/menuData.js';

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

export function PrintReceipt({ order }) {
  if (!order) return null;

  const isDelivery = order.fulfillmentType === 'DELIVERY';

  return (
    <div className="hidden print:block w-full text-black bg-white font-mono text-sm leading-tight max-w-[80mm] mx-auto p-4">
      {/* Cabeçalho */}
      <div className="text-center mb-4 border-b-2 border-black pb-2 border-dashed">
        <h1 className="text-xl font-black uppercase mb-1">Pizzaria Rio</h1>
        <p className="font-bold text-lg mb-1">Comanda #{String(order.id).slice(0, 6).toUpperCase()}</p>
        <p>{formatDateTime(order.createdAt)}</p>
      </div>

      {/* Tipo de Pedido */}
      <div className="text-center mb-4">
        <span className="text-xl font-black uppercase border-2 border-black px-2 py-1">
          {isDelivery ? 'ENTREGA' : 'RETIRADA (BALCÃO)'}
        </span>
      </div>

      {/* Cliente */}
      <div className="mb-4 border-b-2 border-black pb-2 border-dashed">
        <p className="font-bold uppercase mb-1">Cliente: {order.customer?.name || 'Não informado'}</p>
        <p className="mb-1">Tel: {order.customer?.phone || '-'}</p>
        {isDelivery && (
          <div className="mt-2 text-sm uppercase">
            <p className="font-bold">Endereço de Entrega:</p>
            <p>{order.street}, {order.number}</p>
            {order.complement && <p>{order.complement}</p>}
            <p>{order.neighborhood}</p>
          </div>
        )}
      </div>

      {/* Itens */}
      <div className="mb-4 border-b-2 border-black pb-2 border-dashed">
        <p className="font-bold uppercase text-center mb-2">--- Itens do Pedido ---</p>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1 w-8">Qtd</th>
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, idx) => (
              <tr key={item.id || idx} className="border-b border-black/20 align-top">
                <td className="py-2 font-bold">{item.quantity}x</td>
                <td className="py-2">
                  <span className="font-bold uppercase">{item.product?.name || 'Item'}</span>
                  {item.customizations && (
                    <div className="text-xs uppercase italic mt-1 ml-2">
                      - {item.customizations}
                    </div>
                  )}
                </td>
                <td className="py-2 text-right">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Observações */}
      {order.notes && (
        <div className="mb-4 border-b-2 border-black pb-2 border-dashed uppercase">
          <p className="font-bold">Observações:</p>
          <p className="text-lg font-black">{order.notes}</p>
        </div>
      )}

      {/* Totais */}
      <div className="mb-4 text-right">
        <div className="flex justify-between mb-1">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Taxas (Entrega/Serv.):</span>
          <span>{formatCurrency(order.deliveryFee)}</span>
        </div>
        <div className="flex justify-between mt-2 pt-2 border-t border-black text-lg font-black">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>
      
      {/* Assinatura / Fim */}
      <div className="text-center mt-6 pt-4 text-xs">
        <p>OBRIGADO PELA PREFERÊNCIA!</p>
        <p className="mt-1">Pizzaria Rio - O Melhor Sabor</p>
        <p className="mt-2 italic">--- Fim da Comanda ---</p>
      </div>
    </div>
  );
}
