import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Filter, Eye, Link2, CheckCircle2, AlertCircle, RefreshCw, Clock, XCircle, DollarSign, Building2 } from 'lucide-react';
import { formatCurrencySafe } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state para Nova Nota
  const [formData, setFormData] = useState({
    supplierId: '',
    number: '',
    issueDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [{ ingredientId: '', quantity: 1, unitCost: 0 }]
  });

  // Link state
  const [linkData, setLinkData] = useState({
    purchaseOrderId: '',
    notes: ''
  });

  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminData = adminDataStr ? JSON.parse(adminDataStr) : null;
  const token = adminData?.token || '';
  const userRole = adminData?.user?.role || adminData?.role || '';

  // RBAC no Frontend
  if (userRole === 'KITCHEN' || userRole === 'DRIVER' || userRole === 'DELIVERY') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-black text-slate-950 mb-2">Acesso Restrito</h2>
          <p className="text-slate-600 font-bold max-w-md mx-auto">
            O seu perfil (<span className="text-red-600 font-black">{userRole}</span>) não possui permissões para acessar Notas Fiscais e Documentos de Entrada.
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
      const [invRes, supRes, ordRes, ingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/invoices`, { headers }),
        fetch(`${API_BASE_URL}/admin/suppliers?active=true`, { headers }),
        fetch(`${API_BASE_URL}/admin/purchases/orders`, { headers }),
        fetch(`${API_BASE_URL}/admin/inventory/ingredients`, { headers })
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(Array.isArray(data) ? data : []);
      } else {
        throw new Error('Falha ao carregar notas fiscais.');
      }

      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(Array.isArray(data) ? data : []);
      }

      if (ordRes.ok) {
        const data = await ordRes.json();
        setOrders(Array.isArray(data) ? data : []);
      }

      if (ingRes.ok) {
        const data = await ingRes.json();
        setIngredients(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao carregar notas fiscais.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtros
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = search.trim() === '' || 
      inv.number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Métricas
  const totalAmount = invoices.reduce((sum, i) => i.status !== 'CANCELED' ? sum + Number(i.totalAmount || 0) : sum, 0);
  const pendingLinkCount = invoices.filter(i => i.status === 'RECEIVED' || i.status === 'PENDING' || i.status === 'PENDING_REVIEW').length;
  const linkedCount = invoices.filter(i => i.status === 'LINKED' || i.status === 'COMPLETED').length;

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ingredientId: '', quantity: 1, unitCost: 0 }]
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
    return formData.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitCost || 0)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierId) return alert('Selecione um fornecedor.');
    if (formData.items.length === 0 || !formData.items[0].ingredientId) return alert('Adicione pelo menos um insumo na nota.');

    try {
      setSubmitting(true);
      const itemsPayload = formData.items.filter(i => i.ingredientId).map(i => ({
        ingredientId: i.ingredientId,
        quantity: Number(i.quantity),
        unitCost: Number(i.unitCost),
        totalCost: Number(i.quantity) * Number(i.unitCost)
      }));

      const payload = {
        supplierId: formData.supplierId,
        number: formData.number || undefined,
        issueDate: formData.issueDate ? new Date(formData.issueDate).toISOString() : undefined,
        totalAmount: calculateTotal(),
        notes: formData.notes,
        status: 'RECEIVED',
        items: itemsPayload
      };

      const res = await fetch(`${API_BASE_URL}/admin/invoices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erro ao cadastrar nota fiscal.');
      }

      setIsModalOpen(false);
      setFormData({ supplierId: '', number: '', issueDate: new Date().toISOString().split('T')[0], notes: '', items: [{ ingredientId: '', quantity: 1, unitCost: 0 }] });
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkPurchase = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/admin/invoices/${selectedInvoice.id}/link-purchase`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          purchaseOrderId: linkData.purchaseOrderId || undefined,
          status: 'LINKED',
          notes: linkData.notes || `Vinculado manualmente ao pedido #${linkData.purchaseOrderId?.slice(0, 8)}`
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erro ao vincular nota fiscal.');
      }

      setIsLinkModalOpen(false);
      setSelectedInvoice(null);
      setLinkData({ purchaseOrderId: '', notes: '' });
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'LINKED':
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Conciliada / Vinculada</span>;
      case 'RECEIVED':
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3.5 h-3.5" /> Recebida (Sem Vínculo)</span>;
      case 'PENDING_REVIEW':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"><AlertCircle className="w-3.5 h-3.5" /> Em Revisão</span>;
      case 'CANCELED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"><XCircle className="w-3.5 h-3.5" /> Cancelada</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{status || 'N/A'}</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-950 flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            Notas Fiscais & Entradas
          </h1>
          <p className="text-slate-600 text-sm font-semibold mt-1">
            Conferência de notas, entrada direta no estoque e conciliação com ordens de compra.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={loadData}
            title="Atualizar dados"
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition-all border border-slate-300 shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Cadastrar Nota
          </button>
        </div>
      </div>

      {/* Resumo Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-indigo-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Total de Notas</p>
              <h3 className="text-3xl font-black text-slate-950 mt-1">{invoices.length}</h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-700 border border-indigo-200 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-emerald-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Valor Acumulado</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{formatCurrencySafe(totalAmount)}</h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700 border border-emerald-200 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-amber-200 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-amber-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Pendentes de Vínculo</p>
              <h3 className="text-3xl font-black text-amber-700 mt-1">{pendingLinkCount}</h3>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl text-amber-700 border border-amber-200 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-blue-200 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-blue-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Conciliadas / OK</p>
              <h3 className="text-3xl font-black text-blue-700 mt-1">{linkedCount}</h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl text-blue-700 border border-blue-200 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número da NF, fornecedor ou observações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-500 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-900 font-bold rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:border-indigo-600 transition-all cursor-pointer"
          >
            <option value="ALL">Todos os Status</option>
            <option value="RECEIVED">Recebida</option>
            <option value="LINKED">Conciliada / Vinculada</option>
            <option value="PENDING_REVIEW">Em Revisão</option>
            <option value="CANCELED">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Tabela de Notas Fiscais */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center font-bold text-slate-600 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <span>Carregando notas fiscais...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-700 bg-red-50 m-4 rounded-xl border border-red-200 flex flex-col items-center gap-2 font-bold">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <span>{error}</span>
            <button onClick={loadData} className="mt-2 text-xs bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg hover:bg-red-200">Tentar Novamente</button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 mb-4 border border-slate-200">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-950 mb-1">Nenhuma nota fiscal encontrada</h3>
            <p className="text-slate-600 font-semibold text-sm max-w-md mb-6">
              Nenhum documento fiscal de entrada corresponde à sua busca ou ainda não foram registrados.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Primeira Nota
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider bg-slate-100">
                  <th className="p-4">NF / Emissão</th>
                  <th className="p-4">Fornecedor</th>
                  <th className="p-4">Itens</th>
                  <th className="p-4">Vínculo com Pedido</th>
                  <th className="p-4 text-right">Valor Total</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredInvoices.map((inv) => {
                  const linkedPO = inv.purchaseReceipts?.[0]?.purchaseOrder;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-slate-950 font-mono">NF {inv.number || 'S/N'}</div>
                        <div className="text-xs font-semibold text-slate-600">
                          {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('pt-BR') : 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{inv.supplier?.name || 'Fornecedor Desconhecido'}</div>
                        {inv.supplier?.cnpj && (
                          <div className="text-xs font-semibold text-slate-600 font-mono">{inv.supplier.cnpj}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">
                          {inv.items?.length || 0} {inv.items?.length === 1 ? 'insumo' : 'insumos'}
                        </div>
                      </td>
                      <td className="p-4">
                        {linkedPO ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-mono font-bold">
                            <Link2 className="w-3.5 h-3.5" /> Pedido #{linkedPO.id?.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 font-semibold italic">Sem pedido vinculado</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-950 font-mono">
                        {formatCurrencySafe(inv.totalAmount)}
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedInvoice(inv); setIsViewModalOpen(true); }}
                            title="Visualizar Itens da Nota"
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-300"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {inv.status !== 'LINKED' && inv.status !== 'COMPLETED' && (
                            <button
                              onClick={() => { setSelectedInvoice(inv); setIsLinkModalOpen(true); }}
                              title="Vincular a Pedido de Compra"
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all border border-indigo-200"
                            >
                              <Link2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova Nota */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
              <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                <FileText className="w-6 h-6 text-indigo-600" />
                Cadastrar Nota Fiscal / Documento de Entrada
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Fornecedor *</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    required
                    className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Número da NF</label>
                  <input
                    type="text"
                    placeholder="Ex: 123456"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Data Emissão *</label>
                  <input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    required
                    className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Insumos Entregues *</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-indigo-700 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Insumo
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => handleItemChange(index, 'ingredientId', e.target.value)}
                        required
                        className="flex-1 w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-600"
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
                          className="w-24 bg-white border border-slate-300 text-slate-900 font-semibold rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-600 text-right font-mono"
                        />
                        <span className="text-slate-600 text-xs font-bold">x R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Custo Unit."
                          value={item.unitCost}
                          onChange={(e) => handleItemChange(index, 'unitCost', e.target.value)}
                          required
                          className="w-28 bg-white border border-slate-300 text-slate-900 font-semibold rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-600 text-right font-mono"
                        />
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-200 text-sm">
                  <span className="text-slate-600 mr-2 font-bold">Total da Nota:</span>
                  <span className="text-lg font-black text-emerald-700 font-mono">{formatCurrencySafe(calculateTotal())}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais, chave de acesso..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm disabled:opacity-50">
                  {submitting ? 'Salvando...' : 'Confirmar e Atualizar Estoque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vincular Pedido */}
      {isLinkModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                <Link2 className="w-6 h-6 text-indigo-600" />
                Vincular a Pedido de Compra
              </h3>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">✕</button>
            </div>

            <form onSubmit={handleLinkPurchase} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Selecione a Ordem de Compra *</label>
                <select
                  value={linkData.purchaseOrderId}
                  onChange={(e) => setLinkData({ ...linkData, purchaseOrderId: e.target.value })}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                >
                  <option value="">Selecione um pedido em aberto...</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0, 8)} — {o.supplier?.name} (R$ {Number(o.totalAmount || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Observações da Conciliação</label>
                <textarea
                  value={linkData.notes}
                  onChange={(e) => setLinkData({ ...linkData, notes: e.target.value })}
                  placeholder="Justificativa ou nota de conferência..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsLinkModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm disabled:opacity-50">
                  {submitting ? 'Vinculando...' : 'Confirmar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizar Detalhes */}
      {isViewModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                  Nota Fiscal {selectedInvoice.number ? `#${selectedInvoice.number}` : 'Sem Número'}
                </h3>
                <span className="text-xs font-semibold text-slate-600">
                  Emissão: {selectedInvoice.issueDate ? new Date(selectedInvoice.issueDate).toLocaleDateString('pt-BR') : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedInvoice.status)}
                <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">✕</button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Insumos da Nota (Entrada de Estoque)</h4>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">Insumo</th>
                      <th className="p-3 text-right">Qtd</th>
                      <th className="p-3 text-right">Custo Unit.</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedInvoice.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-800">{item.ingredient?.name || 'Insumo'} ({item.ingredient?.unit || 'UN'})</td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-700">{Number(item.quantity || 0)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-700">{formatCurrencySafe(item.unitCost)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-950">{formatCurrencySafe(item.totalCost || Number(item.quantity || 0) * Number(item.unitCost || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200 font-semibold">
              <div className="text-xs text-slate-600 font-bold">
                Fornecedor: <strong className="text-slate-950">{selectedInvoice.supplier?.name}</strong>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-600 uppercase mr-2 font-bold">Valor Total:</span>
                <span className="text-xl font-black text-emerald-700 font-mono">{formatCurrencySafe(selectedInvoice.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
