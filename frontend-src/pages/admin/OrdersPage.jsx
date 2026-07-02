import { useEffect, useState, useRef, useCallback } from 'react';
import { Printer, FileText } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrency } from '../../data/menuData.js';
import { PrintReceipt } from '../../components/admin/PrintReceipt.jsx';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (error) {
    console.error('Audio not supported or blocked:', error);
  }
}

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState('connecting');
  const [printingOrder, setPrintingOrder] = useState(null);
  const { showSuccess, showError } = useToast();
  const eventSourceRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  function handlePrint(order) {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  }
  
  // Keep track of pending order IDs to know when a NEW one arrives
  const knownPendingIds = useRef(new Set());

  const closePrint = () => {
    setPrintingOrder(null);
  }

  function getAdminSession() {
    try {
      return JSON.parse(window.localStorage.getItem('pizzaria-admin') ?? 'null');
    } catch {
      return null;
    }
  }

  function stopPollingFallback() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }

  const mergeOrder = useCallback((incomingOrder) => {
    if (!incomingOrder?.id) return;

    setOrders((current) => {
      const exists = current.some((order) => order.id === incomingOrder.id);
      const nextOrders = exists
        ? current.map((order) => (order.id === incomingOrder.id ? { ...order, ...incomingOrder } : order))
        : [incomingOrder, ...current];

      return nextOrders.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
    });

    if (incomingOrder.status === 'PENDING' && !knownPendingIds.current.has(incomingOrder.id)) {
      knownPendingIds.current.add(incomingOrder.id);
      playBeep();
    }

    if (incomingOrder.status !== 'PENDING') {
      knownPendingIds.current.delete(incomingOrder.id);
    }
  }, []);

  async function handleIssueNfce(order) {
    if (!window.confirm('Registrar fiscal demonstrativo para este pedido? Nenhuma NFC-e real sera emitida.')) return;
    try {
      const tenantId = window.localStorage.getItem('pizzaria-tenant-id') || '';
      const headers = { 'Content-Type': 'application/json' };
      const token = window.localStorage.getItem('pizzaria-admin-token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/admin/fiscal/orders/${order.id}/issue`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        showSuccess('Fiscal demonstrativo registrado. Nenhuma NFC-e real foi emitida.');
        fetchOrders();
      } else {
        const err = await res.json();
        showError(`Erro: ${err.message || 'Falha ao emitir'}`);
      }
    } catch (err) {
      showError('Erro ao emitir NFC-e.');
    }
  }

  const fetchOrders = useCallback(async (isPolling = false) => {
    try {
      const adminData = getAdminSession();
      if (!adminData?.token) return;
      
      const response = await fetch(`${API_BASE_URL}/pedidos?limit=80`, {
        headers: {
          'Authorization': `Bearer ${adminData.token}`
        }
      });
      
      if (!response.ok) throw new Error('Falha ao buscar pedidos');
      
      const payload = await response.json();
      const newOrders = Array.isArray(payload) ? payload : (payload?.data ?? []);
      
      if (isPolling) {
        // Check for new pending orders
        const currentPendingIds = new Set(
          newOrders.filter(o => o.status === 'PENDING').map(o => o.id)
        );
        
        let hasNewPending = false;
        for (const id of currentPendingIds) {
          if (!knownPendingIds.current.has(id)) {
            hasNewPending = true;
            break;
          }
        }
        
        if (hasNewPending) {
          playBeep();
        }
        knownPendingIds.current = currentPendingIds;
      } else {
        // Initial load
        knownPendingIds.current = new Set(
          newOrders.filter(o => o.status === 'PENDING').map(o => o.id)
        );
      }
      
      setOrders(newOrders);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar os pedidos. O sistema continuará tentando.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return;
    fetchOrders(true);
    pollingIntervalRef.current = setInterval(() => {
      fetchOrders(true);
    }, 20000);
  }, [fetchOrders]);

  const connectOrderEvents = useCallback(() => {
    const adminData = getAdminSession();
    if (!adminData?.token || typeof EventSource === 'undefined') {
      setLiveStatus('polling');
      startPollingFallback();
      return;
    }

    eventSourceRef.current?.close();
    setLiveStatus('connecting');

    const source = new EventSource(`${API_BASE_URL}/orders/events`, {
      withCredentials: true,
    });
    eventSourceRef.current = source;

    source.addEventListener('connected', () => {
      setLiveStatus('connected');
      setError('');
      stopPollingFallback();
    });

    source.addEventListener('order-created', (event) => {
      mergeOrder(JSON.parse(event.data));
    });

    source.addEventListener('order-updated', (event) => {
      mergeOrder(JSON.parse(event.data));
    });

    source.addEventListener('order-assigned', (event) => {
      mergeOrder(JSON.parse(event.data));
    });

    source.addEventListener('order-status-changed', (event) => {
      const payload = JSON.parse(event.data);
      setOrders((current) =>
        current.map((order) =>
          order.id === payload.id ? { ...order, status: payload.status, updatedAt: payload.updatedAt ?? order.updatedAt } : order,
        ),
      );

      if (payload.status !== 'PENDING') {
        knownPendingIds.current.delete(payload.id);
      }
    });

    source.onerror = () => {
      setLiveStatus('polling');
      setError('Conexao em tempo real caiu. Usando atualizacao automatica.');
      source.close();
      startPollingFallback();
      reconnectTimeoutRef.current = setTimeout(connectOrderEvents, 10000);
    };
  }, [fetchOrders, mergeOrder, startPollingFallback]);

  // Initial load and live updates setup
  useEffect(() => {
    let isMounted = true;
    
    fetchOrders().then(() => {
      if (!isMounted) return;
      connectOrderEvents();
    });

    return () => {
      isMounted = false;
      eventSourceRef.current?.close();
      stopPollingFallback();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectOrderEvents, fetchOrders]);

  async function updateOrderStatus(orderId, status) {
    try {
      const adminData = getAdminSession();
      if (!adminData?.token) return;

      const response = await fetch(`${API_BASE_URL}/pedidos/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminData.token}`
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar pedido');
      
      const updated = await response.json();
      setOrders((current) => current.map((order) => (order.id === orderId ? updated : order)));
      
      // Update known pending IDs if we just moved one out of pending
      if (updated.status !== 'PENDING') {
        knownPendingIds.current.delete(updated.id);
      }
    } catch (err) {
      showError(err.message);
    }
  }

  function handleNextStatus(order) {
    const sequence = [
      'PENDING',
      'PREPARING',
      order.fulfillmentType === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY',
      'DELIVERED',
    ];
    const currentIndex = sequence.indexOf(order.status);
    if (currentIndex >= 0 && currentIndex < sequence.length - 1) {
      updateOrderStatus(order.id, sequence[currentIndex + 1]);
    }
  }

  const columns = [
    { id: 'PENDING', label: 'Pendentes', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
    { id: 'PREPARING', label: 'Preparando', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: 'READY', label: 'Pronto p/ Retirar', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { id: 'OUT_FOR_DELIVERY', label: 'Em Entrega', tone: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { id: 'DELIVERED', label: 'Concluídos', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ];

  const ordersByStatus = {};
  columns.forEach((col) => {
    ordersByStatus[col.id] = orders.filter((o) => o.status === col.id);
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    <div className="flex h-full flex-col p-6 overflow-hidden print:hidden">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Gestão Live (Kanban)</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Acompanhe e avance o status dos pedidos.</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
              liveStatus === 'connected'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : liveStatus === 'connecting'
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            {liveStatus === 'connected' ? 'Tempo real' : liveStatus === 'connecting' ? 'Conectando' : 'Fallback'}
          </span>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold animate-pulse">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4 items-start">
        {columns.map((column) => (
          <div
            key={column.id}
            className={`flex max-h-full w-72 min-w-[288px] flex-col rounded-xl bg-slate-100/80 p-3 dark:bg-slate-900/50 border sm:w-80 sm:min-w-[320px] shadow-sm ${column.tone.split(' ')[2] || 'border-slate-200 dark:border-slate-800'}`}
          >
            <div className="mb-3 flex items-center justify-between px-1 shrink-0">
              <h3 className="font-black text-slate-700 dark:text-slate-300 uppercase text-sm tracking-wide">{column.label}</h3>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${column.tone.split(' ').slice(0,2).join(' ')}`}
              >
                {ordersByStatus[column.id]?.length || 0}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {ordersByStatus[column.id]?.map((order) => (
                <div
                  key={order.id}
                  className={`group relative flex flex-col rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-sm transition hover:shadow-md ${order.status === 'PENDING' ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-800'}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      #{String(order.id).slice(0, 6)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleIssueNfce(order)}
                        className="text-slate-400 hover:text-blue-600 transition"
                        title="Registrar fiscal demonstrativo"
                      >
                        <FileText size={16} />
                      </button>
                      <button 
                        onClick={() => handlePrint(order)}
                        className="text-slate-400 hover:text-red-600 transition"
                        title="Imprimir Comanda"
                      >
                        <Printer size={16} />
                      </button>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {formatDateTime(order.createdAt).split(' ')[1]}
                      </span>
                    </div>
                  </div>

                  <div className="mb-1 font-bold text-slate-700 dark:text-slate-200 truncate">
                    {order.customer?.name ?? 'Cliente'}
                  </div>

                  <div className="mb-4 text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(order.total)}{' '}
                    <span className="text-xs font-bold text-slate-500">
                      · {order.fulfillmentType === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                    </span>
                  </div>

                  {column.id !== 'DELIVERED' && column.id !== 'CANCELED' && (
                    <button
                      type="button"
                      onClick={() => handleNextStatus(order)}
                      className="mt-auto w-full rounded-lg bg-slate-50 dark:bg-slate-950 py-2.5 text-xs font-black text-slate-700 dark:text-slate-300 transition hover:bg-slate-900 hover:text-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 active:scale-95"
                    >
                      Avançar Status
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    
    <PrintReceipt order={printingOrder} />
    </>
  );
}
