import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Eye,
  TrendingUp,
  AlertTriangle,
  Star,
  ShieldAlert,
  Phone,
  Mail,
  ShoppingBag,
  Award,
  Calendar,
  UserCheck,
  Download
} from 'lucide-react';
import { Panel } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrencySafe } from '../../data/menuData.js';
import { BaseModal } from '../../components/ui/BaseModal.jsx';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function CRMPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showError, showSuccess } = useToast();
  const [filter, setFilter] = useState('ALL'); // ALL, VIP, ATIVO, NOVO, EM_RISCO
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminRole = adminDataStr ? JSON.parse(adminDataStr).role : '';
  const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER'];
  const hasPermission = adminRole === 'SUPER_ADMIN' || allowedRoles.includes(adminRole);

  useEffect(() => {
    if (!hasPermission) return;
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        const adminDataStr = window.localStorage.getItem('pizzaria-admin');
        if (!adminDataStr) return;
        const { token } = JSON.parse(adminDataStr);

        const response = await fetch(`${API_BASE_URL}/admin/clientes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok && isMounted) {
          const data = await response.json();
          setCustomers(Array.isArray(data) ? data : []);
        } else if (!response.ok) {
          throw new Error('Erro na resposta do servidor');
        }
      } catch (err) {
        console.error('Erro ao carregar CRM:', err);
        showError('Falha ao carregar métricas e clientes do CRM.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [hasPermission, showError]);

  // Reseta página atual ao filtrar ou buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm, itemsPerPage]);

  const summaryMetrics = useMemo(() => {
    const total = customers.length;
    const vipCount = customers.filter((c) => c.segment === 'VIP').length;
    const ativoCount = customers.filter((c) => c.segment === 'ATIVO').length;
    const riscoCount = customers.filter((c) => c.segment === 'EM_RISCO').length;
    const novoCount = customers.filter((c) => c.segment === 'NOVO').length;
    const totalSpentSum = customers.reduce((acc, c) => acc + (Number(c.totalSpent) || 0), 0);
    const totalOrdersSum = customers.reduce((acc, c) => acc + (Number(c.totalOrders) || 0), 0);
    const avgTicketGeneral = totalOrdersSum > 0 ? totalSpentSum / totalOrdersSum : 0;

    return { total, vipCount, ativoCount, riscoCount, novoCount, avgTicketGeneral, totalSpentSum };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (filter !== 'ALL') {
      list = list.filter((c) => c.segment === filter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(q);
        const emailMatch = c.email?.toLowerCase().includes(q);
        const phoneMatch =
          c.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || c.phone?.includes(q);
        return nameMatch || emailMatch || phoneMatch;
      });
    }
    return list;
  }, [customers, filter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSendWhatsApp = (customer) => {
    if (!customer.phone) {
      showError('Este cliente não possui telefone cadastrado.');
      return;
    }
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length <= 10 ? `55${cleanPhone}` : cleanPhone;
    const message = encodeURIComponent(
      `Olá ${customer.name}, tudo bem? Aqui é da Pizzaria! Temos novidades e promoções especiais para você hoje.`
    );
    window.open(`https://api.whatsapp.com/send?phone=${fullPhone}&text=${message}`, '_blank');
  };

  const handleOpenCustomerModal = async (customer) => {
    setSelectedCustomer(customer);
    setCustomerOrders([]);
    
    try {
      setIsLoadingOrders(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);

      const response = await fetch(`${API_BASE_URL}/admin/clientes/${customer.id}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const orders = await response.json();
        setCustomerOrders(orders);
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos do cliente:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredCustomers.length === 0) {
      showError('Nenhum cliente para exportar neste segmento.');
      return;
    }

    const sanitizeCsvValue = (value) => {
      const raw = value == null ? "" : String(value);
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0');
    const filename = `crm-clientes-segmento-${dateStr}.csv`;

    const rows = [['nome', 'email', 'telefone', 'segmento', 'totalOrders', 'totalSpent', 'lastOrderDate', 'loyaltyBalance']];
    
    filteredCustomers.forEach(c => {
      rows.push([
        c.name || '',
        c.email || '',
        c.phone || '',
        c.segment || '',
        c.totalOrders || 0,
        c.totalSpent || 0,
        c.lastOrderDate ? new Date(c.lastOrderDate).toISOString() : '',
        c.loyaltyBalance || 0
      ]);
    });

    const csv = "\uFEFF" + rows.map((row) => row.map(sanitizeCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSegmentBadge = (segment) => {
    switch (segment) {
      case 'VIP':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-800 border border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900/60">
            <Star size={12} className="fill-yellow-500 text-yellow-500" /> VIP
          </span>
        );
      case 'ATIVO':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/60">
            <UserCheck size={12} /> Ativo
          </span>
        );
      case 'NOVO':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60">
            Novo
          </span>
        );
      case 'EM_RISCO':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
            <AlertTriangle size={12} /> Em Risco
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            Normal
          </span>
        );
    }
  };

  if (!hasPermission) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Acesso Restrito</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Seu perfil ({adminRole || 'Sem Perfil'}) não tem permissão para acessar o CRM e base de clientes.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="text-orange-600" size={28} />
            CRM — Gestão de Clientes e Fidelidade
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Segmentação inteligente, histórico de consumo, ticket médio e engajamento via WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Total de Clientes</span>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Users size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {summaryMetrics.total}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Base total cadastrada
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">VIPs & Ativos</span>
            <div className="rounded-xl bg-green-50 p-2.5 text-green-600 dark:bg-green-950/40 dark:text-green-400">
              <Star size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-green-600 dark:text-green-400">
            {summaryMetrics.vipCount + summaryMetrics.ativoCount}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            {summaryMetrics.vipCount} VIPs • {summaryMetrics.ativoCount} Ativos
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Clientes em Risco</span>
            <div className="rounded-xl bg-red-50 p-2.5 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <AlertTriangle size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-red-600 dark:text-red-400">
            {summaryMetrics.riscoCount}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Inativos há muito tempo
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Ticket Médio Geral</span>
            <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrencySafe(summaryMetrics.avgTicketGeneral)}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Média de gastos por pedido
          </span>
        </div>
      </div>

      {/* Barra de Busca e Filtros de Segmento */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${
              filter === 'ALL'
                ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Todos ({summaryMetrics.total})
          </button>
          <button
            onClick={() => setFilter('VIP')}
            className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${
              filter === 'VIP'
                ? 'bg-yellow-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            VIP ({summaryMetrics.vipCount})
          </button>
          <button
            onClick={() => setFilter('ATIVO')}
            className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${
              filter === 'ATIVO'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Ativos ({summaryMetrics.ativoCount})
          </button>
          <button
            onClick={() => setFilter('NOVO')}
            className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${
              filter === 'NOVO'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Novos ({summaryMetrics.novoCount})
          </button>
          <button
            onClick={() => setFilter('EM_RISCO')}
            className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${
              filter === 'EM_RISCO'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 border border-slate-200 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Em Risco ({summaryMetrics.riscoCount})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, email, telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Clientes */}
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-950 uppercase text-slate-500 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-black">Cliente / Contato</th>
                <th className="px-6 py-4 font-black">Segmento</th>
                <th className="px-6 py-4 font-black text-center">Pedidos</th>
                <th className="px-6 py-4 font-black text-right">Ticket Médio</th>
                <th className="px-6 py-4 font-black text-right">Total Gasto</th>
                <th className="px-6 py-4 font-black text-right">Fidelidade</th>
                <th className="px-6 py-4 font-black text-center">Último Pedido</th>
                <th className="px-6 py-4 font-black text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {paginatedCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-6 py-4">
                    <p className="max-w-[220px] truncate font-bold text-slate-900 dark:text-slate-100">
                      {c.name || 'Cliente sem nome'}
                    </p>
                    <p className="max-w-[220px] truncate text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      {c.phone ? (
                        <>
                          <Phone size={11} className="text-slate-400 inline" /> {c.phone}
                        </>
                      ) : (
                        <>
                          <Mail size={11} className="text-slate-400 inline" /> {c.email || 'Sem contato'}
                        </>
                      )}
                    </p>
                  </td>
                  <td className="px-6 py-4">{getSegmentBadge(c.segment)}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                    {c.totalOrders || 0}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrencySafe(c.ticketMedio)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrencySafe(c.totalSpent)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrencySafe(c.loyaltyBalance)}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-500 font-medium">
                    {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('pt-BR') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSendWhatsApp(c)}
                        title="Enviar mensagem no WhatsApp"
                        className="rounded-lg bg-green-50 p-2 text-green-600 transition hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-900/60"
                      >
                        <MessageCircle size={18} />
                      </button>
                      <button
                        onClick={() => handleOpenCustomerModal(c)}
                        title="Ver detalhes do cliente"
                        className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paginatedCustomers.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center text-center opacity-70">
              <Users size={40} className="mb-3 text-slate-400" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                Nenhum cliente encontrado
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tente ajustar os filtros de segmento ou o termo de busca.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé de Paginação */}
        {filteredCustomers.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Exibindo</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-bold text-slate-700 focus:border-orange-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>
                de <strong className="text-slate-700 dark:text-slate-300">{filteredCustomers.length}</strong> clientes
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 mr-2">
                Página <strong className="text-slate-700 dark:text-slate-300">{currentPage}</strong> de {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Modal de Detalhes do Cliente */}
      {selectedCustomer && (
        <BaseModal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`Perfil do Cliente: ${selectedCustomer.name}`}
          size="md"
        >
          <div className="space-y-6 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 font-medium">Segmentação atual</p>
                <div className="mt-1">{getSegmentBadge(selectedCustomer.segment)}</div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-medium">Último Pedido</p>
                <p className="mt-0.5 font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1">
                  <Calendar size={14} className="text-orange-500" />
                  {selectedCustomer.lastOrderDate
                    ? new Date(selectedCustomer.lastOrderDate).toLocaleDateString('pt-BR')
                    : 'Nenhum pedido registrado'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Phone size={14} className="text-slate-400" /> Telefone / WhatsApp
                </p>
                <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                  {selectedCustomer.phone || 'Não informado'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Mail size={14} className="text-slate-400" /> E-mail
                </p>
                <p className="mt-1 font-bold text-slate-900 dark:text-slate-100 truncate">
                  {selectedCustomer.email || 'Não informado'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-orange-50/50 p-3 text-center border border-orange-200/60 dark:bg-orange-950/20 dark:border-orange-900/40">
                <ShoppingBag size={18} className="mx-auto text-orange-600 mb-1" />
                <p className="text-xs text-slate-500">Pedidos</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {selectedCustomer.totalOrders || 0}
                </p>
              </div>

              <div className="rounded-xl bg-green-50/50 p-3 text-center border border-green-200/60 dark:bg-green-950/20 dark:border-green-900/40">
                <TrendingUp size={18} className="mx-auto text-green-600 mb-1" />
                <p className="text-xs text-slate-500">Total Gasto</p>
                <p className="text-base font-black text-green-700 dark:text-green-400">
                  {formatCurrencySafe(selectedCustomer.totalSpent)}
                </p>
              </div>

              <div className="rounded-xl bg-amber-50/50 p-3 text-center border border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-900/40">
                <Award size={18} className="mx-auto text-amber-600 mb-1" />
                <p className="text-xs text-slate-500">Saldo Fidelidade</p>
                <p className="text-base font-black text-amber-700 dark:text-amber-400">
                  {formatCurrencySafe(selectedCustomer.loyaltyBalance)}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                Ações Recomendadas de CRM
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {selectedCustomer.segment === 'VIP' && (
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 font-bold">•</span>
                    Cliente de alto valor. Envie um cupom de desconto exclusivo de agradecimento ou brinde na próxima compra.
                  </li>
                )}
                {selectedCustomer.segment === 'EM_RISCO' && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    Cliente inativo há muito tempo. Envie uma mensagem no WhatsApp perguntando se aconteceu algo e oferecendo frete grátis para reativar.
                  </li>
                )}
                {selectedCustomer.segment === 'NOVO' && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    Novo cliente. Dê as boas-vindas ao programa de fidelidade e incentive a segunda compra com uma sobremesa especial.
                  </li>
                )}
                {selectedCustomer.segment === 'ATIVO' && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">•</span>
                    Cliente regular. Mantenha o engajamento divulgando os novos sabores da temporada.
                  </li>
                )}
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleSendWhatsApp(selectedCustomer);
                  setSelectedCustomer(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700 transition"
              >
                <MessageCircle size={16} />
                Chamar no WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                Fechar
              </button>
            </div>

            {/* Histórico de Pedidos */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3">Histórico de Pedidos</h4>
              
              {isLoadingOrders ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-slate-100" />
                </div>
              ) : customerOrders.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                  {customerOrders.map(order => (
                    <div key={order.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500">
                          {new Date(order.createdAt).toLocaleString('pt-BR')}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                          order.status === 'CANCELED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                        {order.items?.map(item => `${item.quantity}x ${item.product?.name}`).join(', ')}
                      </div>
                      
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">
                          {order.fulfillmentType === 'DELIVERY' ? 'Entrega' : 'Retirada'} • {order.paymentMethod || 'PGTO Indisponível'}
                        </span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrencySafe(order.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-slate-500 py-4">
                  Nenhum pedido encontrado.
                </p>
              )}
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
