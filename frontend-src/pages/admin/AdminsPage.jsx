import { useState, useEffect } from 'react';
import { UserCog, Plus, Save, UserX, UserCheck, KeyRound, Lock } from 'lucide-react';
import { Panel } from '../../components/admin/AdminUI.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';

const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api');

const ROLES = [
  { value: 'OWNER', label: 'Dono (Acesso Total)' },
  { value: 'ADMIN', label: 'Administrador (Acesso Total)' },
  { value: 'MANAGER', label: 'Gerente (Sem config/financeiro)' },
  { value: 'CASHIER', label: 'Caixa (Apenas PDV/Pedidos)' },
  { value: 'KITCHEN', label: 'Cozinha (Apenas Pedidos)' },
  { value: 'DRIVER', label: 'Entregador (Apenas Despacho)' },
];

export function AdminsPage() {
  const [admins, setAdmins] = useState([]);
  const { showSuccess, showError } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', email: '', password: '' });

  // Reset Password State
  const [resetModalData, setResetModalData] = useState(null);

  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER'
  });

  const sessionData = JSON.parse(window.localStorage.getItem('pizzaria-admin') || '{}');
  const sessionToken = sessionData?.token;
  const sessionRole = sessionData?.role || 'ADMIN';
  const sessionId = sessionData?.admin?.id;

  async function loadAdmins() {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (!response.ok) throw new Error('Não foi possível carregar a equipe');
      const data = await response.json();
      setAdmins(data);
    } catch (err) {
      showError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(sessionRole)) {
      loadAdmins();
    } else {
      showError('Acesso negado. Apenas OWNER/ADMIN podem acessar esta página.');
      setIsLoading(false);
    }
  }, []);

  async function handleCreateUser(e) {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}` 
        },
        body: JSON.stringify(newAdmin)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao criar usuário');
      
      showSuccess('Usuário criado com sucesso!');
      setIsCreating(false);
      setNewAdmin({ name: '', email: '', password: '', role: 'CASHIER' });
      loadAdmins();
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleRoleChange(id, newRole) {
    if (id === sessionId) {
      showError('Você não pode alterar sua própria permissão por aqui.');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao alterar permissão');
      
      showSuccess('Permissão atualizada!');
      loadAdmins();
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleResetPassword(admin) {
    if (!window.confirm(`Tem certeza que deseja gerar uma nova senha temporária para ${admin.name}?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${admin.id}/reset-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}` 
        },
        body: JSON.stringify({})
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao redefinir senha');

      setResetModalData({ name: admin.name, temporaryPassword: data.temporaryPassword });
      showSuccess('Senha redefinida com sucesso!');
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleDeleteUser(id, currentRole) {
    if (id === sessionId) {
      showError('Você não pode excluir sua própria conta.');
      return;
    }
    if (currentRole === 'OWNER') {
      showError('O dono do sistema (OWNER) não pode ser excluído.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja excluir permanentemente este usuário?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao excluir usuário');
      }
      
      showSuccess('Usuário excluído!');
      loadAdmins();
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        name: editData.name,
        email: editData.email,
        ...(editData.password && { password: editData.password })
      };

      const response = await fetch(`${API_BASE_URL}/admin/users/${editingId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}` 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao editar usuário');
      
      showSuccess('Usuário atualizado com sucesso!');
      setEditingId(null);
      loadAdmins();
    } catch (err) {
      showError(err.message);
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Carregando...</div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog className="text-red-600" />
            Equipe & Permissões
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Gerencie quem tem acesso ao painel, níveis de permissão e redefinição de senhas.
          </p>
        </div>
        
        {!isCreating && ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(sessionRole) && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 font-bold rounded-xl transition shadow-md"
          >
            <Plus size={18} /> Novo Usuário
          </button>
        )}
      </div>

      {/* Modal / Alerta de Senha Temporária */}
      {resetModalData && (
        <Panel className="p-6 border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-600 text-white rounded-xl">
                <KeyRound size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg">
                  Senha temporária gerada!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Transmita esta senha de forma segura ao usuário <strong>{resetModalData.name}</strong>:
                </p>
              </div>
            </div>
            <button
              onClick={() => setResetModalData(null)}
              className="text-slate-400 hover:text-slate-600 font-bold text-sm"
            >
              Fechar ✖
            </button>
          </div>
          <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <span className="font-mono text-xl font-black tracking-wider text-emerald-600 dark:text-emerald-400">
              {resetModalData.temporaryPassword}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(resetModalData.temporaryPassword);
                showSuccess('Senha copiada para a área de transferência!');
              }}
              className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition"
            >
              📋 Copiar Senha
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 italic">
            O usuário poderá alterar esta senha no próximo acesso.
          </p>
        </Panel>
      )}

      {isCreating && (
        <Panel className="p-6 border-2 border-red-500/20">
          <h2 className="text-lg font-bold mb-4">Adicionar Novo Usuário</h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
              <input 
                type="text" required
                value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email (Login)</label>
              <input 
                type="email" required
                value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Senha (Mín. 6 chars)</label>
              <input 
                type="password" required minLength="6"
                value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nível de Permissão (Role)</label>
              <select 
                required
                value={newAdmin.role} onChange={e => setNewAdmin({...newAdmin, role: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-bold"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm transition"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-bold text-sm rounded-lg shadow-md hover:bg-red-700 transition"
              >
                <Save size={18} /> Criar Usuário
              </button>
            </div>
          </form>
        </Panel>
      )}

      {admins.length === 0 && !isLoading && (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-slate-500 font-bold">Nenhum usuário encontrado na equipe.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {admins.map(admin => (
          <Panel key={admin.id} className="p-5 flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition">
            {editingId === admin.id ? (
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nome Completo</label>
                  <input 
                    type="text" required
                    value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Email</label>
                  <input 
                    type="email" required
                    value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nova Senha (deixe em branco para manter)</label>
                  <input 
                    type="password" minLength="6"
                    value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Sua nova senha"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-red-600 text-white rounded-lg py-2 text-xs font-bold hover:bg-red-700 transition">Salvar</button>
                  <button type="button" onClick={() => setEditingId(null)} className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg py-2 text-xs font-bold hover:bg-slate-300 transition">Cancelar</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-black flex justify-center items-center text-lg shadow-sm">
                      {admin.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-base leading-tight text-slate-900 dark:text-white truncate">{admin.name}</h3>
                      <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{admin.email}</p>
                    </div>
                  </div>
                  
                  {['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(sessionRole) && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button 
                        onClick={() => handleResetPassword(admin)}
                        disabled={(admin.role === 'OWNER' && sessionRole !== 'OWNER')}
                        className="p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Redefinir Senha Temporária"
                      >
                        <KeyRound size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingId(admin.id);
                          setEditData({ name: admin.name, email: admin.email, password: '' });
                        }}
                        disabled={(admin.role === 'OWNER' && sessionRole !== 'OWNER')}
                        className="p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Editar Nome/Email/Senha"
                      >
                        <UserCog size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(admin.id, admin.role)}
                        disabled={admin.id === sessionId || admin.role === 'OWNER'}
                        className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Excluir Usuário"
                      >
                        <UserX size={16} />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Nível de Acesso</label>
                  <select
                    value={admin.role || 'ADMIN'}
                    disabled={
                      !['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(sessionRole) || 
                      (admin.role === 'OWNER' && sessionRole !== 'OWNER') ||
                      admin.id === sessionId
                    }
                    onChange={(e) => handleRoleChange(admin.id, e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed transition focus:border-red-500 focus:outline-none"
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
