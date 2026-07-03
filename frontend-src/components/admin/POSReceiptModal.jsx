import React from 'react';
import { formatCurrency } from '../../data/menuData.js';
import { Printer, Check, X } from 'lucide-react';

export function POSReceiptModal({ isOpen, onClose, orderData }) {
  if (!isOpen || !orderData) return null;

  const {
    order,
    cartSnapshot = [],
    cartTotal = 0,
    paymentMethod = 'CASH',
    receivedAmount = 0,
    changeAmount = 0,
    date = new Date().toLocaleString('pt-BR'),
    storeName = 'Pizzaria Rio',
  } = orderData;

  const paymentLabels = {
    CASH: 'Dinheiro',
    PIX: 'PIX',
    DEBIT_CARD: 'Cartão de Débito',
    CREDIT_CARD: 'Cartão de Crédito',
  };

  const paymentLabel = paymentLabels[paymentMethod] || paymentMethod;
  const itemsList = order?.items || cartSnapshot || [];
  const totalVal = order?.total || cartTotal || 0;
  const subtotalVal = order?.subtotal || cartTotal || 0;
  const feeVal = order?.deliveryFee || 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm no-print"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal (não sai na impressão) */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 no-print">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black">
            <Check className="w-5 h-5" />
            <span>Venda Finalizada!</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Área de visualização do Cupom (E área printável) */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-800 flex justify-center">
          <div
            id="printable-receipt"
            className="w-full max-w-[80mm] bg-white text-black font-mono text-xs leading-tight p-4 shadow-md rounded border border-slate-200"
          >
            {/* Cabeçalho da Loja */}
            <div className="text-center mb-3 border-b-2 border-black pb-2 border-dashed">
              <h1 className="text-base font-black uppercase mb-1">{storeName}</h1>
              <p className="font-bold text-sm">
                Pedido #{String(order?.id || 'BALCAO').slice(0, 8).toUpperCase()}
              </p>
              <p className="text-[10px] mt-0.5">{date}</p>
            </div>

            {/* Tipo de Pedido */}
            <div className="text-center mb-3">
              <span className="font-black text-xs uppercase border border-black px-2 py-0.5 inline-block">
                {order?.fulfillmentType === 'DELIVERY' ? 'ENTREGA' : 'RETIRADA (BALCÃO)'}
              </span>
            </div>

            {/* Cliente */}
            {order?.customer?.name && (
              <div className="mb-3 border-b-2 border-black pb-2 border-dashed text-[11px]">
                <p className="font-bold uppercase">Cliente: {order.customer.name}</p>
                {order.customer.phone && <p>Tel: {order.customer.phone}</p>}
              </div>
            )}

            {/* Itens */}
            <div className="mb-3 border-b-2 border-black pb-2 border-dashed">
              <p className="font-bold uppercase text-center text-[10px] mb-1.5">--- Itens do Pedido ---</p>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-1 w-6">Qtd</th>
                    <th className="py-1">Descricao</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsList.map((item, idx) => (
                    <tr key={item.id || item.cartId || idx} className="border-b border-black/10 align-top">
                      <td className="py-1 font-bold">{item.quantity}x</td>
                      <td className="py-1 pr-1">
                        <span className="font-bold uppercase block">
                          {item.product?.name || item.name || 'Item'}
                        </span>
                        {(item.variantName || item.customizations) && (
                          <span className="text-[10px] text-gray-600 uppercase block">
                            {item.variantName || item.customizations}
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right font-medium">
                        {formatCurrency(item.total || item.price * item.quantity || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Observações */}
            {order?.notes && (
              <div className="mb-3 border-b-2 border-black pb-2 border-dashed text-[11px] uppercase">
                <p className="font-bold">Observações:</p>
                <p>{order.notes}</p>
              </div>
            )}

            {/* Totais */}
            <div className="mb-3 text-right text-[11px]">
              <div className="flex justify-between mb-0.5">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotalVal)}</span>
              </div>
              {Number(feeVal) > 0 && (
                <div className="flex justify-between mb-0.5">
                  <span>Taxas:</span>
                  <span>{formatCurrency(feeVal)}</span>
                </div>
              )}
              <div className="flex justify-between mt-1 pt-1 border-t border-black font-black text-sm">
                <span>TOTAL:</span>
                <span>{formatCurrency(totalVal)}</span>
              </div>
            </div>

            {/* Forma de Pagamento e Troco */}
            <div className="mb-3 border-t-2 border-black pt-2 border-dashed text-[11px]">
              <div className="flex justify-between mb-0.5">
                <span className="font-bold">Pagamento:</span>
                <span className="font-bold uppercase">{paymentLabel}</span>
              </div>
              {paymentMethod === 'CASH' && Number(receivedAmount) > 0 && (
                <>
                  <div className="flex justify-between mb-0.5">
                    <span>Recebido:</span>
                    <span>{formatCurrency(receivedAmount)}</span>
                  </div>
                  <div className="flex justify-between font-black text-xs mt-0.5">
                    <span>TROCO:</span>
                    <span>{formatCurrency(changeAmount)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Rodapé Obrigatório */}
            <div className="text-center mt-4 pt-2 border-t border-black text-[10px] leading-relaxed">
              <p className="font-black tracking-wider uppercase">*** DOCUMENTO NÃO FISCAL ***</p>
              <p className="mt-1 font-medium">Obrigado pela preferência!</p>
              <p className="mt-0.5 text-[9px] text-gray-500">Sistema de Gestão - Pizzaria Rio</p>
            </div>
          </div>
        </div>

        {/* Rodapé com Botões (não sai na impressão) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-2 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg hover:shadow-red-600/20 active:scale-[0.98]"
          >
            <Printer className="w-5 h-5" />
            <span>Imprimir Cupom (80mm)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Concluir / Nova Venda
          </button>
        </div>
      </div>
    </div>
  );
}
