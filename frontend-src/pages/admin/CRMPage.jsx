import { useEffect, useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import { Panel } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function CRMPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showError } = useToast();
  const [filter, setFilter] = useState('ALL'); // ALL, VIP, ATIVO, NOVO, EM_RISCO

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        if (!adminDataStr) return;
        const { token } = JSON.parse(adminDataStr);
        
        const response = await fetch(`${API_BASE_URL}/admin/clientes`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (response.ok && isMounted) {
          const data = await response.json();
          setCustomers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Erro ao carregar', err);
        showError('Falha ao carregar métricas do CRM.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const getSegmentBadge = (segment) => {
    switch (segment) {
      case 'VIP':
        return (
          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-800 border border-yellow-200">
            VIP
          </span>
        );
      case 'ATIVO':
        return (
          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800 border border-green-200">
            Ativo
          </span>
        );
      case 'NOVO':
        return (
          <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800 border border-blue-200">
            Novo
          </span>
        );
      case 'EM_RISCO':
        return (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800 border border-red-200">
            Em Risco
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            Normal
          </span>
        );
    }
  };

  const filteredCustomers = useMemo(() => {
    if (filter === 'ALL') return customers;
    return customers.filter((c) => c.segment === filter);
  }, [customers, filter]);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Clientes (CRM)
            </h2>
            <p className="text-sm text-slate-500">Acompanhe perfil e segmentação da sua base</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${filter === 'ALL' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('VIP')}
          className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${filter === 'VIP' ? 'bg-yellow-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          VIP
        </button>
        <button
          onClick={() => setFilter('ATIVO')}
          className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${filter === 'ATIVO' ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          Ativos
        </button>
        <button
          onClick={() => setFilter('NOVO')}
          className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${filter === 'NOVO' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          Novos
        </button>
        <button
          onClick={() => setFilter('EM_RISCO')}
          className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors ${filter === 'EM_RISCO' ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          Em Risco
        </button>
      </div>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-950 uppercase text-slate-500 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-black">Cliente</th>
                <th className="px-6 py-4 font-black">Segmento</th>
                <th className="px-6 py-4 font-black text-right">Ticket Médio</th>
                <th className="px-6 py-4 font-black text-right">Total Gasto</th>
                <th className="px-6 py-4 font-black text-right">Fidelidade</th>
                <th className="px-6 py-4 font-black text-center">Último Pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-6 py-4">
                    <p className="max-w-[220px] truncate font-bold text-slate-900 dark:text-slate-100">
                      {c.name}
                    </p>
                    <p className="max-w-[220px] truncate text-xs text-slate-500">
                      {c.phone || c.email}
                    </p>
                  </td>
                  <td className="px-6 py-4">{getSegmentBadge(c.segment)}</td>
                  <td className="px-6 py-4 text-right font-medium">
                    R$ {(c.ticketMedio || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    R$ {(c.totalSpent || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-orange-600">
                    R$ {(c.loyaltyBalance || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-500 font-medium">
                    {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center text-center opacity-50">
              <Users size={32} className="mb-3 text-slate-400" />
              <p className="text-sm font-bold text-slate-500">Nenhum cliente encontrado neste segmento.</p>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
