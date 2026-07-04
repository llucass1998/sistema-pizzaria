import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, Filter, Eye, Edit2, XCircle, AlertCircle, RefreshCw, CheckCircle2, Clock, Truck, DollarSign } from 'lucide-react';
import { formatCurrencySafe } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export default function PurchasesPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    supplierId: '',
    expectedDate: '',
    notes: '',
    items: [{ ingredientId: '', quantity: 1, unitPrice: 0 }]
  });

  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminData = adminDataStr ? JSON.parse(adminDataStr) : null;
  const token = adminData?.token || '';
  const userRole = adminData?.user?.role || adminData?.role || '';

  // RBAC no Frontend
  if (userRole === 'KITCHEN' || userRole === 'DRIVER' || userRole === 'DELIVERY') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center backdrop-blur-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-slate-300 max-w-md mx-auto">
            O seu perfil (<span className="text-red-400 font-semibold">{userRole}</span>) não possui permissões para acessar a gestão de Compras e Pedidos.
          </p>
        </div>
      </div>
    );
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [ordRes, supRes, ingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/purchases/orders`, { headers }),
        fetch(`${API_BASE_URL}/admin/suppliers?active=true`, { headers }),
        fetch(`${API_BASE_URL}/admin/inventory/ingredients`, { headers })
      ]);

      if (ordRes.ok) {
        const data = await ordRes.json();
        setOrders(Array.isArray(data) ? data : []);
      } else {
        throw new Error('Falha ao carregar pedidos de compra.');
      }

      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(Array.isArray(data) ? data : []);
      }

      if (ingRes.ok) {
        const data = await ingRes.json();
        setIngredients(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao carregar dados de compras.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtros
  const filteredOrders = orders.filter((o) => {
    const matchesSearch = search.trim() === '' || 
      o.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.id?.toLowerCase().includes(search.toLowerCase()) ||
      o.notes?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Cálculos de Resumo
  const totalAmount = orders.reduce((sum, o) => o.status !== 'CANCELED' ? sum + Number(o.totalAmount || 0) : sum, 0);
  const pendingCount = orders.filter(o => o.status === 'PENDING' || o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED').length;
  const completedCount = orders.filter(o => o.status === 'RECEIVED' || o.status === 'PAID').length;

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ingredientId: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierId) return alert('Selecione um fornecedor.');
    if (formData.items.length === 0 || !formData.items[0].ingredientId) return alert('Adicione pelo menos um insumo.');

    try {
      setSubmitting(true);
      const payload = {
        supplierId: formData.supplierId,
        expectedDate: formData.expectedDate ? new Date(formData.expectedDate).toISOString() : undefined,
        notes: formData.notes,
        items: formData.items.filter(i => i.ingredientId).map(i => ({
          ingredientId: i.ingredientId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice)
        }))
      };

      const res = await fetch(`${API_BASE_URL}/admin/purchases/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erro ao criar pedido de compra.');
      }

      setIsModalOpen(false);
      setFormData({ supplierId: '', expectedDate: '', notes: '', items: [{ ingredientId: '', quantity: 1, unitPrice: 0 }] });
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Deseja realmente cancelar este pedido de compra?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/purchases/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers
      });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Erro ao cancelar pedido.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
      case 'RECEIVED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Concluído</span>;
      case 'APPROVED':
      case 'PARTIALLY_RECEIVED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><Truck className="w-3.5 h-3.5" /> Em Trânsito</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pendente</span>;
      case 'CANCELED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20"><XCircle className="w-3.5 h-3.5" /> Cancelado</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">{status || 'N/A'}</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-2xl">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-indigo-500" />
            Compras & Pedidos
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie pedidos de compra (POs), cotações com fornecedores e recebimento de mercadorias.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={loadData}
            title="Atualizar dados"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700/60 active:scale-95"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nova Compra
          </button>
        </div>
      </div>

      {/* Resumo Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md group hover:border-indigo-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total de Pedidos</p>
              <h3 className="text-3xl font-bold text-white mt-1">{orders.length}</h3>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md group hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Volume Comprado</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrencySafe(totalAmount)}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md group hover:border-amber-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Em Andamento</p>
              <h3 className="text-3xl font-bold text-amber-400 mt-1">{pendingCount}</h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md group hover:border-blue-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Concluídos / Pagos</p>
              <h3 className="text-3xl font-bold text-blue-400 mt-1">{completedCount}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por fornecedor, número ou observações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PENDING">Pendente</option>
            <option value="APPROVED">Aprovado / Em Trânsito</option>
            <option value="RECEIVED">Recebido / Concluído</option>
            <option value="PAID">Pago</option>
            <option value="CANCELED">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span>Carregando compras e pedidos...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 bg-red-500/5 m-4 rounded-xl border border-red-500/20 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <span>{error}</span>
            <button onClick={loadData} className="mt-2 text-xs bg-red-500/20 text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/30">Tentar Novamente</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-800/60 rounded-full flex items-center justify-center text-slate-500 mb-4 border border-slate-700/50">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Nenhum pedido encontrado</h3>
            <p className="text-slate-400 text-sm max-w-md mb-6">
              Não encontramos nenhuma ordem de compra correspondente aos seus filtros ou ainda não há cadastros.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Criar Primeiro Pedido
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-950/50">
                  <th className="p-4">Pedido / Data</th>
                  <th className="p-4">Fornecedor</th>
                  <th className="p-4">Itens</th>
                  <th className="p-4">Previsão</th>
                  <th className="p-4 text-right">Valor Total</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-white font-mono">#{order.id?.slice(0, 8)}</div>
                      <div className="text-xs text-slate-400">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-200">{order.supplier?.name || 'Fornecedor Desconhecido'}</div>
                      {order.supplier?.cnpj && (
                        <div className="text-xs text-slate-500 font-mono">{order.supplier.cnpj}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300">
                        {order.items?.length || 0} {order.items?.length === 1 ? 'insumo' : 'insumos'}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">
                        {order.items?.slice(0, 2).map(i => i.ingredient?.name).join(', ')}
                        {order.items?.length > 2 ? '...' : ''}
                      </div>
                    </td>
                    <td className="p-4 text-slate-300 text-xs">
                      {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString('pt-BR') : 'Não informada'}
                    </td>
                    <td className="p-4 text-right font-bold text-white font-mono">
                      {formatCurrencySafe(order.totalAmount)}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}
                          title="Visualizar detalhes"
                          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all border border-slate-700/50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {order.status !== 'CANCELED' && order.status !== 'PAID' && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            title="Cancelar pedido"
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all border border-red-500/20"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova Compra */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-indigo-500" />
                Novo Pedido de Compra (PO)
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Fornecedor *
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    required
                    className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">Selecione um fornecedor...</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name} {sup.cnpj ? `(${sup.cnpj})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Previsão de Entrega
                  </label>
                  <input
                    type="date"
                    value={formData.expectedDate}
                    onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Itens do Pedido */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Insumos / Itens do Pedido *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Insumo
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => handleItemChange(index, 'ingredientId', e.target.value)}
                        required
                        className="flex-1 w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Selecione o insumo...</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit || 'UN'})</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required
                          className="w-24 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-right font-mono"
                        />
                        <span className="text-slate-400 text-xs font-bold">x R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Custo Unit."
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          required
                          className="w-28 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-right font-mono"
                        />
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-800 text-sm">
                  <span className="text-slate-400 mr-2 font-semibold">Total Estimado:</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">{formatCurrencySafe(calculateTotal())}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Observações Gerais
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais, prazos, condições de pagamento..."
                  rows={2}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Confirmar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes / Visualização */}
      {isViewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  Pedido #{selectedOrder.id?.slice(0, 8)}
                </h3>
                <span className="text-xs text-slate-400">
                  Emitido em: {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedOrder.status)}
                <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 text-sm">
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase">Fornecedor</span>
                <span className="text-white font-bold">{selectedOrder.supplier?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 block uppercase">Previsão</span>
                <span className="text-white font-bold">{selectedOrder.expectedDate ? new Date(selectedOrder.expectedDate).toLocaleDateString('pt-BR') : 'Não definida'}</span>
              </div>
              {selectedOrder.notes && (
                <div className="col-span-2 pt-2 border-t border-slate-700/40">
                  <span className="text-xs font-semibold text-slate-400 block uppercase">Observações</span>
                  <span className="text-slate-300 italic text-xs">{selectedOrder.notes}</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Insumos Solicitados</h4>
              <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Insumo</th>
                      <th className="p-3 text-right">Qtd</th>
                      <th className="p-3 text-right">Custo Unit.</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {selectedOrder.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-slate-200">{item.ingredient?.name || 'Insumo'} ({item.ingredient?.unit || 'UN'})</td>
                        <td className="p-3 text-right font-mono text-slate-300">{Number(item.quantity || 0)}</td>
                        <td className="p-3 text-right font-mono text-slate-400">{formatCurrencySafe(item.unitPrice || item.unitCost)}</td>
                        <td className="p-3 text-right font-mono font-bold text-white">{formatCurrencySafe(Number(item.quantity || 0) * Number(item.unitPrice || item.unitCost || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                Total de Itens: <strong className="text-white">{selectedOrder.items?.length || 0}</strong>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase mr-2 font-bold">Total Geral:</span>
                <span className="text-xl font-bold text-emerald-400 font-mono">{formatCurrencySafe(selectedOrder.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
