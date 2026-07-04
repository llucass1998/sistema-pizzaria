import { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Plus,
  ArrowDown,
  ArrowUp,
  Edit,
  Trash,
  History,
  Trash2,
  AlertTriangle,
  Factory,
  Play,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  FileText,
  Layers,
  ShieldAlert,
  RefreshCw,
  AlertOctagon
} from 'lucide-react';
import { Panel, ListRow, RowActions } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { formatCurrency, formatCurrencySafe } from '../../data/menuData.js';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState('INVENTORY'); // INVENTORY, WASTE, MANUFACTURING

  const [data, setData] = useState({ ingredients: [], summary: {} });
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  // Modals state (Estoque)
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);

  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    barcode: '',
    unit: 'UN',
    cost: 0,
    minStock: 0,
    stock: 0,
  });

  const [transactionForm, setTransactionForm] = useState({
    ingredientId: '',
    type: 'IN',
    quantity: 0,
    cost: 0,
    notes: '',
  });

  // Módulo de Perdas (Waste)
  const [wasteRecords, setWasteRecords] = useState([]);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [wasteForm, setWasteForm] = useState({
    ingredientId: '',
    quantity: '',
    reason: 'EXPIRED',
    registeredBy: 'Gerente / Estoque',
    notes: '',
  });

  // Módulo de Ordens de Produção (Manufacturing)
  const [manufacturingOrders, setManufacturingOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [isMfgModalOpen, setIsMfgModalOpen] = useState(false);
  const [mfgForm, setMfgForm] = useState({
    productId: '',
    quantity: '',
    notes: '',
    outputIngredientId: '',
    outputQuantityPerUnit: '',
  });

  const adminDataStr = window.localStorage.getItem('pizzaria-admin');
  const adminRole = adminDataStr ? JSON.parse(adminDataStr).role : '';
  const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER'];
  const hasPermission = allowedRoles.includes(adminRole);

  useEffect(() => {
    if (hasPermission) {
      loadAllData();
    }
  }, [hasPermission]);

  async function loadAllData() {
    try {
      setIsLoading(true);
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Resumo de Estoque e Ingredientes
      const invRes = await fetch(`${API_BASE_URL}/inventory/summary`, { headers });
      if (invRes.ok) {
        const invResult = await invRes.json();
        setData({ ingredients: invResult.ingredients || [], summary: invResult });
      }

      // 2. Registros de Perdas
      const wasteRes = await fetch(`${API_BASE_URL}/admin/inventory/waste`, { headers });
      if (wasteRes.ok) {
        const wasteResult = await wasteRes.json();
        setWasteRecords(Array.isArray(wasteResult) ? wasteResult : []);
      }

      // 3. Ordens de Produção & Produtos
      const mfgRes = await fetch(`${API_BASE_URL}/admin/manufacturing/orders`, { headers });
      if (mfgRes.ok) {
        const mfgResult = await mfgRes.json();
        setManufacturingOrders(Array.isArray(mfgResult) ? mfgResult : []);
      }

      const prodRes = await fetch(`${API_BASE_URL}/produtos`, { headers });
      if (prodRes.ok) {
        const prodResult = await prodRes.json();
        setProducts(Array.isArray(prodResult) ? prodResult : []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do estoque e manufatura:', err);
      showError('Falha ao carregar dados do estoque.');
    } finally {
      setIsLoading(false);
    }
  }

  // --- Handlers Estoque Insumos ---
  async function handleSaveIngredient(e) {
    e.preventDefault();
    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));
      const url = editingIngredient
        ? `${API_BASE_URL}/inventory/ingredients/${editingIngredient.id}`
        : `${API_BASE_URL}/inventory/ingredients`;

      const response = await fetch(url, {
        method: editingIngredient ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.token}`,
        },
        body: JSON.stringify(ingredientForm),
      });

      const result = await response.json();
      if (response.ok) {
        setIsIngredientModalOpen(false);
        showSuccess('Ingrediente salvo com sucesso!');
        loadAllData();
      } else {
        throw new Error(result.message || 'Erro ao salvar ingrediente');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleSaveTransaction(e) {
    e.preventDefault();
    try {
      const adminData = JSON.parse(window.localStorage.getItem('pizzaria-admin'));
      const response = await fetch(`${API_BASE_URL}/inventory/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.token}`,
        },
        body: JSON.stringify(transactionForm),
      });

      const result = await response.json();
      if (response.ok) {
        setIsTransactionModalOpen(false);
        showSuccess('Transação registrada!');
        loadAllData();
      } else {
        throw new Error(result.message || 'Erro ao registrar transação');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  function openNewIngredient() {
    setEditingIngredient(null);
    setIngredientForm({ name: '', barcode: '', unit: 'UN', cost: 0, minStock: 0, stock: 0 });
    setIsIngredientModalOpen(true);
  }

  function openEditIngredient(ingredient) {
    setEditingIngredient(ingredient);
    setIngredientForm({
      name: ingredient.name,
      barcode: ingredient.barcode ?? '',
      unit: ingredient.unit,
      cost: ingredient.cost,
      minStock: ingredient.minStock,
      stock: ingredient.stock,
    });
    setIsIngredientModalOpen(true);
  }

  function openTransaction(type, ingredientId = '') {
    setTransactionForm({
      ingredientId,
      type,
      quantity: 0,
      cost: 0,
      notes: '',
    });
    setIsTransactionModalOpen(true);
  }

  // --- Handlers Registro de Perdas (Waste) ---
  async function handleSaveWaste(e) {
    e.preventDefault();
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);

      const payload = {
        ingredientId: wasteForm.ingredientId,
        quantity: Number(wasteForm.quantity),
        reason: wasteForm.reason,
        registeredBy: wasteForm.registeredBy.trim() || 'Gerente',
        notes: wasteForm.notes.trim() || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/admin/inventory/waste`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsWasteModalOpen(false);
        setWasteForm({
          ingredientId: '',
          quantity: '',
          reason: 'EXPIRED',
          registeredBy: 'Gerente / Estoque',
          notes: '',
        });
        showSuccess('Perda registrada e estoque atualizado!');
        loadAllData();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Erro ao registrar perda.');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  // --- Handlers Ordens de Produção ---
  async function handleSaveMfgOrder(e) {
    e.preventDefault();
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);

      const payload = {
        productId: mfgForm.productId,
        quantity: Number(mfgForm.quantity),
        notes: mfgForm.notes.trim() || undefined,
        outputIngredientId: mfgForm.outputIngredientId || undefined,
        outputQuantityPerUnit: mfgForm.outputQuantityPerUnit
          ? Number(mfgForm.outputQuantityPerUnit)
          : undefined,
      };

      const response = await fetch(`${API_BASE_URL}/admin/manufacturing/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsMfgModalOpen(false);
        setMfgForm({
          productId: '',
          quantity: '',
          notes: '',
          outputIngredientId: '',
          outputQuantityPerUnit: '',
        });
        showSuccess('Ordem de produção criada com sucesso!');
        loadAllData();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Erro ao criar ordem de produção.');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleUpdateMfgStatus(orderId, action) {
    try {
      const adminDataStr = window.localStorage.getItem('pizzaria-admin');
      if (!adminDataStr) return;
      const { token } = JSON.parse(adminDataStr);

      const response = await fetch(
        `${API_BASE_URL}/admin/manufacturing/orders/${orderId}/${action}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const msgMap = {
          start: 'Ordem de produção iniciada!',
          complete: 'Ordem de produção concluída e estoque de insumos atualizado!',
          cancel: 'Ordem de produção cancelada!',
        };
        showSuccess(msgMap[action] || 'Status atualizado com sucesso!');
        loadAllData();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Erro ao atualizar status da ordem.');
      }
    } catch (err) {
      showError(err.message);
    }
  }

  const getWasteReasonBadge = (reason) => {
    const map = {
      EXPIRED: { label: 'Validade / Vencido', bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' },
      DAMAGED: { label: 'Avaria / Quebra', bg: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300' },
      MISTAKE: { label: 'Erro de Preparo', bg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300' },
      QUALITY_REJECT: { label: 'Rejeitado (Qualidade)', bg: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300' },
      OTHER: { label: 'Outro Motivo', bg: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300' },
    };
    const item = map[reason] || { label: reason, bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold border ${item.bg}`}>
        {item.label}
      </span>
    );
  };

  const getMfgStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-300">
            Rascunho
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 animate-pulse">
            <Play size={10} className="fill-blue-600 text-blue-600" /> Em Produção
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300">
            <CheckCircle size={12} className="text-green-600" /> Concluída
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
            <XCircle size={12} className="text-red-600" /> Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800">
            {status}
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
            Seu perfil ({adminRole || 'Sem Perfil'}) não tem permissão para acessar o controle de estoque e manufatura.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="text-red-600" />
            Controle de Estoque e Produção
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Gestão de insumos, registro de quebras e ordens de pré-preparo/manufatura.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            title="Atualizar dados"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'INVENTORY'
              ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Package size={16} className={activeTab === 'INVENTORY' ? 'text-orange-400' : ''} />
          Insumos & Saldo ({data.ingredients.length})
        </button>

        <button
          onClick={() => setActiveTab('WASTE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'WASTE'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <AlertOctagon size={16} className={activeTab === 'WASTE' ? 'text-white' : 'text-red-500'} />
          Registro de Perdas ({wasteRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('MANUFACTURING')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'MANUFACTURING'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Factory size={16} className={activeTab === 'MANUFACTURING' ? 'text-white' : 'text-blue-500'} />
          Ordens de Produção ({manufacturingOrders.length})
        </button>
      </div>

      {/* ABA 1: INVENTORY (INSUMOS E SALDOS) */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => openTransaction('IN')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-sm rounded-xl transition"
            >
              <ArrowDown size={16} />
              Entrada de Estoque
            </button>
            <button
              onClick={() => openTransaction('OUT')}
              className="flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400 font-bold text-sm rounded-xl transition"
            >
              <ArrowUp size={16} />
              Saída Manual
            </button>
            <button
              onClick={openNewIngredient}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 font-bold text-sm rounded-xl transition shadow-md shadow-red-500/20"
            >
              <Plus size={16} />
              Novo Insumo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Panel className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Valor em Estoque</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatCurrencySafe(data.summary?.totalStockValue || 0)}
              </span>
            </Panel>
            <Panel className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Insumos Críticos</span>
              <span className="text-2xl font-black text-rose-600 mt-1">
                {data.summary?.criticalCount || 0}
              </span>
            </Panel>
            <Panel className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Insumos Baixos</span>
              <span className="text-2xl font-black text-amber-500 mt-1">
                {data.summary?.lowCount || 0}
              </span>
            </Panel>
            <Panel className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Sugestão de Compra</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatCurrencySafe(data.summary?.purchaseSuggestion || 0)}
              </span>
            </Panel>
          </div>

          <Panel>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-base text-slate-900 dark:text-white">Insumos Cadastrados</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.ingredients.map((ing) => (
                <ListRow key={ing.id}>
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white truncate">{ing.name}</p>
                      <p className="text-xs text-slate-500">
                        Custo: {formatCurrencySafe(ing.cost)} / {ing.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Saldo Atual</p>
                      <p
                        className={`font-black text-base ${
                          ing.status === 'CRITICAL' || ing.status === 'OUT'
                            ? 'text-rose-600'
                            : ing.status === 'LOW'
                            ? 'text-amber-500'
                            : 'text-emerald-600'
                        }`}
                      >
                        {ing.stock} {ing.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Estoque Mín.</p>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {ing.minStock} {ing.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold mt-0.5 ${
                          ing.status === 'CRITICAL' || ing.status === 'OUT'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : ing.status === 'LOW'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {ing.status}
                      </span>
                    </div>
                  </div>
                  <RowActions>
                    <button
                      onClick={() => openEditIngredient(ing)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition"
                      title="Editar Insumo"
                    >
                      <Edit size={18} />
                    </button>
                  </RowActions>
                </ListRow>
              ))}
              {data.ingredients.length === 0 && (
                <div className="p-12 text-center text-slate-500 font-medium">
                  Nenhum insumo cadastrado ainda.
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ABA 2: WASTE (REGISTRO DE PERDAS) */}
      {activeTab === 'WASTE' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-200 dark:border-red-900/50">
            <div>
              <h3 className="text-base font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <AlertOctagon size={20} className="text-red-600" />
                Gestão de Quebras, Desperdício e Validade (`/waste`)
              </h3>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                O registro de perda deduz automaticamente o saldo do ingrediente em estoque e gera relatório de custos de quebra.
              </p>
            </div>
            <button
              onClick={() => setIsWasteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 font-bold text-sm rounded-xl transition shadow-md shadow-red-500/20"
            >
              <Plus size={16} />
              Registrar Perda
            </button>
          </div>

          <Panel>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Histórico de Perdas Registradas
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5 font-black">Ingrediente</th>
                    <th className="px-6 py-3.5 font-black text-right">Quantidade</th>
                    <th className="px-6 py-3.5 font-black text-center">Motivo</th>
                    <th className="px-6 py-3.5 font-black">Registrado Por</th>
                    <th className="px-6 py-3.5 font-black">Observações</th>
                    <th className="px-6 py-3.5 font-black text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {wasteRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                        {r.ingredient?.name || 'Ingrediente Removido'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-black text-red-600 dark:text-red-400">
                        -{r.quantity} {r.ingredient?.unit || 'UN'}
                      </td>
                      <td className="px-6 py-3.5 text-center">{getWasteReasonBadge(r.reason)}</td>
                      <td className="px-6 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                        {r.registeredBy}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500 max-w-[200px] truncate">
                        {r.notes || '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs text-slate-500">
                        {new Date(r.createdAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                  {wasteRecords.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-12 text-center text-slate-500 font-medium">
                        Nenhuma perda ou quebra registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* ABA 3: MANUFACTURING (ORDENS DE PRODUÇÃO) */}
      {activeTab === 'MANUFACTURING' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50">
            <div>
              <h3 className="text-base font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <Factory size={20} className="text-blue-600" />
                Manufatura e Pré-Preparo (`/manufacturing`)
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                Crie ordens de produção para massas, molhos e pré-montagens. Ao concluir, o sistema adiciona o saldo produzido diretamente ao estoque do insumo gerado.
              </p>
            </div>
            <button
              onClick={() => setIsMfgModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/20"
            >
              <Plus size={16} />
              Nova Ordem
            </button>
          </div>

          <Panel>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Ordens de Produção em Andamento e Histórico
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5 font-black">Produto / Lote</th>
                    <th className="px-6 py-3.5 font-black text-center">Qtd. Lote</th>
                    <th className="px-6 py-3.5 font-black">Insumo Gerado (Estoque)</th>
                    <th className="px-6 py-3.5 font-black text-center">Status</th>
                    <th className="px-6 py-3.5 font-black">Observações</th>
                    <th className="px-6 py-3.5 font-black text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {manufacturingOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-6 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {o.product?.name || 'Produto sem nome'}
                        </p>
                        <p className="text-xs text-slate-400">
                          Criada em: {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </td>
                      <td className="px-6 py-3.5 text-center font-black text-slate-900 dark:text-white text-base">
                        {o.quantity} un
                      </td>
                      <td className="px-6 py-3.5">
                        {o.outputIngredient ? (
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <span>+{o.quantity * (o.outputQuantityPerUnit || 1)}</span>
                            <span>{o.outputIngredient.unit}</span>
                            <span className="text-slate-600 dark:text-slate-400 font-normal">
                              ({o.outputIngredient.name})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Sem vínculo de insumo</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">{getMfgStatusBadge(o.status)}</td>
                      <td className="px-6 py-3.5 text-xs text-slate-500 max-w-[180px] truncate">
                        {o.notes || '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {o.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleUpdateMfgStatus(o.id, 'start')}
                                title="Iniciar Produção"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 transition"
                              >
                                <Play size={14} className="fill-blue-600" /> Iniciar
                              </button>
                              <button
                                onClick={() => handleUpdateMfgStatus(o.id, 'cancel')}
                                title="Cancelar Ordem"
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/40 transition"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          {o.status === 'IN_PROGRESS' && (
                            <>
                              <button
                                onClick={() => handleUpdateMfgStatus(o.id, 'complete')}
                                title="Concluir Produção e dar Entrada no Estoque"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs hover:bg-green-700 shadow-sm transition"
                              >
                                <CheckCircle size={14} /> Concluir
                              </button>
                              <button
                                onClick={() => handleUpdateMfgStatus(o.id, 'cancel')}
                                title="Cancelar Ordem"
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/40 transition"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          {(o.status === 'COMPLETED' || o.status === 'CANCELLED') && (
                            <span className="text-xs text-slate-400 font-medium">Finalizada</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {manufacturingOrders.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-12 text-center text-slate-500 font-medium">
                        Nenhuma ordem de produção registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* --- MODAL 1: NOVO/EDITAR INSUMO --- */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">
                {editingIngredient ? 'Editar Ingrediente' : 'Novo Ingrediente'}
              </h3>
              <button
                onClick={() => setIsIngredientModalOpen(false)}
                className="text-slate-400 hover:text-red-500"
              >
                <Trash2 size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveIngredient} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Insumo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Queijo Mussarela, Farinha de Trigo..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={ingredientForm.name}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Código de Barras / SKU
                </label>
                <input
                  type="text"
                  placeholder="EAN ou SKU do insumo"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={ingredientForm.barcode || ''}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, barcode: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unidade
                  </label>
                  <select
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    value={ingredientForm.unit}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                  >
                    <option value="UN">Unidade (UN)</option>
                    <option value="KG">Quilograma (KG)</option>
                    <option value="G">Grama (G)</option>
                    <option value="L">Litro (L)</option>
                    <option value="ML">Mililitro (ML)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Custo Unit. (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    value={ingredientForm.cost}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, cost: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    min="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    value={ingredientForm.minStock}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, minStock: e.target.value })}
                  />
                </div>
                {!editingIngredient && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Estoque Inicial
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      min="0"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      value={ingredientForm.stock}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, stock: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsIngredientModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-500/20"
                >
                  Salvar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: TRANSAÇÃO MANUAL DE ESTOQUE --- */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">
                {transactionForm.type === 'IN' ? 'Registrar Entrada de Estoque' : 'Registrar Saída de Estoque'}
              </h3>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ingrediente
                </label>
                <select
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={transactionForm.ingredientId}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, ingredientId: e.target.value })
                  }
                >
                  <option value="">Selecione um insumo...</option>
                  {data.ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Saldo atual: {ing.stock} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    min="0.001"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    value={transactionForm.quantity}
                    onChange={(e) =>
                      setTransactionForm({ ...transactionForm, quantity: e.target.value })
                    }
                  />
                </div>
                {transactionForm.type === 'IN' && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Custo Total (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      value={transactionForm.cost}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, cost: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Motivo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Compra de fornecedor, Ajuste de contagem..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={transactionForm.notes}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, notes: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold text-white rounded-xl shadow-md ${
                    transactionForm.type === 'IN'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                  }`}
                >
                  Confirmar {transactionForm.type === 'IN' ? 'Entrada' : 'Saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: REGISTRO DE PERDA / QUEBRA (WASTE) --- */}
      {isWasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 bg-red-600 text-white flex items-center justify-between">
              <h3 className="font-black text-lg flex items-center gap-2">
                <AlertOctagon size={20} />
                Registrar Perda ou Desperdício
              </h3>
            </div>
            <form onSubmit={handleSaveWaste} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ingrediente Quebrado / Vencido
                </label>
                <select
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={wasteForm.ingredientId}
                  onChange={(e) => setWasteForm({ ...wasteForm, ingredientId: e.target.value })}
                >
                  <option value="">Selecione o insumo...</option>
                  {data.ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Saldo disponível: {ing.stock} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantidade Perdida
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    min="0.001"
                    placeholder="0.000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-bold text-red-600"
                    value={wasteForm.quantity}
                    onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Motivo da Perda
                  </label>
                  <select
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-bold text-xs"
                    value={wasteForm.reason}
                    onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                  >
                    <option value="EXPIRED">Validade / Vencido</option>
                    <option value="DAMAGED">Avaria no Manuseio</option>
                    <option value="MISTAKE">Erro de Preparo</option>
                    <option value="QUALITY_REJECT">Rejeição de Qualidade</option>
                    <option value="OTHER">Outro Motivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Funcionário Responsável
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos (Pizzaiolo), Ana (Gerente)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={wasteForm.registeredBy}
                  onChange={(e) => setWasteForm({ ...wasteForm, registeredBy: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observações Detalhadas (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Massa caiu no chão durante o turno da noite..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={wasteForm.notes}
                  onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWasteModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-500/20"
                >
                  Registrar e Abater Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: NOVA ORDEM DE PRODUÇÃO (MANUFACTURING) --- */}
      {isMfgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Factory size={20} />
                Nova Ordem de Produção / Pré-Preparo
              </h3>
            </div>
            <form onSubmit={handleSaveMfgOrder} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Produto / Receita a Produzir
                </label>
                <select
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={mfgForm.productId}
                  onChange={(e) => setMfgForm({ ...mfgForm, productId: e.target.value })}
                >
                  <option value="">Selecione uma receita do cardápio...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category?.name || 'Cardápio'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade do Lote
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  min="1"
                  placeholder="Ex: 50, 100..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  value={mfgForm.quantity}
                  onChange={(e) => setMfgForm({ ...mfgForm, quantity: e.target.value })}
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
                  <Layers size={14} className="text-blue-500" />
                  Vínculo com Estoque de Insumo (Opcional)
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Insumo Gerado ao Concluir Lote
                  </label>
                  <select
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={mfgForm.outputIngredientId}
                    onChange={(e) =>
                      setMfgForm({ ...mfgForm, outputIngredientId: e.target.value })
                    }
                  >
                    <option value="">Nenhum (Apenas controle visual)</option>
                    {data.ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {mfgForm.outputIngredientId && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Quantidade Gerada por Unidade de Produto
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      required={!!mfgForm.outputIngredientId}
                      placeholder="Ex: 1 ou 0.250..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={mfgForm.outputQuantityPerUnit}
                      onChange={(e) =>
                        setMfgForm({ ...mfgForm, outputQuantityPerUnit: e.target.value })
                      }
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Multiplicado pela quantidade do lote ao finalizar.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Instruções da Produção
                </label>
                <input
                  type="text"
                  placeholder="Ex: Massa de longa fermentação para o fim de semana..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={mfgForm.notes}
                  onChange={(e) => setMfgForm({ ...mfgForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMfgModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20"
                >
                  Criar Ordem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
