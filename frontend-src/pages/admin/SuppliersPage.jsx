import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Phone,
  Mail,
  DollarSign,
  ShoppingBag,
} from 'lucide-react';
import { formatCurrencySafe, formatPhoneBR } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    email: '',
    phone: '',
    isActive: true,
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
            O seu perfil (<span className="text-red-600 font-black">{userRole}</span>) não possui
            permissões para acessar o cadastro de Fornecedores.
          </p>
        </div>
      </div>
    );
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/admin/suppliers`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : []);
      } else {
        throw new Error('Falha ao carregar fornecedores.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao carregar dados dos fornecedores.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtros
  const filteredSuppliers = suppliers.filter((sup) => {
    const matchesSearch =
      search.trim() === '' ||
      sup.name?.toLowerCase().includes(search.toLowerCase()) ||
      sup.cnpj?.includes(search.trim()) ||
      sup.email?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && sup.isActive) ||
      (statusFilter === 'INACTIVE' && !sup.isActive);

    return matchesSearch && matchesStatus;
  });

  // Métricas
  const activeCount = suppliers.filter((s) => s.isActive).length;
  const inactiveCount = suppliers.filter((s) => !s.isActive).length;
  const totalVolume = suppliers.reduce((sum, s) => sum + Number(s.metrics?.totalPurchased || 0), 0);
  const withOrdersCount = suppliers.filter(
    (s) => (s.metrics?.ordersCount || 0) > 0 || (s.metrics?.invoicesCount || 0) > 0,
  ).length;

  const handleOpenNew = () => {
    setEditingSupplier(null);
    setFormData({ name: '', cnpj: '', email: '', phone: '', isActive: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      cnpj: supplier.cnpj || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      isActive: supplier.isActive ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Informe o nome do fornecedor.');

    try {
      setSubmitting(true);
      const url = editingSupplier
        ? `${API_BASE_URL}/admin/suppliers/${editingSupplier.id}`
        : `${API_BASE_URL}/admin/suppliers`;

      const method = editingSupplier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erro ao salvar fornecedor.');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (supplier) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suppliers/${supplier.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });

      if (res.ok) {
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Erro ao alterar status do fornecedor.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-950 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-600" />
            Fornecedores & Parceiros
          </h1>
          <p className="text-slate-600 text-sm font-semibold mt-1">
            Gestão de fornecedores, dados fiscais (CNPJ), contatos e volume de compras contratadas.
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
            onClick={handleOpenNew}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Novo Fornecedor
          </button>
        </div>
      </div>

      {/* Resumo Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-emerald-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Fornecedores Ativos
              </p>
              <h3 className="text-3xl font-black text-emerald-700 mt-1">{activeCount}</h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700 border border-emerald-200 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-indigo-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Volume Contratado
              </p>
              <h3 className="text-2xl font-black text-slate-950 mt-1">
                {formatCurrencySafe(totalVolume)}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-700 border border-indigo-200 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-blue-200 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-blue-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Com Compras Ativas
              </p>
              <h3 className="text-3xl font-black text-blue-700 mt-1">{withOrdersCount}</h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl text-blue-700 border border-blue-200 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-red-200 bg-gradient-to-br from-red-500/10 to-red-500/5 p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-red-300 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Inativos / Suspensos
              </p>
              <h3 className="text-3xl font-black text-red-700 mt-1">{inactiveCount}</h3>
            </div>
            <div className="p-3 bg-red-100 rounded-xl text-red-700 border border-red-200 group-hover:scale-110 transition-transform">
              <XCircle className="w-6 h-6" />
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
            placeholder="Buscar por nome do fornecedor, CNPJ ou email..."
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
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="INACTIVE">Apenas Inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Fornecedores */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center font-bold text-slate-600 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <span>Carregando fornecedores...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-700 bg-red-50 m-4 rounded-xl border border-red-200 flex flex-col items-center gap-2 font-bold">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <span>{error}</span>
            <button
              onClick={loadData}
              className="mt-2 text-xs bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg hover:bg-red-200"
            >
              Tentar Novamente
            </button>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 mb-4 border border-slate-200">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-950 mb-1">Nenhum fornecedor encontrado</h3>
            <p className="text-slate-600 font-semibold text-sm max-w-md mb-6">
              Não encontramos fornecedores correspondentes à sua busca ou ainda não foram
              cadastrados parceiros.
            </p>
            <button
              onClick={handleOpenNew}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Primeiro Fornecedor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider bg-slate-100">
                  <th className="p-4">Fornecedor / CNPJ</th>
                  <th className="p-4">Contatos</th>
                  <th className="p-4 text-center">Pedidos / Notas</th>
                  <th className="p-4 text-right">Volume Comprado</th>
                  <th className="p-4 text-center">Última Compra</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-950 text-base">{sup.name}</div>
                      {sup.cnpj ? (
                        <div className="text-xs font-semibold text-slate-600 font-mono mt-0.5">
                          {sup.cnpj}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 font-semibold italic">
                          Sem CNPJ informado
                        </div>
                      )}
                    </td>
                    <td className="p-4 space-y-1">
                      {sup.phone && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatPhoneBR(sup.phone)}</span>
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>{sup.email}</span>
                        </div>
                      )}
                      {!sup.phone && !sup.email && (
                        <span className="text-xs text-slate-500 font-semibold italic">
                          Sem contato
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center font-mono">
                      <div className="text-slate-800 font-bold">
                        {sup.metrics?.ordersCount || 0} POs
                      </div>
                      <div className="text-xs font-semibold text-slate-600">
                        {sup.metrics?.invoicesCount || 0} NFs
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-700 font-mono">
                      {formatCurrencySafe(sup.metrics?.totalPurchased)}
                    </td>
                    <td className="p-4 text-center text-xs font-semibold text-slate-600">
                      {sup.metrics?.lastPurchaseDate
                        ? new Date(sup.metrics.lastPurchaseDate).toLocaleDateString('pt-BR')
                        : 'Nunca'}
                    </td>
                    <td className="p-4 text-center">
                      {sup.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(sup)}
                          title="Editar Cadastro"
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(sup)}
                          title={sup.isActive ? 'Desativar Fornecedor' : 'Reativar Fornecedor'}
                          className={`p-2 rounded-lg transition-all border ${
                            sup.isActive
                              ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {sup.isActive ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo / Editar Fornecedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-600" />
                {editingSupplier ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Nome / Razão Social *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Laticínios São Paulo Ltda"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  CNPJ ou CPF
                </label>
                <input
                  type="text"
                  placeholder="Ex: 12.345.678/0001-90"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 98765-4321"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="contato@fornecedor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-600"
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-semibold text-slate-800 select-none cursor-pointer"
                >
                  Fornecedor ativo para compras e cotações
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
